import pool from '../config/database.js';

// 获取所有套餐（管理后台用）
export const getPackages = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                rp.*,
                COALESCE(
                    CASE
                        WHEN rp.points_calc_mode = 'manual' THEN rp.manual_base_points
                        ELSE FLOOR(rp.price * CAST((SELECT setting_value FROM system_settings WHERE setting_key = 'points_exchange_rate') AS INTEGER))
                    END, 0
                ) as base_points,
                COALESCE(
                    CASE
                        WHEN rp.points_calc_mode = 'manual' THEN rp.manual_gift_points
                        ELSE FLOOR(
                            FLOOR(rp.price * CAST((SELECT setting_value FROM system_settings WHERE setting_key = 'points_exchange_rate') AS INTEGER))
                            * (rp.gift_percent / 100.0)
                        )
                    END, 0
                ) as gift_points,
                COALESCE(
                    CASE
                        WHEN rp.points_calc_mode = 'manual'
                        THEN COALESCE(rp.manual_base_points, 0) + COALESCE(rp.manual_gift_points, 0)
                        ELSE
                            FLOOR(rp.price * CAST((SELECT setting_value FROM system_settings WHERE setting_key = 'points_exchange_rate') AS INTEGER)) +
                            FLOOR(
                                FLOOR(rp.price * CAST((SELECT setting_value FROM system_settings WHERE setting_key = 'points_exchange_rate') AS INTEGER))
                                * (rp.gift_percent / 100.0)
                            )
                    END, 0
                ) as total_points
            FROM recharge_packages rp
            ORDER BY rp.sort_order ASC, rp.id ASC
        `);

        res.json({
            success: true,
            message: '获取套餐列表成功',
            data: result.rows
        });
    } catch (error) {
        console.error('获取套餐列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取套餐列表失败',
            error: error.message
        });
    }
};

// 获取套餐分组
export const getPackageGroups = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM recharge_package_groups
            ORDER BY group_id ASC
        `);

        res.json({
            success: true,
            message: '获取分组列表成功',
            data: result.rows
        });
    } catch (error) {
        console.error('获取分组列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取分组列表失败',
            error: error.message
        });
    }
};

// 创建套餐分组
export const createPackageGroup = async (req, res) => {
    const { group_type, group_name, group_name_en, group_description, group_description_en } = req.body;

    if (!group_type || !group_name) {
        return res.status(400).json({
            success: false,
            message: '缺少必填字段：group_type 和 group_name'
        });
    }

    try {
        const result = await pool.query(`
            INSERT INTO recharge_package_groups (group_type, group_name, group_name_en, group_description, group_description_en)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [group_type, group_name, group_name_en || null, group_description || null, group_description_en || null]);

        res.json({
            success: true,
            message: '创建分组成功',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('创建分组失败:', error);
        res.status(500).json({
            success: false,
            message: '创建分组失败',
            error: error.message
        });
    }
};

// 更新套餐分组
export const updatePackageGroup = async (req, res) => {
    const { id } = req.params;
    const { group_type, group_name, group_name_en, group_description, group_description_en } = req.body;

    try {
        const result = await pool.query(`
            UPDATE recharge_package_groups SET
                group_type = $1,
                group_name = $2,
                group_name_en = $3,
                group_description = $4,
                group_description_en = $5,
                updated_at = CURRENT_TIMESTAMP
            WHERE group_id = $6
            RETURNING *
        `, [group_type, group_name, group_name_en || null, group_description || null, group_description_en || null, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '分组不存在'
            });
        }

        res.json({
            success: true,
            message: '更新分组成功',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('更新分组失败:', error);
        res.status(500).json({
            success: false,
            message: '更新分组失败',
            error: error.message
        });
    }
};

// 删除套餐分组
export const deletePackageGroup = async (req, res) => {
    const { id } = req.params;

    try {
        // 检查是否有套餐使用该分组
        const packageCheck = await pool.query(`
            SELECT COUNT(*) as count
            FROM recharge_packages
            WHERE group_id = $1
        `, [id]);

        if (parseInt(packageCheck.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                message: '该分组下存在套餐，无法删除'
            });
        }

        const result = await pool.query(`
            DELETE FROM recharge_package_groups
            WHERE group_id = $1
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '分组不存在'
            });
        }

        res.json({
            success: true,
            message: '删除分组成功',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('删除分组失败:', error);
        res.status(500).json({
            success: false,
            message: '删除分组失败',
            error: error.message
        });
    }
};

