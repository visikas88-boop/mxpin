// =====================================================
// 获取Upload-Post支持的平台列表
// 路径: server/src/routes/platformsInfo.js
// =====================================================

import express from 'express';

const router = express.Router();

// Upload-Post支持的22个平台（基于官方文档）
const SUPPORTED_PLATFORMS = [
    { id: 'facebook', name: 'Facebook', supports: { video: true, image: true } },
    { id: 'instagram', name: 'Instagram', supports: { video: true, image: true } },
    { id: 'youtube', name: 'YouTube', supports: { video: true, image: false } },
    { id: 'tiktok', name: 'TikTok', supports: { video: true, image: true } },
    { id: 'pinterest', name: 'Pinterest', supports: { video: true, image: true } },
    { id: 'linkedin', name: 'LinkedIn', supports: { video: true, image: true } },
    { id: 'twitter', name: 'X', supports: { video: true, image: true } },
    { id: 'threads', name: 'Threads', supports: { video: true, image: true } },
    { id: 'reddit', name: 'Reddit', supports: { video: true, image: true } },
    { id: 'bluesky', name: 'Bluesky', supports: { video: true, image: true } },
    { id: 'discord', name: 'Discord', supports: { video: true, image: true } },
    { id: 'telegram', name: 'Telegram', supports: { video: true, image: true } },
    { id: 'google-business', name: 'Google 商家资料', supports: { video: true, image: true } },
    { id: 'mastodon', name: 'Mastodon', supports: { video: true, image: true } },
    { id: 'lemmy', name: 'Lemmy', supports: { video: true, image: true } },
    { id: 'nostr', name: 'Nostr', supports: { video: true, image: true } },
    { id: 'wordpress', name: 'WordPress', supports: { video: true, image: true } },
    { id: 'hashnode', name: 'Hashnode', supports: { video: false, image: true } },
    { id: 'devto', name: 'Dev.to', supports: { video: false, image: true } },
    { id: 'listmonk', name: 'Listmonk', supports: { video: false, image: true } },
    { id: 'slack', name: 'Slack', supports: { video: true, image: true } },
    { id: 'whop', name: 'Whop', supports: { video: false, image: true } }
];

/**
 * GET /api/platforms/supported
 * 获取Upload-Post支持的平台列表
 */
router.get('/supported', async (req, res) => {
    try {
        // 返回静态平台列表
        res.json({
            success: true,
            data: SUPPORTED_PLATFORMS
        });
    } catch (error) {
        console.error('Get platforms error:', error);
        res.status(500).json({
            success: false,
            message: error.message || '获取平台列表失败'
        });
    }
});

export default router;
