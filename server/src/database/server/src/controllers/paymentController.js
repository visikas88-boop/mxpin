import pool from '../config/database.js';
import crypto from 'crypto';

// 获取支付配置
async function getPaymentConfig() {
    const result = await pool.query(`
        SELECT setting_key, setting_value
        FROM system_settings
        WHERE setting_key LIKE 'codepay_%' OR setting_key = 'payment_timeout'
    `);

    const config = {};
    result.rows.forEach(row => {
        const key = row.setting_key.replace('codepay_', '');
        config[key] = row.setting_value;
    });

    return config;
}

// 生成签名
function generateSign(params, appSecret) {
    // 按key排序
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys.map(key => `${key}=${params[key]}`).join('&') + `&key=${appSecret}`;
    return crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
}

// 创建支付订单
export const createPayment = async (req, res) => {
    const { order_id, amount, pay_type = 'alipay' } = req.body;
    const userId = req.user.userId;

    if (!order_id || !amount) {
        return res.status(400).json({
            success: false,
            message: '缺少必填参数：order_id 和 amount'
        });
    }

    try {
        // 获取支付配置
        const config = await getPaymentConfig();

        if (!config.enabled || config.enabled !== 'true') {
            return res.status(503).json({
                success: false,
                message: '支付功能未启用'
            });
        }

        if (!config.app_id || !config.app_secret) {
            return res.status(500).json({
                success: false,
                message: '支付配置不完整，请联系管理员'
            });
        }

        // 验证订单是否存在且属于当前用户
        const orderCheck = await pool.query(`
            SELECT id, total_amount, status
            FROM recharge_orders
            WHERE order_number = $1 AND user_id = $2
        `, [order_id, userId]);

        if (orderCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '订单不存在'
            });
        }

        const order = orderCheck.rows[0];

        if (order.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: '订单状态不正确'
            });
        }

        // 验证金额
        if (parseFloat(amount) !== parseFloat(order.total_amount)) {
            return res.status(400).json({
                success: false,
                message: '支付金额与订单金额不一致'
            });
        }

        // 构造支付参数
        const payParams = {
            app_id: config.app_id,
            out_trade_no: order_id,
            total_amount: amount,
            pay_type: pay_type, // alipay, wechat
            notify_url: config.notify_url,
            return_url: `${process.env.FRONTEND_URL}/payment/success`,
            subject: '积分充值',
            body: `充值${amount}元`,
            timestamp: Date.now()
        };

        // 生成签名
        payParams.sign = generateSign(payParams, config.app_secret);

        // 调用码支付API
        const apiUrl = config.api_url || 'https://api.codepay.com';
        const response = await fetch(`${apiUrl}/api/pay/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payParams)
        });

        const data = await response.json();

        if (response.ok && data.code === 0) {
            // 更新订单状态为处理中
            await pool.query(`
                UPDATE recharge_orders
                SET status = 'processing', updated_at = CURRENT_TIMESTAMP
                WHERE order_number = $1
            `, [order_id]);

            res.json({
                success: true,
                message: '创建支付成功',
                data: {
                    pay_url: data.data.pay_url,
                    qr_code: data.data.qr_code,
                    order_id: order_id,
                    amount: amount,
                    expire_time: Date.now() + (parseInt(config.payment_timeout || 300) * 1000)
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: data.message || '创建支付失败'
            });
        }

    } catch (error) {
        console.error('创建支付失败:', error);
        res.status(500).json({
            success: false,
            message: '创建支付失败',
            error: error.message
        });
    }
};

// 支付回调处理
export const paymentNotify = async (req, res) => {
    const params = req.body;

    try {
        // 获取配置
        const config = await getPaymentConfig();

        // 验证签名
        const { sign, ...otherParams } = params;
        const calculatedSign = generateSign(otherParams, config.app_secret);

        if (sign !== calculatedSign) {
            console.error('支付回调签名验证失败');
            return res.status(400).send('FAIL');
        }

        const { out_trade_no, trade_status, total_amount, transaction_id } = params;

        // 查询订单
        const orderResult = await pool.query(`
            SELECT id, user_id, total_amount, receive_points, status
            FROM recharge_orders
            WHERE order_number = $1
        `, [out_trade_no]);

        if (orderResult.rows.length === 0) {
            console.error('订单不存在:', out_trade_no);
            return res.status(404).send('ORDER_NOT_FOUND');
        }

        const order = orderResult.rows[0];

        // 验证金额
        if (parseFloat(total_amount) !== parseFloat(order.total_amount)) {
            console.error('支付金额不一致');
            return res.status(400).send('AMOUNT_MISMATCH');
        }

        // 如果订单已完成，直接返回成功
        if (order.status === 'completed') {
            return res.send('SUCCESS');
        }

        // 支付成功
        if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // 更新订单状态
                await client.query(`
                    UPDATE recharge_orders SET
                        status = 'completed',
                        payment_method = $1,
                        transaction_id = $2,
                        paid_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $3
                `, [params.pay_type === 'alipay' ? 'alipay' : 'wechat', transaction_id, order.id]);

                // 增加用户积分
                await client.query(`
                    UPDATE users
                    SET points_balance = points_balance + $1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                `, [order.receive_points, order.user_id]);

                // 记录积分流水
                await client.query(`
                    INSERT INTO points_transactions (
                        user_id, transaction_type, points_change,
                        balance_before, balance_after, description, related_order_id
                    )
                    SELECT
                        $1, 'recharge', $2,
                        u.points_balance - $2, u.points_balance,
                        '充值获得积分', $3
                    FROM users u WHERE u.id = $1
                `, [order.user_id, order.receive_points, order.id]);

                await client.query('COMMIT');

                console.log(`✅ 订单 ${out_trade_no} 支付成功，用户获得 ${order.receive_points} 积分`);

                res.send('SUCCESS');

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('处理支付回调失败:', error);
                res.status(500).send('FAIL');
            } finally {
                client.release();
            }
        } else {
            // 支付失败或其他状态
            await pool.query(`
                UPDATE recharge_orders SET
                    status = 'failed',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [order.id]);

            res.send('SUCCESS');
        }

    } catch (error) {
        console.error('支付回调处理异常:', error);
        res.status(500).send('FAIL');
    }
};

// 查询支付状态
export const queryPaymentStatus = async (req, res) => {
    const { order_id } = req.params;
    const userId = req.user.userId;

    try {
        const result = await pool.query(`
            SELECT order_number, status, payment_method, transaction_id, paid_at
            FROM recharge_orders
            WHERE order_number = $1 AND user_id = $2
        `, [order_id, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '订单不存在'
            });
        }

        const order = result.rows[0];

        res.json({
            success: true,
            data: {
                order_id: order.order_number,
                status: order.status,
                payment_method: order.payment_method,
                transaction_id: order.transaction_id,
                paid_at: order.paid_at
            }
        });

    } catch (error) {
        console.error('查询支付状态失败:', error);
        res.status(500).json({
            success: false,
            message: '查询失败',
            error: error.message
        });
    }
};

// 取消订单
export const cancelOrder = async (req, res) => {
    const { order_id } = req.params;
    const userId = req.user.userId;

    try {
        const result = await pool.query(`
            UPDATE recharge_orders
            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE order_number = $1 AND user_id = $2 AND status = 'pending'
            RETURNING id
        `, [order_id, userId]);

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: '订单不存在或状态不允许取消'
            });
        }

        res.json({
            success: true,
            message: '订单已取消'
        });

    } catch (error) {
        console.error('取消订单失败:', error);
        res.status(500).json({
            success: false,
            message: '取消失败',
            error: error.message
        });
    }
};
