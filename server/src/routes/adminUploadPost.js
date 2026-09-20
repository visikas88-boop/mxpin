// =====================================================
// Upload-Post配置管理路由
// 路径: server/src/routes/adminUploadPost.js
// 说明: 管理员配置Upload-Post API Key
// =====================================================

import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import pool from '../config/database.js';
import uploadPostService from '../services/uploadPostService.js';

const router = express.Router();

// =====================================================
// GET /api/admin/upload-post/config
// 获取Upload-Post配置
// =====================================================
router.get('/config', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                api_endpoint,
                max_profiles,
                current_profiles_used,
                profile_quota_warning_threshold,
                is_active,
                created_at,
                updated_at
            FROM upload_post_config
            WHERE is_active = true
            LIMIT 1
        `);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: null,
                message: '尚未配置Upload-Post'
            });
        }

        // 返回时将 api_endpoint 映射为 api_base_url（前端使用的字段名）
        const config = result.rows[0];
        res.json({
            success: true,
            data: {
                ...config,
                api_base_url: config.api_endpoint
            }
        });
    } catch (error) {
        console.error('Get upload-post config error:', error);
        res.status(500).json({
            success: false,
            message: '获取配置失败',
            error: error.message
        });
    }
});

// =====================================================
// POST /api/admin/upload-post/config
// 保存Upload-Post配置
// =====================================================
router.post('/config', authenticateToken, requireAdmin, async (req, res) => {
    const { api_key, api_base_url, max_profiles } = req.body;
    const adminUserId = req.user.id; // 从认证中间件获取管理员ID

    if (!api_key) {
        return res.status(400).json({
            success: false,
            message: 'API Key不能为空'
        });
    }

    try {
        // 简单加密（实际应该使用crypto模块加密）
        // 这里先直接存储，后续可以改进
        const apiKeyEncrypted = api_key;

        // 检查是否已有配置
        const existing = await pool.query(
            'SELECT id FROM upload_post_config WHERE is_active = true LIMIT 1'
        );

        let result;
        if (existing.rows.length > 0) {
            // 更新现有配置
            result = await pool.query(`
                UPDATE upload_post_config
                SET
                    api_key_encrypted = $1,
                    api_endpoint = $2,
                    max_profiles = COALESCE($3, max_profiles),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $4
                RETURNING id, api_endpoint, max_profiles, is_active, created_at, updated_at
            `, [
                apiKeyEncrypted,
                api_base_url || 'https://api.upload-post.com/api',
                max_profiles,
                existing.rows[0].id
            ]);
        } else {
            // 创建新配置
            result = await pool.query(`
                INSERT INTO upload_post_config (
                    user_id,
                    api_key_encrypted,
                    api_endpoint,
                    max_profiles,
                    is_active,
                    current_profiles_used,
                    profile_quota_warning_threshold
                )
                VALUES ($1, $2, $3, $4, true, 0, 80)
                RETURNING id, api_endpoint, max_profiles, is_active, created_at, updated_at
            `, [
                adminUserId,
                apiKeyEncrypted,
                api_base_url || 'https://api.upload-post.com/api',
                max_profiles || 25
            ]);
        }

        // 重新初始化服务
        try {
            await uploadPostService.initialize();
        } catch (initError) {
            console.warn('Service initialization warning:', initError.message);
        }

        // 返回时将 api_endpoint 映射为 api_base_url
        const savedConfig = result.rows[0];
        res.json({
            success: true,
            data: {
                ...savedConfig,
                api_base_url: savedConfig.api_endpoint
            },
            message: '配置保存成功'
        });
    } catch (error) {
        console.error('Save upload-post config error:', error);
        res.status(500).json({
            success: false,
            message: '保存配置失败',
            error: error.message
        });
    }
});

// =====================================================
// POST /api/admin/upload-post/test-endpoints
// 测试所有可能的API端点（调试用）
// =====================================================
router.post('/test-endpoints', authenticateToken, requireAdmin, async (req, res) => {
    const { api_key } = req.body;

    if (!api_key) {
        return res.status(400).json({
            success: false,
            message: 'API Key不能为空'
        });
    }

    try {
        const keyPreview = api_key.length > 20
            ? `${api_key.substring(0, 8)}...${api_key.substring(api_key.length - 4)}`
            : `${api_key.substring(0, 4)}...`;

        console.log('🧪 批量测试API端点，Key:', keyPreview);

        const axios = (await import('axios')).default;
        const endpoints = ['/me', '/account', '/user', '/profiles', '/channels', '/platforms'];
        const results = [];

        for (const endpoint of endpoints) {
            const url = `https://api.upload-post.com/api${endpoint}`;
            try {
                console.log(`📡 测试: ${url}`);
                const response = await axios.get(url, {
                    headers: {
                        'Authorization': `Apikey ${api_key}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                });

                results.push({
                    endpoint,
                    success: true,
                    status: response.status,
                    data: response.data
                });
                console.log(`✅ ${endpoint}: 成功 (${response.status})`);

            } catch (error) {
                results.push({
                    endpoint,
                    success: false,
                    status: error.response?.status || 'timeout',
                    error: error.response?.data || error.message
                });
                console.log(`❌ ${endpoint}: 失败 (${error.response?.status || error.message})`);
            }
        }

        return res.json({
            success: true,
            keyPreview,
            results
        });

    } catch (error) {
        console.error('❌ 批量测试失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// =====================================================
// POST /api/admin/upload-post/verify
// 验证API Key并获取订阅信息
// =====================================================
router.post('/verify', authenticateToken, requireAdmin, async (req, res) => {
    const { api_key } = req.body;

    if (!api_key) {
        return res.status(400).json({
            success: false,
            message: 'API Key不能为空'
        });
    }

    try {
        // 显示提交的Key部分内容（用于调试）
        const keyPreview = api_key.length > 20
            ? `${api_key.substring(0, 8)}...${api_key.substring(api_key.length - 4)}`
            : `${api_key.substring(0, 4)}...`;

        console.log('🔑 验证API Key:', keyPreview);
        console.log('📝 完整Key长度:', api_key.length);

        // 调用Upload-Post API验证
        const axios = (await import('axios')).default;

        // 根据官方文档，使用 /me 端点获取账号信息
        const response = await axios.get('https://api.upload-post.com/api/me', {
            headers: {
                'Authorization': `Apikey ${api_key}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        console.log('✅ API响应状态:', response.status);
        console.log('📊 API响应数据:', JSON.stringify(response.data, null, 2));

        if (response.status === 200 && response.data) {
            // 解析账号信息
            const accountData = response.data;

            // Upload-Post /me 端点返回的字段：
            // - plan: { name, max_profiles, max_accounts_per_platform }
            // - usage: { profiles_used, accounts_per_platform }

            const plan = accountData.plan || {};
            const usage = accountData.usage || {};

            res.json({
                success: true,
                message: 'API Key验证成功',
                data: {
                    keyPreview: keyPreview,  // 显示Key预览
                    plan: plan.name || accountData.plan_name || 'Free',
                    maxProfiles: plan.max_profiles || accountData.max_profiles || 1,
                    maxAccountsPerPlatform: plan.max_accounts_per_platform || accountData.max_accounts_per_platform || 2,
                    currentProfilesUsed: usage.profiles_used || accountData.profiles_used || 0,
                    creditsRemaining: accountData.credits_remaining || accountData.credits || 0,
                    expiresAt: accountData.expires_at || null,
                    rawData: accountData  // 返回原始数据用于调试
                }
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'API返回格式异常',
                keyPreview: keyPreview
            });
        }
    } catch (error) {
        console.error('❌ 验证API Key错误:', error.message);
        console.error('📍 错误详情:', error.response?.data);

        const keyPreview = api_key.length > 20
            ? `${api_key.substring(0, 8)}...${api_key.substring(api_key.length - 4)}`
            : `${api_key.substring(0, 4)}...`;

        if (error.response) {
            // API返回了错误响应
            const status = error.response.status;
            const errorData = error.response.data;

            console.error('🔴 HTTP状态:', status);
            console.error('🔴 错误响应:', errorData);

            if (status === 401 || status === 403) {
                return res.status(400).json({
                    success: false,
                    message: 'API Key无效或已过期',
                    keyPreview: keyPreview,
                    details: errorData?.message || errorData?.error || '未授权'
                });
            } else if (status === 404) {
                return res.status(400).json({
                    success: false,
                    message: 'API端点不存在，请检查API Base URL',
                    keyPreview: keyPreview,
                    endpoint: '/me',
                    details: '如果使用的是旧版API，请尝试更新到最新版本'
                });
            } else if (status === 429) {
                return res.status(400).json({
                    success: false,
                    message: 'API请求频率超限，请稍后再试',
                    keyPreview: keyPreview
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: `API返回错误: ${errorData?.message || error.response.statusText || status}`,
                    keyPreview: keyPreview,
                    statusCode: status,
                    details: errorData
                });
            }
        } else if (error.code === 'ECONNABORTED') {
            return res.status(400).json({
                success: false,
                message: '请求超时，请检查网络连接',
                keyPreview: keyPreview
            });
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return res.status(400).json({
                success: false,
                message: '无法连接到Upload-Post服务器，请检查网络或API Base URL',
                keyPreview: keyPreview,
                endpoint: 'https://api.upload-post.com/api/me'
            });
        }

        res.status(500).json({
            success: false,
            message: `验证失败: ${error.message}`,
            keyPreview: keyPreview
        });
    }
});

// =====================================================
// POST /api/admin/upload-post/test
// 测试Upload-Post API连接
// =====================================================
router.post('/test', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // 尝试调用Upload-Post API测试连接
        await uploadPostService.initialize();

        // 简单测试：获取API信息（假设有这样的端点）
        // 实际实现取决于Upload-Post API文档

        res.json({
            success: true,
            message: 'Upload-Post API连接成功'
        });
    } catch (error) {
        console.error('Test upload-post connection error:', error);
        res.status(500).json({
            success: false,
            message: `连接测试失败: ${error.message}`
        });
    }
});

export default router;
