import pool from '../config/database.js';

/**
 * 获取所有支付配置
 */
export const getPaymentConfigs = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                gateway_name,
                display_name,
                is_enabled,
                api_url,
                callback_url,
                return_url,
                merchant_id,
                merchant_key,
                app_id,
                app_secret,
                extra_config,
                created_at,
                updated_at
            FROM payment_config
            ORDER BY id ASC
        `);

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error('获取支付配置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取支付配置失败',
            error: error.message,
        });
    }
};

/**
 * 获取单个支付配置
 */
export const getPaymentConfig = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'SELECT * FROM payment_config WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '支付配置不存在',
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        console.error('获取支付配置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取支付配置失败',
            error: error.message,
        });
    }
};

/**
 * 更新支付配置
 */
export const updatePaymentConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            display_name,
            is_enabled,
            api_url,
            callback_url,
            return_url,
            merchant_id,
            merchant_key,
            app_id,
            app_secret,
            extra_config,
        } = req.body;

        // 检查配置是否存在
        const checkResult = await pool.query(
            'SELECT id FROM payment_config WHERE id = $1',
            [id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '支付配置不存在',
            });
        }

        // 更新配置
        const result = await pool.query(
            `UPDATE payment_config
            SET
                display_name = COALESCE($1, display_name),
                is_enabled = COALESCE($2, is_enabled),
                api_url = COALESCE($3, api_url),
                callback_url = COALESCE($4, callback_url),
                return_url = COALESCE($5, return_url),
                merchant_id = COALESCE($6, merchant_id),
                merchant_key = COALESCE($7, merchant_key),
                app_id = COALESCE($8, app_id),
                app_secret = COALESCE($9, app_secret),
                extra_config = COALESCE($10, extra_config),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $11
            RETURNING *`,
            [
                display_name,
                is_enabled,
                api_url,
                callback_url,
                return_url,
                merchant_id,
                merchant_key,
                app_id,
                app_secret,
                extra_config,
                id,
            ]
        );

        res.json({
            success: true,
            message: '更新成功',
            data: result.rows[0],
        });
    } catch (error) {
        console.error('更新支付配置失败:', error);
        res.status(500).json({
            success: false,
            message: '更新支付配置失败',
            error: error.message,
        });
    }
};

/**
 * 创建支付配置
 */
export const createPaymentConfig = async (req, res) => {
    try {
        const {
            gateway_name,
            display_name,
            is_enabled = false,
            api_url,
            callback_url,
            return_url,
            merchant_id,
            merchant_key,
            app_id,
            app_secret,
            extra_config,
        } = req.body;

        // 验证必填字段
        if (!gateway_name || !display_name) {
            return res.status(400).json({
                success: false,
                message: '网关名称和显示名称不能为空',
            });
        }

        // 检查网关名称是否已存在
        const checkResult = await pool.query(
            'SELECT id FROM payment_config WHERE gateway_name = $1',
            [gateway_name]
        );

        if (checkResult.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: '该支付网关已存在',
            });
        }

        // 创建配置
        const result = await pool.query(
            `INSERT INTO payment_config (
                gateway_name,
                display_name,
                is_enabled,
                api_url,
                callback_url,
                return_url,
                merchant_id,
                merchant_key,
                app_id,
                app_secret,
                extra_config
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                gateway_name,
                display_name,
                is_enabled,
                api_url,
                callback_url,
                return_url,
                merchant_id,
                merchant_key,
                app_id,
                app_secret,
                extra_config,
            ]
        );

        res.status(201).json({
            success: true,
            message: '创建成功',
            data: result.rows[0],
        });
    } catch (error) {
        console.error('创建支付配置失败:', error);
        res.status(500).json({
            success: false,
            message: '创建支付配置失败',
            error: error.message,
        });
    }
};

/**
 * 删除支付配置
 */
export const deletePaymentConfig = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM payment_config WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '支付配置不存在',
            });
        }

        res.json({
            success: true,
            message: '删除成功',
        });
    } catch (error) {
        console.error('删除支付配置失败:', error);
        res.status(500).json({
            success: false,
            message: '删除支付配置失败',
            error: error.message,
        });
    }
};

/**
 * 获取已启用的支付网关（用于前端选择）
 */
export const getEnabledGateways = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                gateway_name,
                display_name
            FROM payment_config
            WHERE is_enabled = true
            ORDER BY id ASC
        `);

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error('获取启用的支付网关失败:', error);
        res.status(500).json({
            success: false,
            message: '获取启用的支付网关失败',
            error: error.message,
        });
    }
};
