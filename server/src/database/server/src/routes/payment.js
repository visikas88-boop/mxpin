import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
    createPayment,
    paymentNotify,
    queryPaymentStatus,
    cancelOrder
} from '../controllers/paymentController.js';

const router = express.Router();

// 创建支付（需要登录）
router.post('/create', authenticateToken, createPayment);

// 支付回调（不需要认证，由支付平台调用）
router.post('/notify', paymentNotify);

// 查询支付状态（需要登录）
router.get('/status/:order_id', authenticateToken, queryPaymentStatus);

// 取消订单（需要登录）
router.post('/cancel/:order_id', authenticateToken, cancelOrder);

export default router;
