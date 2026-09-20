import { query } from '../config/database.js';

/**
 * 获取所有用户的发布任务
 * GET /api/admin/publishing/tasks
 */
export async function getAllTasks(req, res) {
    try {
        const { status, userId, platform, limit = 50, offset = 0 } = req.query;

        let queryText = `
            SELECT
                pt.*,
                u.username,
                u.email,
                (SELECT COUNT(*) FROM publishing_logs WHERE task_id = pt.id AND status = 'success') as success_count,
                (SELECT COUNT(*) FROM publishing_logs WHERE task_id = pt.id AND status = 'failed') as failed_count
            FROM publishing_tasks pt
            JOIN users u ON pt.user_id = u.id
            WHERE 1=1
        `;

        const params = [];

        if (status) {
            params.push(status);
            queryText += ` AND pt.status = $${params.length}`;
        }

        if (userId) {
            params.push(userId);
            queryText += ` AND pt.user_id = $${params.length}`;
        }

        if (platform) {
            params.push(`%"${platform}"%`);
            queryText += ` AND pt.target_platforms::text LIKE $${params.length}`;
        }

        queryText += ` ORDER BY pt.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(queryText, params);

        // 获取总数
        let countQuery = 'SELECT COUNT(*) FROM publishing_tasks pt WHERE 1=1';
        const countParams = [];

        if (status) {
            countParams.push(status);
            countQuery += ` AND pt.status = $${countParams.length}`;
        }

        if (userId) {
            countParams.push(userId);
            countQuery += ` AND pt.user_id = $${countParams.length}`;
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
        console.error('Get all tasks error:', error);
        res.status(500).json({
            success: false,
            message: '获取任务列表失败',
            error: error.message
        });
    }
}

/**
 * 获取发布统计数据
 * GET /api/admin/publishing/stats
 */
export async function getPublishingStats(req, res) {
    try {
        // 总体统计
        const overallStats = await query(`
            SELECT
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_tasks,
                COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_tasks,
                COUNT(CASE WHEN status = 'partial_success' THEN 1 END) as partial_success_tasks,
                SUM(points_cost) as total_points_consumed,
                COUNT(DISTINCT user_id) as active_users
            FROM publishing_tasks
        `);

        // 平台统计
        const platformStats = await query(`
            SELECT
                pl.platform,
                pp.display_name,
                COUNT(pl.id) as total_publishes,
                COUNT(CASE WHEN pl.status = 'success' THEN 1 END) as success_count,
                COUNT(CASE WHEN pl.status = 'failed' THEN 1 END) as failed_count,
                ROUND(
                    COUNT(CASE WHEN pl.status = 'success' THEN 1 END)::numeric /
                    NULLIF(COUNT(pl.id), 0) * 100,
                    2
                ) as success_rate,
                AVG(pl.processing_time_ms) as avg_processing_time_ms
            FROM publishing_logs pl
            LEFT JOIN platform_pricing pp ON pl.platform = pp.platform
            GROUP BY pl.platform, pp.display_name
            ORDER BY total_publishes DESC
        `);

        // 每日发布趋势（最近30天）
        const dailyTrend = await query(`
            SELECT
                DATE(created_at) as date,
                COUNT(*) as task_count,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                SUM(points_cost) as points_consumed
            FROM publishing_tasks
            WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `);

        // Top用户统计
        const topUsers = await query(`
            SELECT
                u.id,
                u.username,
                u.email,
                COUNT(pt.id) as task_count,
                SUM(pt.points_cost) as total_points_spent,
                COUNT(CASE WHEN pt.status = 'completed' THEN 1 END) as successful_tasks
            FROM users u
            JOIN publishing_tasks pt ON u.id = pt.user_id
            GROUP BY u.id, u.username, u.email
            ORDER BY task_count DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            data: {
                overall: overallStats.rows[0],
                platforms: platformStats.rows,
                dailyTrend: dailyTrend.rows,
                topUsers: topUsers.rows
            }
        });

    } catch (error) {
        console.error('Get publishing stats error:', error);
        res.status(500).json({
            success: false,
            message: '获取统计数据失败',
            error: error.message
        });
    }
}

/**
 * 更新平台定价
 * PUT /api/admin/publishing/platforms/:id
 */
