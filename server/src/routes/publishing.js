// =====================================================
// 多平台发布 - API路由
// 路径: server/src/routes/publishing.js
// 说明: 视频发布到多个社交平台
// =====================================================

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';
import uploadPostService from '../services/uploadPostService.js';

const router = express.Router();

/**
 * 1. 创建发布任务
 */
router.post('/tasks', authenticateToken, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const userId = req.user.id;
        const { video_url, title, description, thumbnail_url, target_platforms, scheduled_time } = req.body;

        // 验证必填字段
        if (!video_url || !title || !target_platforms || target_platforms.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: '请提供视频URL、标题和目标平台'
            });
        }

        // 1. 检查用户订阅状态
        const subscriptionResult = await client.query(`
            SELECT * FROM user_subscriptions
            WHERE user_id = $1 AND status = 'active'
        `, [userId]);

        if (subscriptionResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                success: false,
                message: '请先订阅套餐以使用多平台发布功能',
                redirect: '/pricing'
            });
        }

        const subscription = subscriptionResult.rows[0];

        // 2. 检查Profile配额
        const accountsResult = await client.query(`
            SELECT COUNT(*) as count
            FROM social_accounts
            WHERE user_id = $1 AND is_active = true
        `, [userId]);

        const connectedCount = parseInt(accountsResult.rows[0].count);

        if (connectedCount > subscription.max_social_profiles) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: `当前套餐最多支持${subscription.max_social_profiles}个社交账号，您已连接${connectedCount}个，请升级套餐或删除部分账号`
            });
        }

        // 3. 检查发布次数限制
        const canPublishResult = await client.query(
            'SELECT can_publish($1) as can_publish, get_remaining_publishes($1) as remaining',
            [userId]
        );

        if (!canPublishResult.rows[0].can_publish) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: '本月发布次数已达上限，请升级套餐',
                data: {
                    remaining: 0,
                    limit: subscription.max_monthly_publishes
                }
            });
        }

        // 4. 验证目标平台账号已连接
        const platformAccountsResult = await client.query(`
            SELECT platform
            FROM social_accounts
            WHERE user_id = $1 AND platform = ANY($2) AND is_active = true
        `, [userId, target_platforms]);

        const connectedPlatforms = platformAccountsResult.rows.map(r => r.platform);
        const missingPlatforms = target_platforms.filter(p => !connectedPlatforms.includes(p));

        if (missingPlatforms.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: '请先连接以下平台账号',
                data: {
                    missing_platforms: missingPlatforms
                }
            });
        }

        // 5. 获取用户的Upload-Post Profile
        const profileResult = await client.query(
            'SELECT upload_post_user FROM user_upload_post_profiles WHERE user_id = $1',
            [userId]
        );

        if (profileResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: '未找到Upload-Post Profile，请先连接社交账号'
            });
        }

        const uploadPostUser = profileResult.rows[0].upload_post_user;

        // 6. 创建发布任务记录
        const taskResult = await client.query(`
            INSERT INTO publishing_tasks
            (user_id, video_url, video_title, video_description, thumbnail_url,
             target_platforms, upload_post_user, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
            RETURNING *
        `, [
            userId,
            video_url,
            title,
            description,
            thumbnail_url,
            JSON.stringify(target_platforms),
            uploadPostUser
        ]);

        const task = taskResult.rows[0];

        await client.query('COMMIT');

        // 7. 异步提交到Upload-Post
        processPublishTask(task.id, scheduled_time).catch(err => {
            console.error('Process publish task error:', err);
        });

        res.status(201).json({
            success: true,
            message: '发布任务已创建',
            data: {
                task_id: task.id,
                status: task.status,
                target_platforms: target_platforms,
                remaining_publishes: canPublishResult.rows[0].remaining
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create publish task error:', error);
        res.status(500).json({
            success: false,
            message: '创建发布任务失败',
            error: error.message
        });
    } finally {
        client.release();
    }
});

/**
 * 异步处理发布任务
 */
