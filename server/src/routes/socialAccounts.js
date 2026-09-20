// =====================================================
// 社交账号管理 - API路由
// 路径: server/src/routes/socialAccounts.js
// 说明: 用户连接和管理社交账号
// =====================================================

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';
import uploadPostService from '../services/uploadPostService.js';
import profileService from '../services/profileService.js';

const router = express.Router();

/**
 * 1. 获取用户的社交账号列表
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(`
            SELECT
                sa.*,
                pp.platform as platform_name,
                us.max_social_profiles as subscription_limit,
                (
                    SELECT COUNT(*)
                    FROM social_accounts
                    WHERE user_id = $1 AND is_active = true
                ) as current_count
            FROM social_accounts sa
            LEFT JOIN platform_pricing pp ON sa.platform = pp.platform
            LEFT JOIN user_subscriptions us ON sa.user_id = us.user_id AND us.status = 'active'
            WHERE sa.user_id = $1
            ORDER BY sa.created_at DESC
        `, [userId]);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Get social accounts error:', error);
        res.status(500).json({
            success: false,
            message: '获取社交账号列表失败',
            error: error.message
        });
    }
});

/**
 * 2. 获取OAuth连接URL（集成Profile智能管理）
 */
router.post('/connect-url', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { platform } = req.body;

        if (!platform) {
            return res.status(400).json({
                success: false,
                message: '请指定平台'
            });
        }

        // 1. 智能选择或创建Profile
        const profileResult = await profileService.selectOrCreateProfile(userId, platform);

        if (!profileResult.success) {
            return res.status(403).json({
                success: false,
                message: profileResult.error,
                quota: profileResult.quota
            });
        }

        const profileId = profileResult.profileId;

        // 2. 回调URL
        const redirectUri = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/api/social-accounts/callback`;

        // 3. 通过Upload-Post获取OAuth URL
        const result = await uploadPostService.getConnectUrl(
            userId,
            platform,
            redirectUri,
            profileId  // 传递Profile ID
        );

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: '获取连接URL失败',
                error: result.error
            });
        }

        res.json({
            success: true,
            data: {
                authUrl: result.data.connect_url || result.data.authorization_url,
                platform: platform,
                state: result.data.state,
                profileId: profileId,
                profileInfo: {
                    isNew: profileResult.isNew,
                    message: profileResult.message,
                    profileName: profileResult.profileName
                }
            }
        });

    } catch (error) {
        console.error('Get connect URL error:', error);
        res.status(500).json({
            success: false,
            message: '获取连接URL失败',
            error: error.message
        });
    }
});

/**
 * 3. OAuth回调处理
 */
router.get('/callback', async (req, res) => {
    try {
        const { code, state, error: oauthError } = req.query;

        if (oauthError) {
            console.error('OAuth error:', oauthError);
            return res.redirect(`/app/social-accounts?error=${encodeURIComponent(oauthError)}`);
        }

        // 从state中解析用户ID和平台
        let stateData;
        try {
            stateData = JSON.parse(state);
        } catch (e) {
            console.error('Invalid state:', state);
            return res.redirect('/app/social-accounts?error=invalid_state');
        }

        const { user_id, platform } = stateData;

        if (!user_id || !platform) {
            return res.redirect('/app/social-accounts?error=missing_parameters');
        }

        // 同步账号信息
        const syncResult = await uploadPostService.syncUserAccounts(user_id);

        if (syncResult.success) {
            res.redirect(`/app/social-accounts?success=true&platform=${platform}`);
        } else {
            res.redirect(`/app/social-accounts?error=${encodeURIComponent(syncResult.error)}`);
        }

    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect('/app/social-accounts?error=callback_failed');
    }
});

/**
 * 4. 手动同步账号信息
 */
router.post('/sync', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await uploadPostService.syncUserAccounts(userId);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: '同步失败',
                error: result.error
            });
        }

        res.json({
            success: true,
            message: `已同步 ${result.count} 个账号`,
            data: { count: result.count }
        });

    } catch (error) {
        console.error('Sync accounts error:', error);
        res.status(500).json({
            success: false,
            message: '同步账号失败',
            error: error.message
        });
    }
});

/**
 * 5. 断开社交账号连接
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const userId = req.user.id;
        const accountId = req.params.id;

        // 获取账号信息
        const accountResult = await client.query(
            'SELECT * FROM social_accounts WHERE id = $1 AND user_id = $2',
            [accountId, userId]
        );

        if (accountResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: '账号不存在'
            });
        }

        const account = accountResult.rows[0];

        // 从Upload-Post断开连接
        const disconnectResult = await uploadPostService.disconnectAccount(
            account.upload_post_profile_id,
            account.platform
        );

        // 即使Upload-Post断开失败，也删除本地记录
        await client.query(
            'DELETE FROM social_accounts WHERE id = $1',
            [accountId]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: '账号已断开连接',
            upload_post_result: disconnectResult
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Disconnect account error:', error);
        res.status(500).json({
            success: false,
            message: '断开连接失败',
            error: error.message
        });
    } finally {
        client.release();
    }
});

/**
 * 6. 启用/禁用账号
 */
router.put('/:id/toggle', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const accountId = req.params.id;
        const { is_active } = req.body;

        const result = await pool.query(`
            UPDATE social_accounts
            SET is_active = $1, updated_at = NOW()
            WHERE id = $2 AND user_id = $3
            RETURNING *
        `, [is_active, accountId, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '账号不存在'
            });
        }

        res.json({
            success: true,
            message: is_active ? '账号已启用' : '账号已禁用',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Toggle account error:', error);
        res.status(500).json({
            success: false,
            message: '操作失败',
            error: error.message
        });
    }
});

/**
 * 7. 获取支持的平台列表
 */
router.get('/platforms/supported', async (req, res) => {
    try {
        // 从数据库获取启用的平台
        const result = await pool.query(`
            SELECT platform, is_enabled
            FROM platform_pricing
            WHERE is_enabled = true
            ORDER BY platform
        `);

        // 也可以从Upload-Post API获取最新支持的平台
        const uploadPostResult = await uploadPostService.getSupportedPlatforms();

        res.json({
            success: true,
            data: {
                local: result.rows.map(r => r.platform),
                upload_post: uploadPostResult.success ? uploadPostResult.data : []
            }
        });

    } catch (error) {
        console.error('Get supported platforms error:', error);
        res.status(500).json({
            success: false,
            message: '获取平台列表失败',
            error: error.message
        });
    }
});

export default router;
