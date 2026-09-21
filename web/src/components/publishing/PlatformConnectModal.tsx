// =====================================================
// 平台连接弹窗组件 v4.1 - 国际化+优化UI
// 路径: web/src/components/publishing/PlatformConnectModal.tsx
// 说明: 5列卡片布局，国际化支持，优化文字和标签可读性
// =====================================================

import { useState, useEffect } from 'react';
import { Modal, Input, Tag, message, Alert, Spin } from 'antd';
import { SearchOutlined, CheckCircleFilled, InfoCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { getConnectUrl } from '@/services/api/publishing';
import { useTranslation } from 'react-i18next';

interface Platform {
  id: string;
  name: string;
  icon: string;
  description: string;
  descriptionEn: string;
  features: string[];
  featuresEn: string[];
  supports: {
    video: boolean;
    image: boolean;
  };
}

interface PlatformConnectModalProps {
  open: boolean;
  onClose: () => void;
  onConnect: () => void;
  currentPlatformCount?: number;
}

// 平台详细信息配置（中英文）
const PLATFORM_CONFIG: Record<string, { description: string; descriptionEn: string; features: string[]; featuresEn: string[] }> = {
  'tiktok': {
    description: '全球短视频霸主，病毒式传播首选',
    descriptionEn: 'Global short video leader, viral content',
    features: ['短视频', '爆款内容', '挑战赛', '热门音乐'],
    featuresEn: ['Short Videos', 'Viral', 'Challenges', 'Trending']
  },
  'instagram': {
    description: 'Reels和Stories双引擎视觉平台',
    descriptionEn: 'Visual platform with Reels & Stories',
    features: ['Reels', 'Stories', '信息流', '轮播图'],
    featuresEn: ['Reels', 'Stories', 'Feed', 'Carousel']
  },
  'youtube': {
    description: '长视频之王，高质量内容变现',
    descriptionEn: 'Long-form video king, monetization',
    features: ['长视频', '视频系列', '教育内容', '变现'],
    featuresEn: ['Long Videos', 'Series', 'Education', 'Monetize']
  },
  'facebook': {
    description: '全球社交网络，社群品牌双剑合璧',
    descriptionEn: 'Global network for community & brand',
    features: ['信息流', 'Stories', '页面管理', '直播'],
    featuresEn: ['Feed', 'Stories', 'Pages', 'Live']
  },
  'pinterest': {
    description: '视觉灵感引擎，Pin图驱动流量',
    descriptionEn: 'Visual inspiration, Pin-driven traffic',
    features: ['Pin图', '看板组织', '灵感创意', '电商引流'],
    featuresEn: ['Pins', 'Boards', 'Inspiration', 'E-commerce']
  },
  'linkedin': {
    description: '职场社交首选，建立行业权威',
    descriptionEn: 'Professional network, build authority',
    features: ['职场内容', '业务更新', '行业洞察', '人脉'],
    featuresEn: ['Professional', 'Updates', 'Insights', 'Network']
  },
  'twitter': {
    description: '实时话题中心，快速传播观点',
    descriptionEn: 'Real-time hub, rapid spread',
    features: ['推文', '实时更新', '话题追踪', '社区'],
    featuresEn: ['Tweets', 'Real-time', 'Hashtags', 'Community']
  },
  'x': {
    description: '实时话题中心，快速传播观点',
    descriptionEn: 'Real-time hub, rapid spread',
    features: ['推文', '实时更新', '话题追踪', '社区'],
    featuresEn: ['Tweets', 'Real-time', 'Hashtags', 'Community']
  },
  'threads': {
    description: 'Instagram文字版，对话社区参与',
    descriptionEn: 'Text-based Instagram integration',
    features: ['文本帖', '回复', '热门话题', 'IG集成'],
    featuresEn: ['Text Posts', 'Replies', 'Topics', 'IG Integration']
  },
  'reddit': {
    description: '兴趣社区集合，精准触达用户',
    descriptionEn: 'Interest communities, targeted reach',
    features: ['文本&链接', '子版块', '排期', 'Flair'],
    featuresEn: ['Text & Links', 'Subreddits', 'Schedule', 'Flair']
  },
  'bluesky': {
    description: '去中心化社交新星，开放协议',
    descriptionEn: 'Decentralized social, open protocol',
    features: ['文本帖', '图片', '去中心化', '开放协议'],
    featuresEn: ['Posts', 'Images', 'Decentralized', 'AT Protocol']
  },
  'discord': {
    description: 'Webhook直达频道，无需OAuth',
    descriptionEn: 'Webhook delivery, no OAuth needed',
    features: ['文本消息', '图片', '视频', 'Webhook'],
    featuresEn: ['Messages', 'Images', 'Videos', 'Webhook']
  },
  'telegram': {
    description: 'Bot机器人消息群发神器',
    descriptionEn: 'Bot messaging, group broadcasts',
    features: ['文本消息', '相册', '视频', 'Bot令牌'],
    featuresEn: ['Messages', 'Albums', 'Videos', 'Bot Token']
  },
  'google-business': {
    description: '本地商家必备，Google搜索优先',
    descriptionEn: 'Local business essential, SEO priority',
    features: ['标准帖', '活动帖', '优惠帖', 'CTA'],
    featuresEn: ['Posts', 'Events', 'Offers', 'CTA Buttons']
  },
  'mastodon': {
    description: '联邦宇宙节点，任意实例发布',
    descriptionEn: 'Fediverse node, any instance',
    features: ['嘟文', '最多4图', '视频', '任意实例'],
    featuresEn: ['Toots', 'Up to 4 Photos', 'Videos', 'Any Instance']
  },
  'lemmy': {
    description: 'Reddit替代品，联邦式社区',
    descriptionEn: 'Reddit alternative, federated',
    features: ['文本帖', '图片', '任意社区', '任意实例'],
    featuresEn: ['Posts', 'Images', 'Any Community', 'Any Instance']
  },
  'nostr': {
    description: '抗审查笔记网络，多中继广播',
    descriptionEn: 'Censorship-resistant, multi-relay',
    features: ['文本笔记', '多中继', '密钥签名', '抗审查'],
    featuresEn: ['Notes', 'Multi-Relay', 'Key Signing', 'Resistant']
  },
  'wordpress': {
    description: '自托管博客，完全掌控内容',
    descriptionEn: 'Self-hosted blog, full control',
    features: ['帖子', '特色图', '视频', '应用密码'],
    featuresEn: ['Posts', 'Featured Images', 'Videos', 'App Password']
  },
  'hashnode': {
    description: '开发者博客，GraphQL发布',
    descriptionEn: 'Developer blog, GraphQL API',
    features: ['Markdown', '发布目标', 'PAT授权', '开发博客'],
    featuresEn: ['Markdown', 'Targets', 'PAT Auth', 'Dev Blog']
  },
  'devto': {
    description: '程序员社区，Markdown即时发布',
    descriptionEn: 'Developer community, instant publish',
    features: ['Markdown', '标题+正文', 'API密钥', '即时发布'],
    featuresEn: ['Markdown', 'Title + Body', 'API Key', 'Instant']
  },
  'dev.to': {
    description: '程序员社区，Markdown即时发布',
    descriptionEn: 'Developer community, instant publish',
    features: ['Markdown', '标题+正文', 'API密钥', '即时发布'],
    featuresEn: ['Markdown', 'Title + Body', 'API Key', 'Instant']
  },
  'listmonk': {
    description: '邮件营销自托管，精准推送',
    descriptionEn: 'Self-hosted email marketing',
    features: ['邮件营销', '列表定向', 'HTML正文', '自托管'],
    featuresEn: ['Email Campaigns', 'List Targeting', 'HTML Body', 'Self-Hosted']
  },
  'slack': {
    description: 'Webhook消息实时通知频道',
    descriptionEn: 'Webhook instant channel delivery',
    features: ['文本消息', 'Webhook', '即时', '免OAuth'],
    featuresEn: ['Messages', 'Webhook', 'Instant', 'No OAuth']
  },
  'whop': {
    description: '创作者社区，API密钥管理',
    descriptionEn: 'Creator community, API key mgmt',
    features: ['论坛帖', '话题回复', 'API密钥', '社区'],
    featuresEn: ['Forum Posts', 'Replies', 'API Key', 'Community']
  }
};

export function PlatformConnectModal({
  open,
  onClose,
  onConnect,
  currentPlatformCount = 0
}: PlatformConnectModalProps) {
  const { t, i18n } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(false);

  const isEnglish = i18n.language === 'en-US' || i18n.language === 'en';

  // 加载真实支持的平台列表
  useEffect(() => {
    if (open) {
      fetchSupportedPlatforms();
    }
  }, [open]);

  const fetchSupportedPlatforms = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/platforms/supported');
      const result = await response.json();

      if (result.success && result.data) {
        // 映射图标、描述和功能标签
        const platformsWithDetails = result.data.map((p: any) => {
          const config = PLATFORM_CONFIG[p.id.toLowerCase()] || {
            description: '多平台内容发布，扩大品牌影响力',
            descriptionEn: 'Multi-platform publishing',
            features: ['内容发布', '自动化'],
            featuresEn: ['Publishing', 'Automation']
          };

          return {
            ...p,
            icon: getIconUrl(p.id),
            description: config.description,
            descriptionEn: config.descriptionEn,
            features: config.features,
            featuresEn: config.featuresEn
          };
        });
        setPlatforms(platformsWithDetails);
      } else {
        message.error(t('publishing.loadPlatformsFailed'));
      }
    } catch (error) {
      console.error('获取平台列表失败:', error);
      message.error(t('publishing.loadPlatformsFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 获取平台图标URL（使用Simple Icons CDN + UI Avatars降级）
  const getIconUrl = (platformId: string) => {
    const iconMap: Record<string, string> = {
      'facebook': 'https://cdn.simpleicons.org/facebook/1877F2',
      'instagram': 'https://cdn.simpleicons.org/instagram/E4405F',
      'youtube': 'https://cdn.simpleicons.org/youtube/FF0000',
      'tiktok': 'https://cdn.simpleicons.org/tiktok/000000',
      'pinterest': 'https://cdn.simpleicons.org/pinterest/E60023',
      'linkedin': 'https://cdn.simpleicons.org/linkedin/0A66C2',
      'twitter': 'https://cdn.simpleicons.org/x/000000',
      'x': 'https://cdn.simpleicons.org/x/000000',
      'threads': 'https://cdn.simpleicons.org/threads/000000',
      'reddit': 'https://cdn.simpleicons.org/reddit/FF4500',
      'bluesky': 'https://cdn.simpleicons.org/bluesky/1185FE',
      'discord': 'https://cdn.simpleicons.org/discord/5865F2',
      'telegram': 'https://cdn.simpleicons.org/telegram/26A5E4',
      'google-business': 'https://cdn.simpleicons.org/google/4285F4',
      'mastodon': 'https://cdn.simpleicons.org/mastodon/6364FF',
      'lemmy': 'https://cdn.simpleicons.org/lemmy/00BC8C',
      'nostr': 'https://cdn.simpleicons.org/nostr/8B5CF6',
      'wordpress': 'https://cdn.simpleicons.org/wordpress/21759B',
      'hashnode': 'https://cdn.simpleicons.org/hashnode/2962FF',
      'devto': 'https://cdn.simpleicons.org/devdotto/0A0A0A',
      'dev.to': 'https://cdn.simpleicons.org/devdotto/0A0A0A',
      'listmonk': 'https://cdn.simpleicons.org/mailchimp/FFE01B',
      'slack': 'https://cdn.simpleicons.org/slack/4A154B',
      'whop': 'https://cdn.simpleicons.org/shopify/7AB55C'
    };

    return iconMap[platformId.toLowerCase()] || `https://ui-avatars.com/api/?name=${platformId}&size=32&background=random`;
  };

  // 连接平台处理
  const handleConnect = async (platformId: string) => {
    setConnecting(true);
    try {
      const response = await getConnectUrl(platformId);
      if (response.success && response.data?.authUrl) {
        window.open(response.data.authUrl, '_blank', 'width=600,height=700');
        message.success(t('publishing.authWindowOpened'));
        onConnect();
      } else {
        message.error(response.message || t('publishing.getAuthUrlFailed'));
      }
    } catch (error) {
      console.error('连接平台失败:', error);
      message.error(t('publishing.connectFailed'));
    } finally {
      setConnecting(false);
    }
  };

  // 搜索过滤
  const filteredPlatforms = platforms.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <CheckCircleFilled className="text-blue-500 text-lg" />
          <span className="text-base font-semibold">{t('publishing.connectPlatform')}</span>
          <Tag color="blue" style={{ fontSize: '10px', padding: '0 6px', lineHeight: '18px' }}>
            {t('publishing.platformCount', { count: platforms.length })}
          </Tag>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={1100}
      centered
      styles={{
        body: {
          padding: '16px 20px',
          maxHeight: '70vh',
          overflowY: 'auto'
        }
      }}
    >
      {/* 指纹浏览器安全提示 */}
      <Alert
        icon={<InfoCircleOutlined />}
        type="info"
        showIcon
        style={{
          backgroundColor: '#e6f4ff',
          border: '1px solid #91caff',
          padding: '8px 12px',
          marginBottom: '14px',
          fontSize: '11px',
          lineHeight: '1.6'
        }}
        description={t('publishing.securityTip')}
      />

      {/* 搜索框 */}
      <div style={{ marginBottom: '14px' }}>
        <Input
          placeholder={t('publishing.searchPlatform')}
          prefix={<SearchOutlined style={{ color: '#bfbfbf', fontSize: '12px' }} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          allowClear
          style={{ fontSize: '12px' }}
        />
      </div>

      {/* 平台卡片网格 - 5列官方风格 */}
      {loading ? (
        <div className="flex justify-center items-center" style={{ height: '250px' }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} tip={isEnglish ? 'Loading platforms...' : '加载平台中...'} />
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-3" style={{ maxHeight: 'calc(70vh - 200px)', overflowY: 'auto', paddingRight: '4px' }}>
          {filteredPlatforms.map((platform) => (
            <button
              key={platform.id}
              onClick={() => handleConnect(platform.id)}
              disabled={connecting}
              className="flex flex-col p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all bg-white disabled:opacity-50 disabled:cursor-not-allowed text-left"
              style={{ minHeight: '165px' }}
            >
              {/* 第一行：图标 + 平台名称 */}
              <div className="flex items-center gap-2 mb-2.5">
                <img
                  src={platform.icon}
                  alt={platform.name}
                  className="w-8 h-8 object-contain flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${platform.name}&size=32&background=random`;
                  }}
                />
                <span className="text-sm font-semibold text-gray-900 line-clamp-1">
                  {platform.name}
                </span>
              </div>

              {/* 第二行：平台描述（严格2行） */}
              <p className="text-[10.5px] text-gray-600 leading-[1.5] mb-2.5 flex-1" style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                minHeight: '31.5px',
                maxHeight: '31.5px'
              }}>
                {isEnglish ? platform.descriptionEn : platform.description}
              </p>

              {/* 第三行：功能标签（优化可读性） */}
              <div className="flex flex-wrap gap-1">
                {(isEnglish ? platform.featuresEn : platform.features).slice(0, 4).map((feature, index) => (
                  <span
                    key={index}
                    className="text-[9px] px-2 py-1 bg-blue-50 text-blue-700 rounded font-medium"
                    style={{ lineHeight: '1.2', whiteSpace: 'nowrap' }}
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 无搜索结果 */}
      {!loading && filteredPlatforms.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          {t('publishing.noResultsFound')}
        </div>
      )}
    </Modal>
  );
}
