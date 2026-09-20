// =====================================================
// Upload-Post Profile 智能管理服务
// 路径: server/src/services/profileService.js
// 说明: Profile配额管理、智能分配、统计查询
// =====================================================

import pool from '../config/database.js';
import uploadPostService from './uploadPostService.js';

class ProfileService {
    /**
     * 为平台选择或创建Profile
     * @param {number} userId - 用户ID
     * @param {string} platform - 平台名称
     * @returns {Promise<{profileId: string, isNew: boolean, message: string}>}
     */
    async selectOrCreateProfile(userId, platform) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. 获取Upload-Post真实配额
            const quotaResult = await uploadPostService.getAccountQuota();
            const uploadPostQuota = quotaResult.data;

            // 2. 获取用户当前使用情况
            const usageResult = await uploadPostService.getUserQuotaUsage(userId);
            const platformUsage = usageResult.data?.platform_usage || {};
            const currentPlatformCount = platformUsage[platform] || 0;

            // 3. 检查是否超过该平台的配额限制
            const maxPerPlatform = uploadPostQuota.max_accounts_per_platform;

            if (currentPlatformCount >= maxPerPlatform) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    error: `该平台已达配额上限(${currentPlatformCount}/${maxPerPlatform})`,
                    quota: {
                        current: currentPlatformCount,
                        max: maxPerPlatform,
                        platform: platform,
                        plan: uploadPostQuota.plan_name
                    }
                };
            }

            // 4. 调用数据库函数检查是否需要创建新Profile
            const selectResult = await client.query(
                'SELECT select_profile_for_platform($1, $2) as profile_id',
                [userId, platform]
            );

            const existingProfileId = selectResult.rows[0]?.profile_id;

            if (existingProfileId) {
                // 复用现有Profile
                await client.query('COMMIT');
                return {
                    success: true,
                    profileId: existingProfileId,
                    isNew: false,
                    message: `复用现有Profile (${currentPlatformCount + 1}/${maxPerPlatform})`,
                    quota: {
                        current: currentPlatformCount,
                        max: maxPerPlatform,
                        remaining: maxPerPlatform - currentPlatformCount - 1
                    }
                };
            }

            // 5. 需要创建新Profile - 使用Upload-Post配额检查
            const profileCountResult = await client.query(
                'SELECT COUNT(*) as count FROM upload_post_profiles WHERE user_id = $1',
                [userId]
            );
            const usedProfiles = parseInt(profileCountResult.rows[0].count);

            if (usedProfiles >= uploadPostQuota.max_profiles) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    error: `Profile配额已用完(${usedProfiles}/${uploadPostQuota.max_profiles})，无法授权更多同平台账号`,
                    quota: {
                        used: usedProfiles,
                        max: uploadPostQuota.max_profiles,
                        plan: uploadPostQuota.plan_name
                    }
                };
            }

            // 6. 通过Upload-Post API创建新Profile
            const createResult = await uploadPostService.createProfile(userId);

            if (!createResult.success) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    error: '创建Profile失败: ' + createResult.error
                };
            }

            const uploadPostProfileId = createResult.data.profile_id || createResult.data.id;

            // 7. 生成Profile名称
            const profileNumber = usedProfiles + 1;
            const profileName = `Profile #${profileNumber}`;

            // 8. 保存到数据库
            const insertResult = await client.query(`
                INSERT INTO upload_post_profiles (
                    user_id,
                    upload_post_profile_id,
                    profile_name,
                    platforms_authorized,
                    account_count
                ) VALUES ($1, $2, $3, $4, 0)
                RETURNING *
            `, [userId, uploadPostProfileId, profileName, []]);

            await client.query('COMMIT');

            return {
                success: true,
                profileId: uploadPostProfileId,
                isNew: true,
                profileName: profileName,
                message: `创建新Profile: ${profileName} (${currentPlatformCount + 1}/${maxPerPlatform})`,
                quota: {
                    current: currentPlatformCount,
                    max: maxPerPlatform,
                    remaining: maxPerPlatform - currentPlatformCount - 1
                }
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Select or create profile error:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * 检查用户Profile配额
     * @param {number} userId - 用户ID
     * @param {object} client - 数据库客户端（可选）
     * @returns {Promise<{canAdd: boolean, used: number, max: number, remaining: number, message: string}>}
     */
    async checkQuota(userId, client = null) {
        const db = client || pool;

        try {
            const result = await db.query(`
                SELECT
                    COALESCE(us.max_profiles, 1) as max_profiles,
                    COUNT(DISTINCT upp.id) as used_profiles,
                    us.plan_name
                FROM users u
                LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
                LEFT JOIN upload_post_profiles upp ON u.id = upp.user_id AND upp.is_active = true
                WHERE u.id = $1
                GROUP BY u.id, us.max_profiles, us.plan_name
            `, [userId]);

            if (result.rows.length === 0) {
                return {
                    canAdd: false,
                    used: 0,
                    max: 1,
                    remaining: 0,
                    message: '用户不存在'
                };
            }

            const { max_profiles, used_profiles, plan_name } = result.rows[0];
            const remaining = max_profiles - used_profiles;

            return {
                canAdd: remaining > 0,
                used: parseInt(used_profiles),
                max: max_profiles,
                remaining: remaining,
                planName: plan_name || 'Free',
                message: remaining > 0
                    ? `还可创建 ${remaining} 个Profile`
                    : `Profile配额已用完(${used_profiles}/${max_profiles})，请升级套餐`
            };

        } catch (error) {
            console.error('Check quota error:', error);
            throw error;
        }
    }

    /**
     * 获取用户的所有Profile
     * @param {number} userId - 用户ID
     * @returns {Promise<Array>}
     */
    async getUserProfiles(userId) {
        try {
            const result = await pool.query(`
                SELECT
                    upp.*,
                    COUNT(sa.id) as actual_account_count,
                    ARRAY_AGG(
                        DISTINCT sa.platform
                    ) FILTER (WHERE sa.platform IS NOT NULL) as actual_platforms
                FROM upload_post_profiles upp
                LEFT JOIN social_accounts sa
                    ON upp.upload_post_profile_id = sa.upload_post_profile_id
                    AND sa.is_active = true
                WHERE upp.user_id = $1
                GROUP BY upp.id
                ORDER BY upp.created_at ASC
            `, [userId]);

            return {
                success: true,
                data: result.rows
            };

        } catch (error) {
            console.error('Get user profiles error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 获取Profile使用统计
     * @param {number} userId - 用户ID
     * @returns {Promise<object>}
     */
    async getProfileUsageStats(userId) {
        try {
            const result = await pool.query(`
                SELECT * FROM v_profile_usage_stats WHERE user_id = $1
            `, [userId]);

            if (result.rows.length === 0) {
                return {
                    success: true,
                    data: {
                        user_id: userId,
                        max_profiles: 1,
                        used_profiles: 0,
                        remaining_profiles: 1,
                        total_accounts: 0,
                        platforms_used: [],
                        usage_percentage: 0
                    }
                };
            }

            return {
                success: true,
                data: result.rows[0]
            };

        } catch (error) {
            console.error('Get profile usage stats error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 获取Profile详情（包含账号列表）
     * @param {string} profileId - Profile ID
     * @param {number} userId - 用户ID（用于验证权限）
     * @returns {Promise<object>}
     */
    async getProfileDetails(profileId, userId) {
        try {
            const result = await pool.query(`
                SELECT * FROM v_profile_details
                WHERE upload_post_profile_id = $1
                AND user_id = $2
            `, [profileId, userId]);

            if (result.rows.length === 0) {
                return {
                    success: false,
                    error: 'Profile不存在或无权访问'
                };
            }

            return {
                success: true,
                data: result.rows[0]
            };

        } catch (error) {
            console.error('Get profile details error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 删除Profile（同时删除关联账号）
     * @param {string} profileId - Profile ID
     * @param {number} userId - 用户ID
     * @returns {Promise<object>}
     */
    async deleteProfile(profileId, userId) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. 验证权限
            const checkResult = await client.query(
                'SELECT * FROM upload_post_profiles WHERE upload_post_profile_id = $1 AND user_id = $2',
                [profileId, userId]
            );

            if (checkResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    error: 'Profile不存在或无权删除'
                };
            }

            // 2. 删除Upload-Post上的Profile
            await uploadPostService.deleteProfile(profileId);

            // 3. 删除关联的社交账号
            await client.query(
                'DELETE FROM social_accounts WHERE upload_post_profile_id = $1',
                [profileId]
            );

            // 4. 删除Profile记录
            await client.query(
                'DELETE FROM upload_post_profiles WHERE upload_post_profile_id = $1',
                [profileId]
            );

            await client.query('COMMIT');

            return {
                success: true,
                message: 'Profile已删除'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Delete profile error:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * 获取平台授权建议
     * @param {number} userId - 用户ID
     * @param {string} platform - 平台名称
     * @returns {Promise<object>}
     */
    async getAuthorizationSuggestion(userId, platform) {
        try {
            // 1. 获取配额信息
            const quota = await this.checkQuota(userId);

            // 2. 检查该平台是否已有账号
            const platformCheck = await pool.query(`
                SELECT COUNT(*) as count
                FROM social_accounts
                WHERE user_id = $1 AND platform = $2 AND is_active = true
            `, [userId, platform]);

            const hasPlatformAccount = parseInt(platformCheck.rows[0].count) > 0;

            // 3. 生成建议
            let suggestion = {
                canAuthorize: quota.canAdd || !hasPlatformAccount,
                willCreateNewProfile: hasPlatformAccount,
                quota: quota,
                message: '',
                tips: []
            };

            if (hasPlatformAccount) {
                suggestion.message = `检测到已有${platform}账号，将创建新Profile`;
                suggestion.tips.push('建议使用指纹浏览器避免账号关联');

                if (!quota.canAdd) {
                    suggestion.canAuthorize = false;
                    suggestion.message = `Profile配额已用完(${quota.used}/${quota.max})，无法授权更多同平台账号`;
                    suggestion.tips.push(`升级到更高套餐可获得更多Profile配额`);
                }
            } else {
                if (quota.used > 0) {
                    suggestion.message = `将复用现有Profile授权${platform}账号`;
                    suggestion.tips.push(`节约配额: ${quota.max}个Profile中已使用${quota.used}个`);
                } else {
                    suggestion.message = `将创建Profile #1并授权${platform}账号`;
                }
            }

            return {
                success: true,
                data: suggestion
            };

        } catch (error) {
            console.error('Get authorization suggestion error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default new ProfileService();
