import express from 'express';
import {
  createTask,
  getTaskStatus,
  getUserTasks,
  cancelTask
} from '../controllers/generationController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 所有生成接口都需要认证
router.use(authenticateToken);

// 创建生成任务
router.post('/create', createTask);

// 获取任务状态
router.get('/tasks/:id', getTaskStatus);

// 获取用户任务列表
router.get('/tasks', getUserTasks);

// 取消任务
router.post('/tasks/:id/cancel', cancelTask);

export default router;
