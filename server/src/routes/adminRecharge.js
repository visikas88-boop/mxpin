import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
    getPackages,
    getPackageGroups,
    createPackageGroup,
    updatePackageGroup,
    deletePackageGroup,
    createPackage,
    updatePackage,
    deletePackage
} from '../controllers/adminRechargeController.js';

const router = express.Router();

// 所有路由都需要管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

// 套餐分组管理
router.get('/package-groups', getPackageGroups);
router.post('/package-groups', createPackageGroup);
router.put('/package-groups/:id', updatePackageGroup);
router.delete('/package-groups/:id', deletePackageGroup);

// 套餐管理
router.get('/packages', getPackages);
router.post('/packages', createPackage);
router.put('/packages/:id', updatePackage);
router.delete('/packages/:id', deletePackage);

export default router;
