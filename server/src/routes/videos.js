import express from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import {
  createVideoTask,
  getVideoTaskStatus
} from '../controllers/videoController.js';

const router = express.Router();

// 使用可选认证中间件
router.use(optionalAuth);

// OpenAI 兼容的视频生成端点
// POST /videos - 创建视频生成任务
router.post('/', createVideoTask);

// GET /videos/:id - 获取视频任务状态
router.get('/:id', getVideoTaskStatus);

// GET /videos/:id/content - 获取视频内容（如果需要）
router.get('/:id/content', getVideoTaskStatus);

export default router;
