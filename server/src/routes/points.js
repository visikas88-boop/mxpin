import express from 'express';
import {
  getBalance,
  getTransactions,
  manualRecharge,
  getRechargeOrders,
  getPointsStats
} from '../controllers/pointsController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// 所有积分接口都需要认证
router.use(authenticateToken);

// 获取积分余额
router.get('/balance', getBalance);

// 获取交易记录
router.get('/transactions', getTransactions);

// 获取充值订单
router.get('/orders', getRechargeOrders);

// 获取积分统计
router.get('/stats', getPointsStats);

// 手动充值（管理员）
router.post('/recharge', requireRole('admin'), manualRecharge);

export default router;
