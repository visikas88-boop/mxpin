import axios from 'axios';
import { query } from '../config/database.js';

/**
 * 获取可用平台列表
 * GET /api/publishing/platforms
 */
export async function getPlatforms(req, res) {
    try {
        const userId = req.user.id;

        // 获取平台列表
        const platformsResult = await query(`
            SELECT * FROM platform_pricing
            WHERE is_enabled = true
            ORDER BY sort_order
        `);

        // 获取用户已连接的平台
        const accountsResult = await query(`
            SELECT platform, COUNT(*) as account_count
            FROM social_accounts
            WHERE user_id = $1 AND is_active = true
            GROUP BY platform
        `, [userId]);

        const connectedPlatforms = {};
        accountsResult.rows.forEach(row => {
            connectedPlatforms[row.platform] = parseInt(row.account_count);
        });

        // 合并数据
        const platforms = platformsResult.rows.map(p => ({
            ...p,
            is_connected: connectedPlatforms[p.platform] > 0,
            connected_accounts: connectedPlatforms[p.platform] || 0
        }));

        res.json({
            success: true,
            data: platforms
        });

    } catch (error) {
        console.error('Get platforms error:', error);
        res.status(500).json({
            success: false,
            message: '获取平台列表失败',
            error: error.message
        });
    }
}

/**
 * 计算发布费用
 * POST /api/publishing/calculate-cost
 */
export async function calculateCost(req, res) {
    try {
        const { platforms } = req.body;

        if (!Array.isArray(platforms) || platforms.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请选择至少一个平台'
            });
        }

        const result = await query(`
            SELECT platform, display_name, points_cost
            FROM platform_pricing
            WHERE platform = ANY($1) AND is_enabled = true
        `, [platforms]);

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: '选择的平台不可用'
            });
        }

        const totalCost = result.rows.reduce((sum, row) => sum + row.points_cost, 0);

        res.json({
            success: true,
            data: {
                platforms: result.rows,
                totalCost: totalCost,
                breakdown: result.rows.map(p => ({
                    platform: p.platform,
                    name: p.display_name,
                    cost: p.points_cost
                }))
            }
        });

    } catch (error) {
        console.error('Calculate cost error:', error);
        res.status(500).json({
            success: false,
            message: '计算费用失败',
            error: error.message
        });
    }
}

/**
 * 创建发布任务
 * POST /api/publishing/create-task
 */
