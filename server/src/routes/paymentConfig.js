import express from 'express';
import {
    getPaymentConfigs,
    getPaymentConfig,
    updatePaymentConfig,
    createPaymentConfig,
    deletePaymentConfig,
    getEnabledGateways,
} from '../controllers/paymentConfigController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// 获取所有支付配置（管理员）
router.get('/', authenticateToken, requireAdmin, getPaymentConfigs);

// 获取已启用的支付网关（公开）
router.get('/enabled', getEnabledGateways);

// 获取单个支付配置（管理员）
router.get('/:id', authenticateToken, requireAdmin, getPaymentConfig);

// 创建支付配置（管理员）
router.post('/', authenticateToken, requireAdmin, createPaymentConfig);

// 更新支付配置（管理员）
router.put('/:id', authenticateToken, requireAdmin, updatePaymentConfig);

// 删除支付配置（管理员）
router.delete('/:id', authenticateToken, requireAdmin, deletePaymentConfig);

export default router;