async function processPublishTask(taskId, scheduledTime = null) {
    try {
        console.log(`📤 Processing publish task: ${taskId}`);

        // 1. 获取任务信息
        const taskResult = await pool.query(
            'SELECT * FROM publishing_tasks WHERE id = $1',
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            console.error('Task not found:', taskId);
            return;
        }

        const task = taskResult.rows[0];

        // 2. 更新状态为processing
        await pool.query(
            'UPDATE publishing_tasks SET status = $1, submitted_at = NOW() WHERE id = $2',
            ['processing', taskId]
        );

        // 3. 调用Upload-Post API
        console.log('📡 Uploading to Upload-Post...', {
            user: task.upload_post_user,
            platforms: JSON.parse(task.target_platforms)
        });

        const uploadResult = await uploadPostService.uploadVideo({
            uploadPostUser: task.upload_post_user,
            videoUrl: task.video_url,
            title: task.video_title,
            description: task.video_description,
            thumbnailUrl: task.thumbnail_url,
            platforms: JSON.parse(task.target_platforms),
            scheduledTime: scheduledTime
        });

        if (!uploadResult.success) {
            console.error('Upload failed:', uploadResult.error);
            await pool.query(`
                UPDATE publishing_tasks
                SET status = 'failed', error_message = $1, completed_at = NOW()
                WHERE id = $2
            `, [uploadResult.error, taskId]);
            return;
        }

        console.log('✅ Upload submitted to Upload-Post:', uploadResult.data);

        // 4. 保存job ID
        const jobId = uploadResult.data.id || uploadResult.data.job_id || uploadResult.data.upload_id;
        await pool.query(
            'UPDATE publishing_tasks SET upload_post_job_id = $1 WHERE id = $2',
            [jobId, taskId]
        );

        // 5. 如果是定时发布，标记为scheduled
        if (scheduledTime) {
            await pool.query(`
                UPDATE publishing_tasks
                SET status = 'scheduled', completed_at = NOW()
                WHERE id = $1
            `, [taskId]);
            console.log('⏰ Task scheduled for:', scheduledTime);
            return;
        }

        // 6. 轮询检查状态
        await pollUploadStatus(taskId, jobId);

    } catch (error) {
        console.error('Process publish task error:', error);
        await pool.query(`
            UPDATE publishing_tasks
            SET status = 'failed', error_message = $1, completed_at = NOW()
            WHERE id = $2
        `, [error.message, taskId]);
    }
}

/**
 * 轮询上传状态
 */
