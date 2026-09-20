import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  getUserList,
  getUserDetail,
  updateUserStatus,
  deleteUser,
  checkUserRecords,
  getPointsTransactions,
  getRechargeOrders,
  getPointsStats,
  getDashboardStats
} from '../controllers/adminController.js';
import { manualRecharge } from '../controllers/pointsController.js';

const router = express.Router();

// 所有管理员路由都需要认证和管理员权限
router.use(authenticate);
router.use(requireAdmin);

// =====================================================
// 仪表盘
// =====================================================
router.get('/dashboard/stats', getDashboardStats);

// =====================================================
// 用户管理
// =====================================================
router.get('/users', getUserList);
router.get('/users/:id', getUserDetail);
router.get('/users/:id/check-records', checkUserRecords);
router.put('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

// =====================================================
// 积分管理
// =====================================================
router.get('/points/transactions', getPointsTransactions);
router.get('/points/recharge-orders', getRechargeOrders);
router.get('/points/stats', getPointsStats);
router.post('/points/recharge', manualRecharge);

export default router;
