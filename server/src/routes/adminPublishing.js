import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
    getAllTasks,
    getPublishingStats,
    updatePlatformPricing,
    getPublishingLogs,
    updateUploadPostConfig,
    getUploadPostConfig
} from '../controllers/adminPublishingController.js';

const router = express.Router();

// 获取所有用户的发布任务（分页）
router.get('/tasks', authenticateToken, requireAdmin, getAllTasks);

// 获取发布统计数据
router.get('/stats', authenticateToken, requireAdmin, getPublishingStats);

// 更新平台定价
router.put('/platforms/:id', authenticateToken, requireAdmin, updatePlatformPricing);

// 获取发布日志
router.get('/logs', authenticateToken, requireAdmin, getPublishingLogs);

// 获取Upload-Post配置
router.get('/config', authenticateToken, requireAdmin, getUploadPostConfig);

// 更新Upload-Post配置
router.put('/config', authenticateToken, requireAdmin, updateUploadPostConfig);

export default router;
