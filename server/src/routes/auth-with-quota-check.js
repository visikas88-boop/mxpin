// =====================================================
// 用户注册 - 增加Profile配额检查
// 路径: server/src/routes/auth.js 或相应的注册路由
// 说明: 在用户注册时检查Upload-Post Profile配额
// =====================================================

import express from 'express';
import pool from '../config/database.js';
import uploadPostService from '../services/uploadPostService.js';

const router = express.Router();

/**
 * 用户注册（增强版 - 带Profile配额检查）
 */
router.post('/register', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { username, email, password } = req.body;

        // 验证输入...

        // ⭐ 新增：检查Profile配额
        const quotaResult = await client.query('SELECT * FROM get_profile_quota_info()');
        const quota = quotaResult.rows[0];

        if (!quota || quota.is_full) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: '系统用户数已达上限，暂停注册',
                error: 'PROFILE_QUOTA_EXCEEDED',
                data: {
                    max_profiles: quota?.max_profiles || 0,
                    current_used: quota?.current_used || 0,
                    message: '当前系统已达到Upload-Post订阅的Profile上限，请联系管理员升级订阅。'
                }
            });
        }

        // 如果接近上限，记录警告日志
        if (quota.is_warning) {
            console.warn(`⚠️ Profile配额预警: ${quota.current_used}/${quota.max_profiles} (${quota.usage_percent}%)`);
        }

        // 创建用户（现有逻辑）
        const userResult = await client.query(`
            INSERT INTO users (username, email, password_hash)
            VALUES ($1, $2, $3)
            RETURNING id, username, email
        `, [username, email, hashedPassword]);

        const user = userResult.rows[0];

        // ⭐ 创建Upload-Post Profile（触发器会自动检查配额）
        try {
            await uploadPostService.createUserProfile(user.id, username);
        } catch (error) {
            // 如果Profile创建失败（配额满），回滚整个注册
            if (error.message.includes('Profile配额已满')) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: '系统用户数已达上限',
                    error: 'PROFILE_QUOTA_EXCEEDED'
                });
            }
            throw error;
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: '注册成功',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                }
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: '注册失败',
            error: error.message
        });
    } finally {
        client.release();
    }
});

/**
 * 检查是否可以注册新用户（公开端点）
 */
router.get('/can-register', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM get_profile_quota_info()');
        const quota = result.rows[0];

        if (!quota) {
            return res.json({
                success: false,
                can_register: false,
                message: 'Upload-Post未配置'
            });
        }

        res.json({
            success: true,
            can_register: !quota.is_full,
            data: {
                available_slots: quota.available,
                usage_percent: quota.usage_percent,
                message: quota.is_full
                    ? '系统用户数已达上限，暂停注册'
                    : quota.is_warning
                    ? '注册名额即将用完，请尽快注册'
                    : '可以正常注册'
            }
        });
    } catch (error) {
        console.error('Check register error:', error);
        res.status(500).json({
            success: false,
            message: '检查失败',
            error: error.message
        });
    }
});

export default router;
