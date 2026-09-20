// =====================================================
// Profile管理 - API路由
// 路径: server/src/routes/profiles.js
// 说明: Profile配额查询、统计、管理
// =====================================================

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import profileService from '../services/profileService.js';
import uploadPostService from '../services/uploadPostService.js';

const router = express.Router();

/**
 * 1. 获取用户的Profile列表
 * GET /api/profiles
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await profileService.getUserProfiles(userId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);

    } catch (error) {
        console.error('Get profiles error:', error);
        res.status(500).json({
            success: false,
            message: '获取Profile列表失败',
            error: error.message
        });
    }
});

/**
 * 2. 获取Profile使用统计
 * GET /api/profiles/stats
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await profileService.getProfileUsageStats(userId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);

    } catch (error) {
        console.error('Get profile stats error:', error);
        res.status(500).json({
            success: false,
            message: '获取Profile统计失败',
            error: error.message
        });
    }
});

/**
 * 3. 检查Profile配额（从Upload-Post获取真实配额）
 * GET /api/profiles/quota
 */
router.get('/quota', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. 获取Upload-Post真实配额
        const uploadPostQuotaResult = await uploadPostService.getAccountQuota();
        const uploadPostQuota = uploadPostQuotaResult.data;

        // 2. 获取用户当前使用情况
        const usageResult = await uploadPostService.getUserQuotaUsage(userId);
        const usage = usageResult.data;

        // 3. 计算每个平台的剩余配额
        const platformQuotas = {};
        const maxPerPlatform = uploadPostQuota.max_accounts_per_platform;

        // 为每个平台计算配额
        Object.keys(usage.platform_usage || {}).forEach(platform => {
            const used = usage.platform_usage[platform];
            platformQuotas[platform] = {
                used: used,
                max: maxPerPlatform,
                remaining: maxPerPlatform - used,
                canAdd: used < maxPerPlatform
            };
        });

        res.json({
            success: true,
            data: {
                // Upload-Post配额信息
                uploadPost: {
                    plan: uploadPostQuota.plan_name,
                    maxAccountsPerPlatform: maxPerPlatform,
                    maxProfiles: uploadPostQuota.max_profiles,
                    usedProfiles: uploadPostQuota.used_profiles
                },
                // 当前使用情况
                usage: {
                    totalAccounts: usage.total_accounts,
                    platformUsage: usage.platform_usage,
                    platformQuotas: platformQuotas,
                    source: usage.source
                },
                // 汇总信息
                summary: {
                    message: `免费账号：每个平台可授权${maxPerPlatform}个账号`,
                    canAddNewAccount: true  // 总是可以尝试，具体看平台
                }
            }
        });

    } catch (error) {
        console.error('Check quota error:', error);
        res.status(500).json({
            success: false,
            message: '检查配额失败',
            error: error.message
        });
    }
});

/**
 * 4. 获取平台授权建议
 * GET /api/profiles/suggestion?platform=instagram
 */
router.get('/suggestion', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { platform } = req.query;

        if (!platform) {
            return res.status(400).json({
                success: false,
                message: '请指定平台'
            });
        }

        const result = await profileService.getAuthorizationSuggestion(userId, platform);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);

    } catch (error) {
        console.error('Get authorization suggestion error:', error);
        res.status(500).json({
            success: false,
            message: '获取授权建议失败',
            error: error.message
        });
    }
});

/**
 * 5. 获取Profile详情
 * GET /api/profiles/:profileId
 */
router.get('/:profileId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { profileId } = req.params;

        const result = await profileService.getProfileDetails(profileId, userId);

        if (!result.success) {
            return res.status(404).json(result);
        }

        res.json(result);

    } catch (error) {
        console.error('Get profile details error:', error);
        res.status(500).json({
            success: false,
            message: '获取Profile详情失败',
            error: error.message
        });
    }
});

/**
 * 6. 删除Profile
 * DELETE /api/profiles/:profileId
 */
router.delete('/:profileId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { profileId } = req.params;

        const result = await profileService.deleteProfile(profileId, userId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);

    } catch (error) {
        console.error('Delete profile error:', error);
        res.status(500).json({
            success: false,
            message: '删除Profile失败',
            error: error.message
        });
    }
});

/**
 * 7. 测试Upload-Post配额获取（调试用）
 * GET /api/profiles/test/upload-post-quota
 */
router.get('/test/upload-post-quota', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. 测试获取Upload-Post配额
        const quotaResult = await uploadPostService.getAccountQuota();

        // 2. 测试获取用户使用情况
        const usageResult = await uploadPostService.getUserQuotaUsage(userId);

        res.json({
            success: true,
            data: {
                uploadPostQuota: quotaResult,
                userUsage: usageResult,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Test Upload-Post quota error:', error);
        res.status(500).json({
            success: false,
            message: '测试失败',
            error: error.message
        });
    }
});

export default router;
