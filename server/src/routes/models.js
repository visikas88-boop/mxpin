import express from 'express';
import {
  getModels,
  getModelById,
  createModel,
  updateModel,
  deleteModel,
  permanentDeleteModel,
  testModel,
  getModelChannels
} from '../controllers/modelController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// 公开路由（获取激活的模型列表）
// 注意：/channels 必须在 /:id 之前，避免被当作id参数
router.get('/channels', getModelChannels); // 获取渠道格式的模型列表
router.get('/', getModels);
router.get('/:id', getModelById);

// 管理员路由
router.post('/', authenticateToken, requireRole('admin'), createModel);
router.put('/:id', authenticateToken, requireRole('admin'), updateModel);
router.delete('/:id/permanent', authenticateToken, requireRole('admin'), permanentDeleteModel);
router.delete('/:id', authenticateToken, requireRole('admin'), deleteModel);
router.post('/:id/test', authenticateToken, requireRole('admin'), testModel);

export default router;