export async function updatePlatformPricing(req, res) {
    try {
        const { id } = req.params;
        const {
            points_cost,
            is_enabled,
            display_name,
            display_name_en,
            description,
            description_en,
            sort_order
        } = req.body;

        const result = await query(`
            UPDATE platform_pricing
            SET
                points_cost = COALESCE($1, points_cost),
                is_enabled = COALESCE($2, is_enabled),
                display_name = COALESCE($3, display_name),
                display_name_en = COALESCE($4, display_name_en),
                description = COALESCE($5, description),
                description_en = COALESCE($6, description_en),
                sort_order = COALESCE($7, sort_order),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8
            RETURNING *
        `, [
            points_cost,
            is_enabled,
            display_name,
            display_name_en,
            description,
            description_en,
            sort_order,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '平台不存在'
            });
        }

        res.json({
            success: true,
            message: '平台配置已更新',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Update platform pricing error:', error);
        res.status(500).json({
            success: false,
            message: '更新平台配置失败',
            error: error.message
        });
    }
}

/**
 * 获取发布日志
 * GET /api/admin/publishing/logs
 */
export async function getPublishingLogs(req, res) {
    try {
        const { taskId, platform, status, limit = 100, offset = 0 } = req.query;

        let queryText = `
            SELECT
                pl.*,
                pt.video_title,
                pt.user_id,
                u.username,
                pp.display_name as platform_display_name
            FROM publishing_logs pl
            JOIN publishing_tasks pt ON pl.task_id = pt.id
            JOIN users u ON pt.user_id = u.id
            LEFT JOIN platform_pricing pp ON pl.platform = pp.platform
            WHERE 1=1
        `;

        const params = [];

        if (taskId) {
            params.push(taskId);
            queryText += ` AND pl.task_id = $${params.length}`;
        }

        if (platform) {
            params.push(platform);
            queryText += ` AND pl.platform = $${params.length}`;
        }

        if (status) {
            params.push(status);
            queryText += ` AND pl.status = $${params.length}`;
        }

        queryText += ` ORDER BY pl.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(queryText, params);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Get publishing logs error:', error);
        res.status(500).json({
            success: false,
            message: '获取日志失败',
            error: error.message
        });
    }
}

/**
 * 获取Upload-Post配置
 * GET /api/admin/publishing/config
 */
export async function getUploadPostConfig(req, res) {
    try {
        const result = await query(`
            SELECT
                id,
                api_url,
                webhook_url,
                is_active,
                rate_limit_per_minute,
                timeout_seconds,
                retry_enabled,
                LEFT(api_key, 10) || '...' as api_key_preview,
                created_at,
                updated_at
            FROM upload_post_config
            ORDER BY id DESC
            LIMIT 1
        `);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '配置不存在'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Get upload post config error:', error);
        res.status(500).json({
            success: false,
            message: '获取配置失败',
            error: error.message
        });
    }
}

/**
 * 更新Upload-Post配置
 * PUT /api/admin/publishing/config
 */
export async function updateUploadPostConfig(req, res) {
    try {
        const {
            api_key,
            api_url,
            webhook_url,
            webhook_secret,
            is_active,
            rate_limit_per_minute,
            timeout_seconds,
            retry_enabled
        } = req.body;

        // 检查是否已有配置
        const existingConfig = await query('SELECT id FROM upload_post_config LIMIT 1');

        let result;

        if (existingConfig.rows.length > 0) {
            // 更新现有配置
            result = await query(`
                UPDATE upload_post_config
                SET
                    api_key = COALESCE($1, api_key),
                    api_url = COALESCE($2, api_url),
                    webhook_url = COALESCE($3, webhook_url),
                    webhook_secret = COALESCE($4, webhook_secret),
                    is_active = COALESCE($5, is_active),
                    rate_limit_per_minute = COALESCE($6, rate_limit_per_minute),
                    timeout_seconds = COALESCE($7, timeout_seconds),
                    retry_enabled = COALESCE($8, retry_enabled),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $9
                RETURNING id, api_url, webhook_url, is_active, rate_limit_per_minute, timeout_seconds, retry_enabled
            `, [
                api_key,
                api_url,
                webhook_url,
                webhook_secret,
                is_active,
                rate_limit_per_minute,
                timeout_seconds,
                retry_enabled,
                existingConfig.rows[0].id
            ]);
        } else {
            // 创建新配置
            result = await query(`
                INSERT INTO upload_post_config
                (api_key, api_url, webhook_url, webhook_secret, is_active, rate_limit_per_minute, timeout_seconds, retry_enabled)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, api_url, webhook_url, is_active, rate_limit_per_minute, timeout_seconds, retry_enabled
            `, [
                api_key,
                api_url || 'https://api.upload-post.com',
                webhook_url,
                webhook_secret,
                is_active !== undefined ? is_active : true,
                rate_limit_per_minute || 60,
                timeout_seconds || 120,
                retry_enabled !== undefined ? retry_enabled : true
            ]);
        }

        res.json({
            success: true,
            message: '配置已更新',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Update upload post config error:', error);
        res.status(500).json({
            success: false,
            message: '更新配置失败',
            error: error.message
        });
    }
}