async function pollUploadStatus(taskId, jobId, maxAttempts = 60, interval = 5000) {
    let attempts = 0;

    console.log(`🔄 Polling status for job: ${jobId}`);

    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, interval));
        attempts++;

        const statusResult = await uploadPostService.getUploadStatus(jobId);

        if (!statusResult.success) {
            console.error(`Poll attempt ${attempts} failed:`, statusResult.error);
            continue;
        }

        const status = statusResult.data.status;
        const results = statusResult.data.results || statusResult.data.platforms || [];

        console.log(`📊 Status check ${attempts}/${maxAttempts}:`, status, results);

        // 检查是否完成
        if (status === 'completed' || status === 'failed' || status === 'partial') {
            console.log('✅ Upload completed:', status);

            // 保存每个平台的结果
            for (const result of results) {
                await pool.query(`
                    INSERT INTO publishing_logs
                    (task_id, platform, status, platform_post_id, platform_post_url,
                     error_code, error_message, raw_response)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    taskId,
                    result.platform || result.type,
                    result.status || result.state,
                    result.post_id || result.id,
                    result.post_url || result.url,
                    result.error_code,
                    result.error_message || result.error,
                    JSON.stringify(result)
                ]);
            }

            // 更新任务状态
            const finalStatus = status === 'completed' ? 'completed' :
                                status === 'partial' ? 'partial_success' : 'failed';

            await pool.query(`
                UPDATE publishing_tasks
                SET status = $1, completed_at = NOW()
                WHERE id = $2
            `, [finalStatus, taskId]);

            break;
        }

        // 如果还在处理中，继续轮询
        if (status === 'processing' || status === 'pending' || status === 'uploading') {
            console.log(`⏳ Still processing... (${attempts}/${maxAttempts})`);
            continue;
        }

        // 未知状态，记录日志但继续轮询
        console.warn('Unknown status:', status);
    }

    if (attempts >= maxAttempts) {
        console.error('⚠️ Polling timeout for task:', taskId);
        await pool.query(`
            UPDATE publishing_tasks
            SET status = 'failed', error_message = 'Upload status check timeout', completed_at = NOW()
            WHERE id = $1
        `, [taskId]);
    }
}

/**
 * 2. 获取用户的发布任务列表
 */
router.get('/tasks', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, limit = 20, offset = 0 } = req.query;

        let query = `
            SELECT
                pt.*,
                (
                    SELECT json_agg(json_build_object(
                        'platform', pl.platform,
                        'status', pl.status,
                        'post_url', pl.platform_post_url,
                        'error_message', pl.error_message
                    ))
                    FROM publishing_logs pl
                    WHERE pl.task_id = pt.id
                ) as platform_results
            FROM publishing_tasks pt
            WHERE pt.user_id = $1
        `;

        const params = [userId];
        let paramIndex = 2;

        if (status) {
            query += ` AND pt.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        query += ` ORDER BY pt.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        // 获取总数
        const countResult = await pool.query(
            'SELECT COUNT(*) as total FROM publishing_tasks WHERE user_id = $1' +
            (status ? ' AND status = $2' : ''),
            status ? [userId, status] : [userId]
        );

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
        console.error('Get tasks error:', error);
        res.status(500).json({
            success: false,
            message: '获取任务列表失败',
            error: error.message
        });
    }
});

/**
 * 3. 获取单个任务详情
 */
router.get('/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const taskId = req.params.id;

        const taskResult = await pool.query(`
            SELECT * FROM publishing_tasks
            WHERE id = $1 AND user_id = $2
        `, [taskId, userId]);

        if (taskResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }

        const task = taskResult.rows[0];

        // 获取各平台的发布结果
        const logsResult = await pool.query(`
            SELECT * FROM publishing_logs
            WHERE task_id = $1
            ORDER BY created_at
        `, [taskId]);

        res.json({
            success: true,
            data: {
                ...task,
                platform_logs: logsResult.rows
            }
        });

    } catch (error) {
        console.error('Get task detail error:', error);
        res.status(500).json({
            success: false,
            message: '获取任务详情失败',
            error: error.message
        });
    }
});

/**
 * 4. 重试失败的任务
 */
router.post('/tasks/:id/retry', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const taskId = req.params.id;

        const taskResult = await pool.query(`
            SELECT * FROM publishing_tasks
            WHERE id = $1 AND user_id = $2 AND status IN ('failed', 'partial_success')
        `, [taskId, userId]);

        if (taskResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '任务不存在或不可重试'
            });
        }

        // 重置任务状态
        await pool.query(`
            UPDATE publishing_tasks
            SET status = 'pending', error_message = NULL, upload_post_job_id = NULL
            WHERE id = $1
        `, [taskId]);

        // 重新处理
        const task = taskResult.rows[0];
        processPublishTask(taskId).catch(err => {
            console.error('Retry task error:', err);
        });

        res.json({
            success: true,
            message: '任务已重新提交'
        });

    } catch (error) {
        console.error('Retry task error:', error);
        res.status(500).json({
            success: false,
            message: '重试任务失败',
            error: error.message
        });
    }
});

/**
 * 5. 取消任务
 */
router.delete('/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const taskId = req.params.id;

        const taskResult = await pool.query(`
            SELECT * FROM publishing_tasks
            WHERE id = $1 AND user_id = $2
        `, [taskId, userId]);

        if (taskResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }

        const task = taskResult.rows[0];

        // 如果有job ID，尝试取消Upload-Post的任务
        if (task.upload_post_job_id && task.status === 'processing') {
            await uploadPostService.cancelUpload(task.upload_post_job_id);
        }

        // 删除任务
        await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);

        res.json({
            success: true,
            message: '任务已取消'
        });

    } catch (error) {
        console.error('Cancel task error:', error);
        res.status(500).json({
            success: false,
            message: '取消任务失败',
            error: error.message
        });
    }
});

/**
 * 6. 获取发布统计
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(`
            SELECT
                COUNT(*) as total_tasks,
                COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
                COUNT(*) FILTER (WHERE status = 'failed') as failed_tasks,
                COUNT(*) FILTER (WHERE status = 'processing') as processing_tasks,
                COUNT(*) FILTER (WHERE status = 'partial_success') as partial_tasks,
                (
                    SELECT get_remaining_publishes($1)
                ) as remaining_publishes
            FROM publishing_tasks
            WHERE user_id = $1
        `, [userId]);

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: '获取统计数据失败',
            error: error.message
        });
    }
});

export default router;
