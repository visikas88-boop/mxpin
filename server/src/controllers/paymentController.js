import crypto from 'crypto';
import axios from 'axios';
import { query } from '../config/database.js';

/**
 * 生成签名
 */
function generateSignature(params, secret) {
    const sortedKeys = Object.keys(params).sort();
    const signString = sortedKeys
        .map(key => `${key}=${params[key]}`)
        .join('&') + `&key=${secret}`;
    return crypto.createHash('md5').update(signString).digest('hex');
}

/**
 * 创建支付
 * POST /api/payment/create
 */
export async function createPayment(req, res) {
    try {
        const userId = req.user.id;
        const { order_id, amount, pay_type } = req.body;

        if (!order_id || !amount || !pay_type) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数'
            });
        }

        // 获取码支付配置
        const configResult = await query(
            `SELECT setting_key, setting_value
             FROM system_settings
             WHERE setting_key IN ('codepay_enabled', 'codepay_api_url', 'codepay_app_id', 'codepay_app_secret', 'codepay_notify_url', 'payment_timeout')`
        );

        const config = {};
        configResult.rows.forEach(row => {
            config[row.setting_key] = row.setting_value;
        });

        if (config.codepay_enabled !== 'true') {
            return res.status(400).json({
                success: false,
                message: '支付功能未启用'
            });
        }

        // 验证订单
        const orderResult = await query(
            `SELECT * FROM recharge_orders WHERE order_number = $1 AND user_id = $2 AND status = 'pending'`,
            [order_id, userId]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '订单不存在或已失效'
            });
        }

        const order = orderResult.rows[0];

        // 调用码支付API
        const payParams = {
            app_id: config.codepay_app_id,
            out_trade_no: order_id,
            total_amount: amount,
            pay_type: pay_type,
            notify_url: config.codepay_notify_url,
            return_url: process.env.FRONTEND_URL || 'http://localhost:3000'
        };

        payParams.sign = generateSignature(payParams, config.codepay_app_secret);

        const response = await axios.post(`${config.codepay_api_url}/api/pay/create`, payParams);

        if (response.data.code === 0) {
            const paymentData = response.data.data;
            const expireTime = Date.now() + (parseInt(config.payment_timeout || 300) * 1000);

            // 更新订单支付信息
            await query(
                `UPDATE recharge_orders
                 SET payment_type = $1, payment_qrcode = $2, expire_time = $3, updated_at = CURRENT_TIMESTAMP
                 WHERE order_number = $4`,
                [pay_type, paymentData.qrcode, new Date(expireTime), order_id]
            );

            return res.json({
                success: true,
                data: {
                    qrcode: paymentData.qrcode,
                    order_id: order_id,
                    amount: amount,
                    expire_time: expireTime
                }
            });
        } else {
            return res.status(400).json({
                success: false,
                message: response.data.message || '创建支付失败'
            });
        }
    } catch (error) {
        console.error('创建支付失败:', error);
        return res.status(500).json({
            success: false,
            message: '创建支付失败'
        });
    }
}

/**
 * 支付回调通知
 * POST /api/payment/notify
 */
export async function paymentNotify(req, res) {
    try {
        const { out_trade_no, total_amount, pay_type, trade_no, sign } = req.body;

        // 获取密钥
        const secretResult = await query(
            `SELECT setting_value FROM system_settings WHERE setting_key = 'codepay_app_secret'`
        );

        if (secretResult.rows.length === 0) {
            return res.status(400).send('FAIL');
        }

        const secret = secretResult.rows[0].setting_value;

        // 验证签名
        const params = { out_trade_no, total_amount, pay_type, trade_no };
        const computedSign = generateSignature(params, secret);

        if (computedSign !== sign) {
            console.error('签名验证失败');
            return res.status(400).send('FAIL');
        }

        // 查询订单
        const orderResult = await query(
            `SELECT * FROM recharge_orders WHERE order_number = $1`,
            [out_trade_no]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).send('FAIL');
        }

        const order = orderResult.rows[0];

        // 防止重复处理
        if (order.status === 'completed') {
            return res.send('SUCCESS');
        }

        // 更新订单状态
        await query(
            `UPDATE recharge_orders
             SET status = 'completed', payment_trade_no = $1, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE order_number = $2`,
            [trade_no, out_trade_no]
        );

        // 增加用户积分
        await query(
            `UPDATE users
             SET balance_points = balance_points + $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [order.receive_points, order.user_id]
        );

        // 记录积分变动
        await query(
            `INSERT INTO points_transactions (user_id, amount, balance_after, transaction_type, description, order_number, created_at)
             VALUES ($1, $2, (SELECT balance_points FROM users WHERE id = $1), 'recharge', $3, $4, CURRENT_TIMESTAMP)`,
            [order.user_id, order.receive_points, `充值订单: ${out_trade_no}`, out_trade_no]
        );

        return res.send('SUCCESS');
    } catch (error) {
        console.error('支付回调处理失败:', error);
        return res.status(500).send('FAIL');
    }
}

/**
 * 查询支付状态
 * GET /api/payment/status/:order_id
 */
export async function queryPaymentStatus(req, res) {
    try {
        const userId = req.user.id;
        const { order_id } = req.params;

        const orderResult = await query(
            `SELECT status, paid_at FROM recharge_orders WHERE order_number = $1 AND user_id = $2`,
            [order_id, userId]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '订单不存在'
            });
        }

        const order = orderResult.rows[0];

        return res.json({
            success: true,
            data: {
                status: order.status,
                paid_at: order.paid_at
            }
        });
    } catch (error) {
        console.error('查询支付状态失败:', error);
        return res.status(500).json({
            success: false,
            message: '查询失败'
        });
    }
}

/**
 * 取消订单
 * POST /api/payment/cancel/:order_id
 */
export async function cancelOrder(req, res) {
    try {
        const userId = req.user.id;
        const { order_id } = req.params;

        await query(
            `UPDATE recharge_orders
             SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
             WHERE order_number = $1 AND user_id = $2 AND status = 'pending'`,
            [order_id, userId]
        );

        return res.json({
            success: true,
            message: '订单已取消'
        });
    } catch (error) {
        console.error('取消订单失败:', error);
        return res.status(500).json({
            success: false,
            message: '取消失败'
        });
    }
}