export async function createTask(req, res) {
    try {
        const userId = req.user.id;
        const {
            videoUrl,
            videoTitle,
            videoDescription,
            videoThumbnailUrl,
            targetPlatforms,
            platformSettings,
            scheduledAt
        } = req.body;

        // 1. 参数验证
        if (!videoUrl || !videoTitle) {
            return res.status(400).json({
                success: false,
                message: '视频URL和标题不能为空'
            });
        }

        if (!Array.isArray(targetPlatforms) || targetPlatforms.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请选择至少一个发布平台'
            });
        }

        // 2. 计算积分费用
        const costResult = await query(`
            SELECT SUM(points_cost) as total_cost
            FROM platform_pricing
            WHERE platform = ANY($1) AND is_enabled = true
        `, [targetPlatforms]);

        const pointsCost = parseInt(costResult.rows[0].total_cost) || 0;

        // 3. 检查用户积分余额
        const userResult = await query(
            'SELECT balance_points FROM users WHERE id = $1',
            [userId]
        );

        const userBalance = userResult.rows[0].balance_points;

        if (userBalance < pointsCost) {
            return res.status(400).json({
                success: false,
                message: '积分余额不足',
                data: {
                    required: pointsCost,
                    current: userBalance,
                    deficit: pointsCost - userBalance
                }
            });
        }

        // 4. 验证用户已连接目标平台账号
        const accountsResult = await query(`
            SELECT DISTINCT platform FROM social_accounts
            WHERE user_id = $1 AND platform = ANY($2) AND is_active = true
        `, [userId, targetPlatforms]);

        const connectedPlatforms = accountsResult.rows.map(r => r.platform);
        const missingPlatforms = targetPlatforms.filter(p => !connectedPlatforms.includes(p));

        if (missingPlatforms.length > 0) {
            return res.status(400).json({
                success: false,
                message: '请先连接以下平台账号',
                data: { missingPlatforms }
            });
        }

        // 5. 创建发布任务
        const taskResult = await query(`
            INSERT INTO publishing_tasks
            (user_id, video_url, video_title, video_description, video_thumbnail_url,
             target_platforms, platform_settings, points_cost, scheduled_at, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            userId,
            videoUrl,
            videoTitle,
            videoDescription || '',
            videoThumbnailUrl || '',
            JSON.stringify(targetPlatforms),
            JSON.stringify(platformSettings || {}),
            pointsCost,
            scheduledAt || null,
            scheduledAt ? 'scheduled' : 'pending'
        ]);

        const task = taskResult.rows[0];

        // 6. 如果不是定时任务,立即加入处理队列
        if (!scheduledAt) {
            // 异步处理任务（不等待完成）
            processPublishingTask(task.id).catch(err => {
                console.error('Process task error:', err);
            });
        }

        res.status(201).json({
            success: true,
            message: scheduledAt ? '定时发布任务创建成功' : '发布任务创建成功，正在处理中',
            data: task
        });

    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({
            success: false,
            message: '创建任务失败',
            error: error.message
        });
    }
}

/**
 * 处理发布任务（异步函数）
 */
async function processPublishingTask(taskId) {
    const startTime = Date.now();

    try {
        console.log(`[Task ${taskId}] Starting processing...`);

        // 更新任务状态
        await query(
            `UPDATE publishing_tasks
             SET status = 'processing', started_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [taskId]
        );

        // 获取任务详情
        const taskResult = await query(`
            SELECT pt.*, u.id as user_id
            FROM publishing_tasks pt
            JOIN users u ON pt.user_id = u.id
            WHERE pt.id = $1
        `, [taskId]);

        const task = taskResult.rows[0];

        // 扣除积分
        if (!task.points_deducted) {
            await deductPoints(task.user_id, task.points_cost, taskId);
        }

        // 获取Upload-Post配置
        const configResult = await query(
            'SELECT api_key, api_url FROM upload_post_config WHERE is_active = true LIMIT 1'
        );

        if (configResult.rows.length === 0) {
            throw new Error('Upload-Post配置未设置');
        }

        const { api_key, api_url } = configResult.rows[0];

        // 获取用户的社交账号tokens
        const targetPlatforms = JSON.parse(task.target_platforms);
        const accountsResult = await query(`
            SELECT platform, access_token, account_name
            FROM social_accounts
            WHERE user_id = $1 AND platform = ANY($2) AND is_active = true
        `, [task.user_id, targetPlatforms]);

        const results = [];

        // 逐个平台发布
        for (const account of accountsResult.rows) {
            const platformStartTime = Date.now();

            try {
                console.log(`[Task ${taskId}] Publishing to ${account.platform}...`);

                const platformSettings = JSON.parse(task.platform_settings)[account.platform] || {};

                // 调用Upload-Post API
                const response = await axios.post(
                    `${api_url}/api/upload`,
                    {
                        platform: account.platform,
                        access_token: account.access_token,
                        video_url: task.video_url,
                        title: task.video_title,
                        description: task.video_description,
                        thumbnail_url: task.video_thumbnail_url,
                        ...platformSettings
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${api_key}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 120000 // 2分钟超时
                    }
                );

                const processingTime = Date.now() - platformStartTime;

                // 记录成功日志
                await query(`
                    INSERT INTO publishing_logs
                    (task_id, platform, status, post_url, platform_post_id, response_data, processing_time_ms)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    taskId,
                    account.platform,
                    'success',
                    response.data.post_url || response.data.url,
                    response.data.post_id || response.data.id,
                    JSON.stringify(response.data),
                    processingTime
                ]);

                results.push({
                    platform: account.platform,
                    status: 'success',
                    postUrl: response.data.post_url || response.data.url,
                    postId: response.data.post_id || response.data.id
                });

                console.log(`[Task ${taskId}] ${account.platform} published successfully`);

            } catch (platformError) {
                console.error(`[Task ${taskId}] Platform ${account.platform} error:`, platformError.message);

                const processingTime = Date.now() - platformStartTime;
                const errorData = platformError.response?.data || {};

                // 记录失败日志
                await query(`
                    INSERT INTO publishing_logs
                    (task_id, platform, status, error_code, error_message, response_data, processing_time_ms)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    taskId,
                    account.platform,
                    'failed',
                    errorData.code || 'UNKNOWN_ERROR',
                    platformError.message,
                    JSON.stringify(errorData),
                    processingTime
                ]);

                results.push({
                    platform: account.platform,
                    status: 'failed',
                    error: platformError.message,
                    errorCode: errorData.code
                });
            }
        }

        // 更新任务最终状态
        const successCount = results.filter(r => r.status === 'success').length;
        const finalStatus = successCount === 0 ? 'failed' :
                           successCount === results.length ? 'completed' :
                           'partial_success';

        await query(`
            UPDATE publishing_tasks
            SET status = $1, completed_at = CURRENT_TIMESTAMP, results = $2
            WHERE id = $3
        `, [finalStatus, JSON.stringify(results), taskId]);

        const totalTime = Date.now() - startTime;
        console.log(`[Task ${taskId}] Completed with status: ${finalStatus} (${totalTime}ms)`);

    } catch (error) {
        console.error(`[Task ${taskId}] Process error:`, error);

        // 更新任务状态为失败
        await query(`
            UPDATE publishing_tasks
            SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [error.message, taskId]);

        // 如果积分已扣除但任务失败，退还积分
        const taskCheck = await query(
            'SELECT points_deducted, points_cost, user_id FROM publishing_tasks WHERE id = $1',
            [taskId]
        );

        if (taskCheck.rows[0]?.points_deducted) {
            await refundPoints(taskCheck.rows[0].user_id, taskCheck.rows[0].points_cost, taskId);
        }
    }
}

/**
 * 扣除积分并记录交易
 */
async function deductPoints(userId, amount, taskId) {
    const client = await query.pool.connect();

    try {
        await client.query('BEGIN');

        // 扣除积分
        const updateResult = await client.query(`
            UPDATE users
            SET balance_points = balance_points - $1,
                total_consumed = total_consumed + $1
            WHERE id = $2 AND balance_points >= $1
            RETURNING balance_points
        `, [amount, userId]);

        if (updateResult.rows.length === 0) {
            throw new Error('积分余额不足');
        }

        const newBalance = updateResult.rows[0].balance_points;

        // 记录交易
        await client.query(`
            INSERT INTO points_transactions
            (user_id, type, amount, balance_after, description, related_order_id)
            VALUES ($1, 'publish', $2, $3, $4, $5)
        `, [
            userId,
            -amount,
            newBalance,
            `视频发布消耗积分 (任务ID: ${taskId})`,
            `task_${taskId}`
        ]);

        // 标记任务积分已扣除
        await client.query(
            'UPDATE publishing_tasks SET points_deducted = true WHERE id = $1',
            [taskId]
        );

        await client.query('COMMIT');
        console.log(`[Task ${taskId}] Points deducted: ${amount}, new balance: ${newBalance}`);

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 退还积分
 */
async function refundPoints(userId, amount, taskId) {
    const client = await query.pool.connect();

    try {
        await client.query('BEGIN');

        // 退还积分
        const updateResult = await client.query(`
            UPDATE users
            SET balance_points = balance_points + $1,
                total_consumed = total_consumed - $1
            WHERE id = $2
            RETURNING balance_points
        `, [amount, userId]);

        const newBalance = updateResult.rows[0].balance_points;

        // 记录交易
        await client.query(`
            INSERT INTO points_transactions
            (user_id, type, amount, balance_after, description, related_order_id)
            VALUES ($1, 'refund', $2, $3, $4, $5)
        `, [
            userId,
            amount,
            newBalance,
            `发布失败退还积分 (任务ID: ${taskId})`,
            `task_${taskId}_refund`
        ]);

        await client.query('COMMIT');
        console.log(`[Task ${taskId}] Points refunded: ${amount}, new balance: ${newBalance}`);

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 获取任务列表
 * GET /api/publishing/tasks
 */
export async function getTasks(req, res) {
    try {
        const userId = req.user.id;
        const { status, limit = 20, offset = 0 } = req.query;

        let queryText = `
            SELECT
                pt.*,
                (SELECT COUNT(*) FROM publishing_logs WHERE task_id = pt.id AND status = 'success') as success_count,
                (SELECT COUNT(*) FROM publishing_logs WHERE task_id = pt.id AND status = 'failed') as failed_count
            FROM publishing_tasks pt
            WHERE pt.user_id = $1
        `;

        const params = [userId];

        if (status) {
            queryText += ` AND pt.status = $${params.length + 1}`;
            params.push(status);
        }

        queryText += ` ORDER BY pt.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(queryText, params);

        // 获取总数
        let countQuery = 'SELECT COUNT(*) FROM publishing_tasks WHERE user_id = $1';
        const countParams = [userId];

        if (status) {
            countQuery += ' AND status = $2';
            countParams.push(status);
        }

        const countResult = await query(countQuery, countParams);

        res.json({
            success: true,
            data: {
                tasks: result.rows,
                total: parseInt(countResult.rows[0].count),
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
}

/**
 * 获取任务详情
 * GET /api/publishing/tasks/:taskId
 */
export async function getTaskDetail(req, res) {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;

        const taskResult = await query(
            'SELECT * FROM publishing_tasks WHERE id = $1 AND user_id = $2',
            [taskId, userId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }

        const task = taskResult.rows[0];

        // 获取发布日志
        const logsResult = await query(`
            SELECT
                pl.*,
                pp.display_name as platform_display_name,
                pp.icon_url as platform_icon
            FROM publishing_logs pl
            LEFT JOIN platform_pricing pp ON pl.platform = pp.platform
            WHERE pl.task_id = $1
            ORDER BY pl.created_at DESC
        `, [taskId]);

        res.json({
            success: true,
            data: {
                task: task,
                logs: logsResult.rows
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
}

/**
 * 重试失败任务
 * POST /api/publishing/tasks/:taskId/retry
 */
export async function retryTask(req, res) {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;

        // 检查任务状态
        const taskResult = await query(`
            SELECT * FROM publishing_tasks
            WHERE id = $1 AND user_id = $2 AND status IN ('failed', 'partial_success')
        `, [taskId, userId]);

        if (taskResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: '任务不存在或当前状态无法重试'
            });
        }

        const task = taskResult.rows[0];

        if (task.retry_count >= task.max_retries) {
            return res.status(400).json({
                success: false,
                message: `已达到最大重试次数 (${task.max_retries})`
            });
        }

        // 更新重试次数和状态
        await query(
            `UPDATE publishing_tasks
             SET retry_count = retry_count + 1, status = 'pending', error_message = NULL
             WHERE id = $1`,
            [taskId]
        );

        // 重新处理任务
        processPublishingTask(taskId).catch(err => {
            console.error('Retry task error:', err);
        });

        res.json({
            success: true,
            message: '任务已加入重试队列',
            data: {
                retryCount: task.retry_count + 1,
                maxRetries: task.max_retries
            }
        });

    } catch (error) {
        console.error('Retry task error:', error);
        res.status(500).json({
            success: false,
            message: '重试任务失败',
            error: error.message
        });
    }
}

/**
 * 取消任务
 * DELETE /api/publishing/tasks/:taskId
 */
export async function cancelTask(req, res) {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;

        // 只能取消pending或scheduled状态的任务
        const result = await query(`
            UPDATE publishing_tasks
            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'scheduled')
            RETURNING *
        `, [taskId, userId]);

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: '任务不存在或当前状态无法取消'
            });
        }

        // 如果积分已扣除，退还积分
        const task = result.rows[0];
        if (task.points_deducted) {
            await refundPoints(userId, task.points_cost, taskId);
        }

        res.json({
            success: true,
            message: '任务已取消',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Cancel task error:', error);
        res.status(500).json({
            success: false,
            message: '取消任务失败',
            error: error.message
        });
    }
}
