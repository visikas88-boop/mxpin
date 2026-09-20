import axios from 'axios';
import { query } from '../config/database.js';

/**
 * 获取OAuth连接URL
 * POST /api/social-accounts/connect-url
 */
export async function getConnectUrl(req, res) {
    try {
        const { platform } = req.body;
        const userId = req.user.id;

        if (!platform) {
            return res.status(400).json({
                success: false,
                message: '请指定平台'
            });
        }

        // 从配置表获取API Key
        const configResult = await query(
            'SELECT api_key, api_url FROM upload_post_config WHERE is_active = true LIMIT 1'
        );

        if (configResult.rows.length === 0) {
            return res.status(500).json({
                success: false,
                message: 'Upload-Post配置未设置，请联系管理员'
            });
        }

        const { api_key, api_url } = configResult.rows[0];

        // 构建回调URL
        const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/social-accounts/callback`;
        const state = Buffer.from(JSON.stringify({ userId, platform })).toString('base64');

        // 调用Upload-Post Connect API
        const response = await axios.post(
            `${api_url}/api/connect/init`,
            {
                platform: platform,
                redirect_uri: redirectUri,
                state: state
            },
            {
                headers: {
                    'Authorization': `Bearer ${api_key}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        res.json({
            success: true,
            data: {
                connectUrl: response.data.url,
                sessionId: response.data.session_id,
                state: state
            }
        });

    } catch (error) {
        console.error('Get connect URL error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: '获取连接URL失败',
            error: error.response?.data?.message || error.message
        });
    }
}

/**
 * 验证连接并保存账号信息
 * POST /api/social-accounts/verify-connection
 */
export async function verifyConnection(req, res) {
    try {
        const { sessionId, code, state } = req.body;
        const userId = req.user.id;

        // 验证state参数
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        if (stateData.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: '无效的授权请求'
            });
        }

        const configResult = await query(
            'SELECT api_key, api_url FROM upload_post_config WHERE is_active = true LIMIT 1'
        );
        const { api_key, api_url } = configResult.rows[0];

        // 验证授权
        const response = await axios.post(
            `${api_url}/api/connect/complete`,
            {
                session_id: sessionId,
                code: code
            },
            {
                headers: {
                    'Authorization': `Bearer ${api_key}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        const accountData = response.data;

        // 保存到数据库
        const result = await query(`
            INSERT INTO social_accounts
            (user_id, platform, account_name, account_id, access_token, profile_picture_url, token_expires_at, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (user_id, platform, account_id)
            DO UPDATE SET
                access_token = EXCLUDED.access_token,
                account_name = EXCLUDED.account_name,
                profile_picture_url = EXCLUDED.profile_picture_url,
                token_expires_at = EXCLUDED.token_expires_at,
                metadata = EXCLUDED.metadata,
                is_active = true,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            userId,
            accountData.platform,
            accountData.account_name || accountData.username,
            accountData.account_id || accountData.id,
            accountData.access_token,
            accountData.profile_picture || accountData.avatar_url,
            accountData.expires_at ? new Date(accountData.expires_at) : null,
            JSON.stringify(accountData.metadata || {
                followers: accountData.followers_count,
                verified: accountData.is_verified
            })
        ]);

        res.json({
            success: true,
            message: '账号连接成功',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Verify connection error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: '验证连接失败',
            error: error.response?.data?.message || error.message
        });
    }
}

/**
 * 获取用户已连接账号列表
 * GET /api/social-accounts
 */
export async function getUserAccounts(req, res) {
    try {
        const userId = req.user.id;

        const result = await query(`
            SELECT
                sa.id,
                sa.platform,
                sa.account_name,
                sa.account_id,
                sa.profile_picture_url,
                sa.is_active,
                sa.token_expires_at,
                sa.metadata,
                sa.created_at,
                sa.updated_at,
                pp.display_name as platform_display_name,
                pp.icon_url as platform_icon,
                pp.points_cost as platform_points_cost
            FROM social_accounts sa
            LEFT JOIN platform_pricing pp ON sa.platform = pp.platform
            WHERE sa.user_id = $1
            ORDER BY sa.created_at DESC
        `, [userId]);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Get user accounts error:', error);
        res.status(500).json({
            success: false,
            message: '获取账号列表失败',
            error: error.message
        });
    }
}

/**
 * 断开账号连接
 * DELETE /api/social-accounts/:id
 */
export async function disconnectAccount(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await query(
            'DELETE FROM social_accounts WHERE id = $1 AND user_id = $2 RETURNING platform, account_name',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '账号不存在或无权操作'
            });
        }

        res.json({
            success: true,
            message: `已断开 ${result.rows[0].account_name} 的连接`
        });

    } catch (error) {
        console.error('Disconnect account error:', error);
        res.status(500).json({
            success: false,
            message: '断开连接失败',
            error: error.message
        });
    }
}

/**
 * 启用/禁用账号
 * PUT /api/social-accounts/:id/toggle
 */
export async function toggleAccount(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await query(`
            UPDATE social_accounts
            SET is_active = NOT is_active,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `, [id, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '账号不存在或无权操作'
            });
        }

        res.json({
            success: true,
            message: result.rows[0].is_active ? '账号已启用' : '账号已禁用',
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
}

/**
 * 刷新账号信息
 * POST /api/social-accounts/:id/refresh
 */
export async function refreshAccountInfo(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // 获取账号信息
        const accountResult = await query(
            'SELECT * FROM social_accounts WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (accountResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '账号不存在'
            });
        }

        const account = accountResult.rows[0];

        // 获取API配置
        const configResult = await query(
            'SELECT api_key, api_url FROM upload_post_config WHERE is_active = true LIMIT 1'
        );
        const { api_key, api_url } = configResult.rows[0];

        // 调用Upload-Post API获取最新账号信息
        const response = await axios.get(
            `${api_url}/api/account/info`,
            {
                headers: {
                    'Authorization': `Bearer ${api_key}`,
                    'X-Account-Token': account.access_token
                },
                params: {
                    platform: account.platform
                },
                timeout: 10000
            }
        );

        const updatedData = response.data;

        // 更新数据库
        const updateResult = await query(`
            UPDATE social_accounts
            SET
                account_name = $1,
                profile_picture_url = $2,
                metadata = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
        `, [
            updatedData.account_name || updatedData.username,
            updatedData.profile_picture || updatedData.avatar_url,
            JSON.stringify({
                followers: updatedData.followers_count,
                verified: updatedData.is_verified,
                ...updatedData.metadata
            }),
            id
        ]);

        res.json({
            success: true,
            message: '账号信息已更新',
            data: updateResult.rows[0]
        });

    } catch (error) {
        console.error('Refresh account info error:', error);
        res.status(500).json({
            success: false,
            message: '刷新账号信息失败',
            error: error.response?.data?.message || error.message
        });
    }
}