// 创建套餐
export const createPackage = async (req, res) => {
    const {
        group_id,
        package_name,
        package_name_en,
        package_desc,
        package_desc_en,
        price,
        original_price,
        points_calc_mode,
        gift_percent,
        manual_base_points,
        manual_gift_points,
        valid_type,
        valid_days,
        valid_end_date,
        is_hot,
        is_active,
        sort_order
    } = req.body;

    // 验证必填字段
    if (!group_id || !package_name || !price || !points_calc_mode || !valid_type) {
        return res.status(400).json({
            success: false,
            message: '缺少必填字段'
        });
    }

    try {
        const result = await pool.query(`
            INSERT INTO recharge_packages (
                group_id, package_name, package_name_en, package_desc, package_desc_en,
                price, original_price, points_calc_mode, gift_percent,
                manual_base_points, manual_gift_points,
                valid_type, valid_days, valid_end_date,
                is_hot, is_active, sort_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *
        `, [
            group_id, package_name, package_name_en || null, package_desc || null, package_desc_en || null,
            price, original_price || null, points_calc_mode, gift_percent || 0,
            manual_base_points || null, manual_gift_points || null,
            valid_type, valid_days || null, valid_end_date || null,
            is_hot || false, is_active !== undefined ? is_active : true, sort_order || 0
        ]);

        res.json({
            success: true,
            message: '创建套餐成功',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('创建套餐失败:', error);
        res.status(500).json({
            success: false,
            message: '创建套餐失败',
            error: error.message
        });
    }
};

// 更新套餐
export const updatePackage = async (req, res) => {
    const { id } = req.params;
    const {
        group_id,
        package_name,
        package_name_en,
        package_desc,
        package_desc_en,
        price,
        original_price,
        points_calc_mode,
        gift_percent,
        manual_base_points,
        manual_gift_points,
        valid_type,
        valid_days,
        valid_end_date,
        is_hot,
        is_active,
        sort_order
    } = req.body;

    try {
        const result = await pool.query(`
            UPDATE recharge_packages SET
                group_id = $1,
                package_name = $2,
                package_name_en = $3,
                package_desc = $4,
                package_desc_en = $5,
                price = $6,
                original_price = $7,
                points_calc_mode = $8,
                gift_percent = $9,
                manual_base_points = $10,
                manual_gift_points = $11,
                valid_type = $12,
                valid_days = $13,
                valid_end_date = $14,
                is_hot = $15,
                is_active = $16,
                sort_order = $17,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $18
            RETURNING *
        `, [
            group_id, package_name, package_name_en || null, package_desc || null, package_desc_en || null,
            price, original_price || null, points_calc_mode, gift_percent || 0,
            manual_base_points || null, manual_gift_points || null,
            valid_type, valid_days || null, valid_end_date || null,
            is_hot || false, is_active !== undefined ? is_active : true, sort_order || 0,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '套餐不存在'
            });
        }

        res.json({
            success: true,
            message: '更新套餐成功',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('更新套餐失败:', error);
        res.status(500).json({
            success: false,
            message: '更新套餐失败',
            error: error.message
        });
    }
};

// 删除套餐
export const deletePackage = async (req, res) => {
    const { id } = req.params;

    try {
        // 检查是否有未完成的订单使用该套餐
        const orderCheck = await pool.query(`
            SELECT COUNT(*) as count
            FROM recharge_orders
            WHERE package_id = $1 AND status IN ('pending', 'processing')
        `, [id]);

        if (parseInt(orderCheck.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                message: '该套餐存在未完成的订单，无法删除'
            });
        }

        const result = await pool.query(`
            DELETE FROM recharge_packages
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '套餐不存在'
            });
        }

        res.json({
            success: true,
            message: '删除套餐成功',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('删除套餐失败:', error);
        res.status(500).json({
            success: false,
            message: '删除套餐失败',
            error: error.message
        });
    }
};
