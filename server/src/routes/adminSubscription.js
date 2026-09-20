// =====================================================
// 套餐管理 - 后端API路由
// 路径: server/src/routes/adminSubscription.js
// =====================================================

import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

// =====================================================
// 1. 获取所有套餐（带利润统计）
// =====================================================
router.get('/plans', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                sp.*,
                COALESCE(subscriber_stats.count, 0) as subscriber_count,
                COALESCE(subscriber_stats.monthly_revenue, 0) as actual_monthly_revenue,
                COALESCE(subscriber_stats.monthly_cost, 0) as actual_monthly_cost,
                COALESCE(subscriber_stats.monthly_profit, 0) as actual_monthly_profit
            FROM subscription_plans sp
            LEFT JOIN (
                SELECT
                    us.plan_id,
                    COUNT(*) as count,
                    SUM(us.price) as monthly_revenue,
                    SUM(sp2.total_cost) as monthly_cost,
                    SUM(sp2.profit_amount) as monthly_profit
                FROM user_subscriptions us
                JOIN subscription_plans sp2 ON us.plan_id = sp2.plan_id
                WHERE us.status = 'active'
                GROUP BY us.plan_id
            ) subscriber_stats ON sp.plan_id = subscriber_stats.plan_id
            ORDER BY sp.sort_order
        `);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({
            success: false,
            message: '获取套餐列表失败',
            error: error.message
        });
    }
});

// =====================================================
// 2. 获取单个套餐详情
// =====================================================
router.get('/plans/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'SELECT * FROM subscription_plans WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '套餐不存在'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Get plan error:', error);
        res.status(500).json({
            success: false,
            message: '获取套餐详情失败',
            error: error.message
        });
    }
});

// =====================================================
// 3. 创建新套餐
// =====================================================
router.post('/plans', authenticateToken, requireAdmin, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const {
            plan_id,
            plan_name,
            plan_name_en,
            price_monthly,
            price_yearly,
            monthly_credits,
            max_social_profiles,
            max_monthly_publishes = -1,
            upload_post_cost,
            ai_generation_cost = 0,
            features,
            feature_list,
            description,
            description_en,
            is_enabled = true,
            is_visible = true,
            is_popular = false,
            sort_order = 0,
            badge_text,
            badge_color = 'purple'
        } = req.body;

        // 检查plan_id是否已存在
        const existCheck = await client.query(
            'SELECT id FROM subscription_plans WHERE plan_id = $1',
            [plan_id]
        );

        if (existCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: '套餐ID已存在'
            });
        }

        // 插入新套餐
        const result = await client.query(`
            INSERT INTO subscription_plans (
                plan_id, plan_name, plan_name_en, price_monthly, price_yearly,
                monthly_credits, max_social_profiles, max_monthly_publishes,
                upload_post_cost, ai_generation_cost, features, feature_list,
                description, description_en, is_enabled, is_visible, is_popular,
                sort_order, badge_text, badge_color
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            RETURNING *
        `, [
            plan_id, plan_name, plan_name_en, price_monthly, price_yearly,
            monthly_credits, max_social_profiles, max_monthly_publishes,
            upload_post_cost, ai_generation_cost, features, feature_list,
            description, description_en, is_enabled, is_visible, is_popular,
            sort_order, badge_text, badge_color
        ]);

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: '套餐创建成功',
            data: result.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create plan error:', error);
        res.status(500).json({
            success: false,
            message: '创建套餐失败',
            error: error.message
        });
    } finally {
        client.release();
    }
});

// =====================================================
// 4. 更新套餐（核心功能 - 支持利润率调整）
// =====================================================
router.put('/plans/:id', authenticateToken, requireAdmin, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { id } = req.params;
        const adminUserId = req.user.id;
        const updates = req.body;

        // 获取旧配置
        const oldPlanResult = await client.query(
            'SELECT * FROM subscription_plans WHERE id = $1',
            [id]
        );

        if (oldPlanResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: '套餐不存在'
            });
        }

        const oldPlan = oldPlanResult.rows[0];

        // 允许更新的字段
        const allowedFields = [
            'plan_name', 'plan_name_en', 'price_monthly', 'price_yearly',
            'monthly_credits', 'max_social_profiles', 'max_monthly_publishes',
            'upload_post_cost', 'ai_generation_cost', 'features', 'feature_list',
            'description', 'description_en', 'is_enabled', 'is_visible',
            'is_popular', 'sort_order', 'badge_text', 'badge_color'
        ];

        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateFields.push(`${field} = $${paramIndex}`);
                updateValues.push(updates[field]);

                // 记录变更历史
                await client.query(`
                    INSERT INTO subscription_plan_history
                    (plan_id, changed_by, field_name, old_value, new_value, reason)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    oldPlan.plan_id,
                    adminUserId,
                    field,
                    oldPlan[field] !== null ? oldPlan[field].toString() : null,
                    updates[field] !== null ? updates[field].toString() : null,
                    updates.change_reason || '管理员手动更新'
                ]);

                paramIndex++;
            }
        }

        if (updateFields.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: '没有要更新的字段'
            });
        }

        // 执行更新
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(id);

        const updateSQL = `
            UPDATE subscription_plans
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await client.query(updateSQL, updateValues);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: '套餐配置已更新',
            data: result.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update plan error:', error);
        res.status(500).json({
            success: false,
            message: '更新套餐配置失败',
            error: error.message
        });
    } finally {
        client.release();
    }
});

// =====================================================
// 5. 删除套餐
// =====================================================
router.delete('/plans/:id', authenticateToken, requireAdmin, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { id } = req.params;

        // 检查是否有用户正在使用该套餐
        const subscriberCheck = await client.query(
            'SELECT COUNT(*) as count FROM user_subscriptions WHERE plan_id = (SELECT plan_id FROM subscription_plans WHERE id = $1) AND status = $2',
            [id, 'active']
        );

        if (parseInt(subscriberCheck.rows[0].count) > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: '该套餐仍有活跃订阅用户，无法删除'
            });
        }

        // 删除套餐
        const result = await client.query(
            'DELETE FROM subscription_plans WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: '套餐不存在'
            });
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: '套餐已删除',
            data: result.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Delete plan error:', error);
        res.status(500).json({
            success: false,
            message: '删除套餐失败',
            error: error.message
        });
    } finally {
        client.release();
    }
});

// =====================================================
// 6. 获取套餐修改历史
// =====================================================
router.get('/plans/:id/history', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT
                sph.*,
                u.username as changed_by_username,
                u.email as changed_by_email
            FROM subscription_plan_history sph
            JOIN subscription_plans sp ON sph.plan_id = sp.plan_id
            LEFT JOIN users u ON sph.changed_by = u.id
            WHERE sp.id = $1
            ORDER BY sph.created_at DESC
            LIMIT 100
        `, [id]);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Get plan history error:', error);
        res.status(500).json({
            success: false,
            message: '获取历史记录失败',
            error: error.message
        });
    }
});

