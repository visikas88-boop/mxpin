// =====================================================
// Profile配额管理 - 管理后台路由
// 路径: server/src/routes/adminProfileQuota.js
// 说明: 管理员查看和管理Profile配额
// =====================================================

import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

/**
 * 获取Profile配额信息
 */
router.get('/quota', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // 首先尝试从Upload-Post API获取真实配额
        let realMaxProfiles = null;
        try {
            const configResult = await pool.query(`
                SELECT api_key_encrypted
                FROM upload_post_config
                WHERE is_active = true
                LIMIT 1
            `);

            if (configResult.rows.length > 0 && configResult.rows[0].api_key_encrypted) {
                const axios = (await import('axios')).default;
                const apiKey = configResult.rows[0].api_key_encrypted;

                const response = await axios.get('https://api.upload-post.com/api/account', {
                    headers: {
                        'Authorization': `Apikey ${apiKey}`
                    },
                    timeout: 5000
                });

                if (response.status === 200 && response.data) {
                    realMaxProfiles = response.data.max_profiles || response.data.profile_limit || null;

                    // 如果获取到真实配额，同步到数据库
                    if (realMaxProfiles) {
                        await pool.query(`
                            UPDATE upload_post_config
                            SET max_profiles = $1
                            WHERE is_active = true
                        `, [realMaxProfiles]);
                    }
                }
            }
        } catch (apiError) {
            console.warn('Failed to fetch real quota from Upload-Post API:', apiError.message);
            // 继续使用数据库中的配额
        }

        // 获取配额统计
        const quotaResult = await pool.query('SELECT * FROM get_profile_quota_info()');
        const quota = quotaResult.rows[0];

        // 获取预警信息
        const warningResult = await pool.query('SELECT * FROM v_profile_quota_warning');
        const warning = warningResult.rows[0];

        res.json({
            success: true,
            data: {
                quota: {
                    ...quota,
                    is_synced_from_api: realMaxProfiles !== null
                },
                warning: warning,
                recommendations: generateRecommendations(quota, warning)
            }
        });
    } catch (error) {
        console.error('Get quota error:', error);
        res.status(500).json({
            success: false,
            message: '获取配额信息失败',
            error: error.message
        });
    }
});

/**
 * 更新Profile配额设置
 */
router.put('/quota/settings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { max_profiles, profile_quota_warning_threshold } = req.body;

        if (!max_profiles || max_profiles < 1) {
            return res.status(400).json({
                success: false,
                message: 'max_profiles必须大于0'
            });
        }

        // 检查新限制是否小于当前已使用数量
        const currentResult = await pool.query(`
            SELECT current_profiles_used
            FROM upload_post_config
            WHERE is_active = true
        `);

        const currentUsed = currentResult.rows[0]?.current_profiles_used || 0;

        if (max_profiles < currentUsed) {
            return res.status(400).json({
                success: false,
                message: `新的Profile上限（${max_profiles}）不能小于当前已使用数量（${currentUsed}）`,
                data: {
                    max_profiles: max_profiles,
                    current_used: currentUsed
                }
            });
        }

        // 更新配置
        const result = await pool.query(`
            UPDATE upload_post_config
            SET max_profiles = $1,
                profile_quota_warning_threshold = COALESCE($2, FLOOR($1 * 0.8)),
                updated_at = NOW()
            WHERE is_active = true
            RETURNING *
        `, [max_profiles, profile_quota_warning_threshold]);

        res.json({
            success: true,
            message: 'Profile配额设置已更新',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Update quota settings error:', error);
        res.status(500).json({
            success: false,
            message: '更新配额设置失败',
            error: error.message
        });
    }
});

/**
 * 获取Profile使用情况列表
 */
router.get('/profiles/usage', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const result = await pool.query(`
            SELECT *
            FROM v_profile_usage_stats
            ORDER BY profile_created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        // 获取总数
        const countResult = await pool.query(`
            SELECT COUNT(*) as total
            FROM user_upload_post_profiles
        `);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        console.error('Get profiles usage error:', error);
        res.status(500).json({
            success: false,
            message: '获取Profile使用情况失败',
            error: error.message
        });
    }
});

/**
 * 删除用户的Profile（释放配额）
 */
router.delete('/profiles/:userId', authenticateToken, requireAdmin, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { userId } = req.params;

        // 获取用户信息
        const userResult = await client.query(`
            SELECT u.username, upp.upload_post_user
            FROM users u
            LEFT JOIN user_upload_post_profiles upp ON u.id = upp.user_id
            WHERE u.id = $1
        `, [userId]);

        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        const user = userResult.rows[0];

        // 删除用户（级联删除Profile和社交账号）
        await client.query('DELETE FROM users WHERE id = $1', [userId]);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `用户 ${user.username} 已删除，Profile已释放`,
            data: {
                username: user.username,
                upload_post_user: user.upload_post_user
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Delete profile error:', error);
        res.status(500).json({
            success: false,
            message: '删除失败',
            error: error.message
        });
    } finally {
        client.release();
    }
});

/**
 * 生成配额建议
 */
function generateRecommendations(quota, warning) {
    const recommendations = [];

    if (!quota) {
        recommendations.push({
            type: 'error',
            title: 'Upload-Post未配置',
            message: '请先在Upload-Post配置页面设置API Key和Profile上限'
        });
        return recommendations;
    }

    if (warning.status === 'critical') {
        recommendations.push({
            type: 'critical',
            title: '配额已满 - 紧急处理',
            message: `当前Profile配额已满（${quota.current_used}/${quota.max_profiles}），无法注册新用户`,
            actions: [
                '立即升级Upload-Post订阅套餐',
                '或删除不活跃用户释放配额'
            ]
        });
    } else if (warning.status === 'warning') {
        recommendations.push({
            type: 'warning',
            title: '配额预警',
            message: `配额使用率已达 ${quota.usage_percent}%，建议提前规划`,
            actions: [
                `还剩 ${quota.available} 个名额`,
                '建议提前升级Upload-Post订阅',
                '或限制新用户注册速度'
            ]
        });
    } else {
        recommendations.push({
            type: 'info',
            title: '配额正常',
            message: `当前使用率 ${quota.usage_percent}%，配额充足`,
            actions: [
                `还可注册 ${quota.available} 个用户`
            ]
        });
    }

    // Upload-Post升级建议
    const upgradePlan = getUploadPostUpgradePlan(quota.current_used);
    if (upgradePlan) {
        recommendations.push({
            type: 'info',
            title: 'Upload-Post订阅建议',
            message: `当前用户数：${quota.current_used}`,
            actions: [
                `建议订阅：${upgradePlan.name} (${upgradePlan.profiles} profiles, $${upgradePlan.price}/月)`,
                `成本：¥${(upgradePlan.price * 7).toFixed(0)}/月`
            ]
        });
    }

    return recommendations;
}

/**
 * 根据用户数推荐Upload-Post订阅套餐
 */
function getUploadPostUpgradePlan(currentUsers) {
    const plans = [
        { name: 'Free', profiles: 2, price: 0 },
        { name: 'Basic', profiles: 5, price: 24 },
        { name: 'Professional', profiles: 25, price: 50 },
        { name: 'Advanced', profiles: 75, price: 147 },
        { name: 'Business', profiles: 225, price: 438 }
    ];

    // 找到第一个能满足需求的套餐（留20%缓冲）
    const requiredProfiles = Math.ceil(currentUsers * 1.2);

    return plans.find(plan => plan.profiles >= requiredProfiles);
}

export default router;
