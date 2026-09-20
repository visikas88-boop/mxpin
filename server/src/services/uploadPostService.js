// =====================================================
// Upload-Post服务封装
// 路径: server/src/services/uploadPostService.js
// 说明: 完整的Upload-Post API对接实现
// =====================================================

import axios from 'axios';
import FormData from 'form-data';
import pool from '../config/database.js';
import fs from 'fs';

class UploadPostService {
    constructor() {
        this.baseURL = 'https://api.upload-post.com/api';
        this.apiKey = null;
    }

    /**
     * 初始化API Key（从数据库加载）
     */
    async initialize() {
        try {
            const result = await pool.query(
                'SELECT api_key_encrypted, api_endpoint FROM upload_post_config WHERE is_active = true LIMIT 1'
            );

            if (result.rows.length === 0) {
                throw new Error('Upload-Post API未配置，请在管理后台设置API Key');
            }

            const config = result.rows[0];
            // 这里简单解密（实际应该使用crypto模块）
            this.apiKey = config.api_key_encrypted;
            if (config.api_endpoint) {
                this.baseURL = config.api_endpoint;
            }

            console.log('✅ Upload-Post Service initialized');
        } catch (error) {
            console.error('❌ Upload-Post Service initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * 获取API Key
     */
    async getApiKey() {
        if (!this.apiKey) {
            await this.initialize();
        }
        return this.apiKey;
    }

    /**
     * 通用请求方法
     */
    async request(method, endpoint, data = null, isFormData = false) {
        const apiKey = await this.getApiKey();

        const config = {
            method,
            url: `${this.baseURL}${endpoint}`,
            headers: {
                'Authorization': `Apikey ${apiKey}`
            },
            timeout: 30000
        };

        if (data) {
            if (isFormData) {
                config.data = data;
                // FormData会自动设置Content-Type
                Object.assign(config.headers, data.getHeaders());
            } else {
                config.data = data;
                config.headers['Content-Type'] = 'application/json';
            }
        }

        try {
            console.log(`🌐 Upload-Post API: ${method} ${endpoint}`);
            const response = await axios(config);
            console.log(`✅ Upload-Post API Response:`, response.data);

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('❌ Upload-Post API Error:', {
                endpoint,
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });

            return {
                success: false,
                error: error.response?.data?.message || error.message,
                errorData: error.response?.data,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * 1. 创建用户Profile
     */
    async createUserProfile(userId, displayName = null) {
        const uploadPostUser = `user_${userId}`;

        const result = await this.request('POST', '/users', {
            user: uploadPostUser,
            display_name: displayName || `User ${userId}`
        });

        if (result.success) {
            // 保存到数据库
            await pool.query(`
                INSERT INTO user_upload_post_profiles (user_id, upload_post_user)
                VALUES ($1, $2)
                ON CONFLICT (user_id) DO NOTHING
            `, [userId, uploadPostUser]);

            console.log(`✅ Created Upload-Post profile for user ${userId}`);
        }

        return result;
    }

    /**
     * 2. 获取或创建用户Profile
     */
    async ensureUserProfile(userId) {
        const profileResult = await pool.query(
            'SELECT upload_post_user FROM user_upload_post_profiles WHERE user_id = $1',
            [userId]
        );

        if (profileResult.rows.length > 0) {
            return {
                success: true,
                uploadPostUser: profileResult.rows[0].upload_post_user
            };
        }

        // 创建新Profile
        const createResult = await this.createUserProfile(userId);
        if (!createResult.success) {
            return createResult;
        }

        return {
            success: true,
            uploadPostUser: `user_${userId}`
        };
    }

    /**
     * 3. 获取OAuth连接URL
     */
    async getConnectUrl(userId, platform, redirectUri) {
        const profileResult = await this.ensureUserProfile(userId);
        if (!profileResult.success) {
            return profileResult;
        }

        const uploadPostUser = profileResult.uploadPostUser;

        // 调用Upload-Post获取连接URL
        const result = await this.request('POST', '/connect', {
            user: uploadPostUser,
            platform: platform.toLowerCase(),
            redirect_uri: redirectUri,
            state: JSON.stringify({ user_id: userId, platform })
        });

        return result;
    }

    /**
     * 4. 获取Profile的所有连接账号
     */
    async getProfileAccounts(uploadPostUser) {
        return await this.request('GET', `/users/${uploadPostUser}`);
    }

    /**
     * 5. 同步用户的社交账号
     */
    async syncUserAccounts(userId) {
        const profileResult = await pool.query(
            'SELECT upload_post_user FROM user_upload_post_profiles WHERE user_id = $1',
            [userId]
        );

        if (profileResult.rows.length === 0) {
            return {
                success: false,
                error: 'User profile not found'
            };
        }

        const uploadPostUser = profileResult.rows[0].upload_post_user;

        // 从Upload-Post获取账号列表
        const accountsResult = await this.getProfileAccounts(uploadPostUser);

        if (!accountsResult.success) {
            return accountsResult;
        }

        const accounts = accountsResult.data.accounts || accountsResult.data.platforms || [];
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            for (const account of accounts) {
                await client.query(`
                    INSERT INTO social_accounts
                    (user_id, platform, platform_user_id, platform_username,
                     platform_display_name, platform_avatar_url, upload_post_profile_id,
                     connection_status, last_sync_at, metadata, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)
                    ON CONFLICT (user_id, platform, platform_user_id)
                    DO UPDATE SET
                        platform_username = EXCLUDED.platform_username,
                        platform_display_name = EXCLUDED.platform_display_name,
                        platform_avatar_url = EXCLUDED.platform_avatar_url,
                        connection_status = EXCLUDED.connection_status,
                        last_sync_at = NOW(),
                        metadata = EXCLUDED.metadata,
                        is_active = EXCLUDED.is_active
                `, [
                    userId,
                    account.platform || account.type,
                    account.id || account.platform_user_id,
                    account.username || account.name,
                    account.display_name || account.name,
                    account.avatar_url || account.profile_picture_url,
                    uploadPostUser,
                    account.status || 'active',
                    JSON.stringify(account.metadata || {}),
                    account.is_active !== false
                ]);
            }

            await client.query('COMMIT');

            console.log(`✅ Synced ${accounts.length} accounts for user ${userId}`);

            return {
                success: true,
                count: accounts.length
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Sync accounts error:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * 6. 上传视频到多个平台
     */
    async uploadVideo(options) {
        const {
            uploadPostUser,
            videoUrl,
            title,
            description,
            platforms,
            thumbnailUrl,
            scheduledTime
        } = options;

        const formData = new FormData();

        // 必填字段
        formData.append('user', uploadPostUser);
        formData.append('title', title);

        // 视频URL或文件
        if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
            formData.append('video_url', videoUrl);
        } else {
            // 本地文件路径
            if (fs.existsSync(videoUrl)) {
                formData.append('video', fs.createReadStream(videoUrl));
            } else {
                return {
                    success: false,
                    error: `Video file not found: ${videoUrl}`
                };
            }
        }

        // 可选字段
        if (description) {
            formData.append('description', description);
        }

        if (thumbnailUrl) {
            if (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://')) {
                formData.append('thumbnail_url', thumbnailUrl);
            } else if (fs.existsSync(thumbnailUrl)) {
                formData.append('thumbnail', fs.createReadStream(thumbnailUrl));
            }
        }

        // 定时发布
        if (scheduledTime) {
            formData.append('scheduled_time', scheduledTime);
        }

        // 目标平台
        if (Array.isArray(platforms)) {
            platforms.forEach(platform => {
                formData.append('platforms[]', platform.toLowerCase());
            });
        }

        return await this.request('POST', '/upload', formData, true);
    }

    /**
     * 7. 查询上传任务状态
     */
    async getUploadStatus(jobId) {
        return await this.request('GET', `/uploads/${jobId}`);
    }

    /**
     * 8. 获取分析数据
     */
    async getAnalytics(uploadPostUser, options = {}) {
        const { startDate, endDate, platform } = options;

        let endpoint = `/analytics/profile/${uploadPostUser}`;
        const params = [];

        if (startDate) params.push(`start_date=${startDate}`);
        if (endDate) params.push(`end_date=${endDate}`);
        if (platform) params.push(`platform=${platform}`);

        if (params.length > 0) {
            endpoint += '?' + params.join('&');
        }

        return await this.request('GET', endpoint);
    }

    /**
     * 9. 断开社交账号连接
     */
    async disconnectAccount(uploadPostUser, platform) {
        return await this.request('DELETE', `/users/${uploadPostUser}/platforms/${platform}`);
    }

    /**
     * 10. 取消上传任务
     */
    async cancelUpload(jobId) {
        return await this.request('DELETE', `/uploads/${jobId}`);
    }

    /**
     * 11. 获取支持的平台列表
     */
    async getSupportedPlatforms() {
        try {
            const result = await this.request('GET', '/channels');

            if (result.success && result.data) {
                return {
                    success: true,
                    data: result.data
                };
            }

            return result;
        } catch (error) {
            console.error('❌ Get platforms error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 12. 获取账号配额信息（从Upload-Post API）
     * 返回: { max_profiles: number, used_profiles: number, max_accounts_per_platform: number }
     */
    async getAccountQuota() {
        try {
            // 根据官方文档使用 /me 端点获取账号信息
            const result = await this.request('GET', '/me');

            if (result.success && result.data) {
                // 解析配额信息
                const data = result.data;
                const plan = data.plan || {};
                const usage = data.usage || {};

                const quota = {
                    max_profiles: plan.max_profiles || data.max_profiles || 1,
                    used_profiles: usage.profiles_used || data.profiles_used || 0,
                    max_accounts_per_platform: plan.max_accounts_per_platform || data.max_accounts_per_platform || 2,
                    plan_name: plan.name || data.plan_name || 'Free',
                    credits: data.credits || data.credits_remaining || 0,
                    expires_at: data.expires_at || null,
                    raw_data: data
                };

                console.log('✅ Upload-Post配额:', JSON.stringify(quota, null, 2));
                return {
                    success: true,
                    data: quota
                };
            }

            // 如果/me端点不可用，尝试备用端点
            console.log('⚠️ /me端点返回数据异常，尝试使用默认配额');
            return {
                success: true,
                data: {
                    max_profiles: 1,
                    used_profiles: 0,
                    max_accounts_per_platform: 2,  // 免费账号默认每平台2个
                    plan_name: 'Free',
                    note: '使用默认配额（/me端点数据异常）'
                }
            };

        } catch (error) {
            console.error('❌ Get quota error:', error.message);

            // 返回默认配额（免费账号）
            return {
                success: true,
                data: {
                    max_profiles: 1,
                    used_profiles: 0,
                    max_accounts_per_platform: 2,
                    plan_name: 'Free',
                    note: `使用默认配额（API错误: ${error.message}）`
                }
            };
        }
    }

    /**
     * 13. 获取用户当前已使用的配额
     * @param {number} userId - 用户ID
     * @returns {Promise<{platform_usage: object, total_accounts: number}>}
     */
    async getUserQuotaUsage(userId) {
        try {
            const profileResult = await pool.query(
                'SELECT upload_post_user FROM user_upload_post_profiles WHERE user_id = $1',
                [userId]
            );

            if (profileResult.rows.length === 0) {
                return {
                    success: true,
                    data: {
                        platform_usage: {},
                        total_accounts: 0
                    }
                };
            }

            const uploadPostUser = profileResult.rows[0].upload_post_user;

            // 获取Upload-Post上的账号列表
            const accountsResult = await this.getProfileAccounts(uploadPostUser);

            if (!accountsResult.success) {
                // 如果API失败，从本地数据库查询
                const localResult = await pool.query(`
                    SELECT platform, COUNT(*) as count
                    FROM social_accounts
                    WHERE user_id = $1 AND is_active = true
                    GROUP BY platform
                `, [userId]);

                const platform_usage = {};
                let total = 0;

                localResult.rows.forEach(row => {
                    platform_usage[row.platform] = parseInt(row.count);
                    total += parseInt(row.count);
                });

                return {
                    success: true,
                    data: {
                        platform_usage,
                        total_accounts: total,
                        source: 'local_database'
                    }
                };
            }

            // 统计每个平台的账号数量
            const accounts = accountsResult.data.accounts || accountsResult.data.platforms || [];
            const platform_usage = {};

            accounts.forEach(account => {
                const platform = account.platform || account.type;
                if (!platform_usage[platform]) {
                    platform_usage[platform] = 0;
                }
                platform_usage[platform]++;
            });

            return {
                success: true,
                data: {
                    platform_usage,
                    total_accounts: accounts.length,
                    source: 'upload_post_api'
                }
            };

        } catch (error) {
            console.error('❌ Get user quota usage error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}


// 导出单例
const uploadPostService = new UploadPostService();

export default uploadPostService;