// =====================================================
// 7. 智能定价建议
// =====================================================
router.post('/plans/calculate-price', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { upload_post_cost, ai_generation_cost, target_margins = [150, 200, 250] } = req.body;

        if (!upload_post_cost) {
            return res.status(400).json({
                success: false,
                message: '请提供Upload-Post成本'
            });
        }

        const totalCost = parseFloat(upload_post_cost) + parseFloat(ai_generation_cost || 0);

        const suggestions = target_margins.map(margin => {
            const suggestedPrice = totalCost * (1 + margin / 100);
            // 向上取整到99结尾
            const roundedPrice = Math.ceil(suggestedPrice / 100) * 100 - 1;
            const actualProfit = roundedPrice - totalCost;
            const actualMargin = (actualProfit / totalCost * 100).toFixed(1);

            return {
                target_margin: margin,
                suggested_price: roundedPrice,
                actual_profit: actualProfit.toFixed(2),
                actual_margin: parseFloat(actualMargin),
                label: margin === 200 ? '目标定价 ⭐' : margin < 200 ? '保守定价' : '进取定价'
            };
        });

        res.json({
            success: true,
            data: {
                total_cost: totalCost.toFixed(2),
                suggestions
            }
        });

    } catch (error) {
        console.error('Calculate price error:', error);
        res.status(500).json({
            success: false,
            message: '计算定价失败',
            error: error.message
        });
    }
});

// =====================================================
// 8. 套餐排序
// =====================================================
router.post('/plans/reorder', authenticateToken, requireAdmin, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { plan_orders } = req.body; // [{ id: 1, sort_order: 1 }, ...]

        for (const item of plan_orders) {
            await client.query(
                'UPDATE subscription_plans SET sort_order = $1 WHERE id = $2',
                [item.sort_order, item.id]
            );
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: '排序已更新'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Reorder plans error:', error);
        res.status(500).json({
            success: false,
            message: '更新排序失败',
            error: error.message
        });
    } finally {
        client.release();
    }
});

// =====================================================
// 9. 利润统计总览
// =====================================================
router.get('/stats/profit-overview', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(DISTINCT us.user_id) as total_subscribers,
                SUM(sp.price_monthly) as total_monthly_revenue,
                SUM(sp.total_cost) as total_monthly_cost,
                SUM(sp.profit_amount) as total_monthly_profit,
                AVG(sp.profit_margin) as avg_profit_margin
            FROM user_subscriptions us
            JOIN subscription_plans sp ON us.plan_id = sp.plan_id
            WHERE us.status = 'active'
        `);

        const stats = result.rows[0];

        res.json({
            success: true,
            data: {
                total_subscribers: parseInt(stats.total_subscribers) || 0,
                total_monthly_revenue: parseFloat(stats.total_monthly_revenue) || 0,
                total_monthly_cost: parseFloat(stats.total_monthly_cost) || 0,
                total_monthly_profit: parseFloat(stats.total_monthly_profit) || 0,
                avg_profit_margin: parseFloat(stats.avg_profit_margin) || 0
            }
        });

    } catch (error) {
        console.error('Get profit overview error:', error);
        res.status(500).json({
            success: false,
            message: '获取利润统计失败',
            error: error.message
        });
    }
});

export default router;
