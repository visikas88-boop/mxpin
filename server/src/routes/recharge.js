import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getRechargePackages, createRechargeOrder } from '../controllers/rechargeController.js';

const router = express.Router();

// 获取积分套餐列表（无需认证，游客也可以查看）
router.get('/packages', getRechargePackages);

// 创建充值订单（需要认证）
router.post('/create-order', authenticateToken, createRechargeOrder);

export default router;
