import { useState, useEffect } from 'react';
import { Card, Checkbox, Tooltip, Badge, Spin, message } from 'antd';
import { InfoCircleOutlined, CheckCircleFilled } from '@ant-design/icons';
import { getPlatforms } from '@/services/api/publishing';
import type { PlatformPricing } from '@/types/publishing';
import { useTranslation } from 'react-i18next';

interface PlatformSelectorProps {
  value?: string[];
  onChange?: (platforms: string[]) => void;
  onCostChange?: (totalCost: number) => void;
  disabled?: boolean;
}

export default function PlatformSelector({
  value = [],
  onChange,
  onCostChange,
  disabled = false
}: PlatformSelectorProps) {
  const { t } = useTranslation();
  const [platforms, setPlatforms] = useState<PlatformPricing[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPlatforms();
  }, []);

  useEffect(() => {
    // 计算总费用
    const totalCost = platforms
      .filter(p => value.includes(p.platform))
      .reduce((sum, p) => sum + p.points_cost, 0);
    onCostChange?.(totalCost);
  }, [value, platforms]);

  async function loadPlatforms() {
    setLoading(true);
    try {
      const res = await getPlatforms();
      if (res.success && res.data) {
        setPlatforms(res.data);
      }
    } catch (error) {
      console.error('Load platforms error:', error);
      message.error(t('publishing.loadPlatformsFailed') || '加载平台列表失败');
    } finally {
      setLoading(false);
    }
  }

  function handleToggle(platform: string, isConnected: boolean) {
    if (disabled) return;

    if (!isConnected) {
      message.warning(t('publishing.connectAccountFirst') || '请先连接该平台账号');
      return;
    }

    const newValue = value.includes(platform)
      ? value.filter(p => p !== platform)
      : [...value, platform];

    onChange?.(newValue);
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {platforms.map(platform => {
        const isSelected = value.includes(platform.platform);
        const isConnected = platform.is_connected;

        return (
          <Card
            key={platform.platform}
            size="small"
            className={`
              cursor-pointer transition-all duration-200
              ${isSelected ? 'ring-2 ring-purple-500 bg-purple-50' : 'hover:shadow-md'}
              ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}
              ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
            `}
            onClick={() => handleToggle(platform.platform, isConnected)}
          >
            <div className="flex items-center gap-3">
              {/* 平台图标 */}
              <div className="flex-shrink-0">
                {platform.icon_url ? (
                  <img
                    src={platform.icon_url}
                    alt={platform.display_name}
                    className="w-12 h-12 rounded-lg"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                    {platform.display_name.charAt(0)}
                  </div>
                )}
              </div>

              {/* 平台信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 truncate">
                    {platform.display_name}
                  </span>
                  {!isConnected && (
                    <Badge status="default" text={t('publishing.notConnected') || '未连接'} />
                  )}
                  {isConnected && platform.connected_accounts && platform.connected_accounts > 1 && (
                    <Badge
                      count={platform.connected_accounts}
                      style={{ backgroundColor: '#52c41a' }}
                    />
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-semibold text-purple-600">
                    {platform.points_cost} {t('publishing.points') || '积分'}
                  </span>
                  {platform.description && (
                    <Tooltip title={platform.description}>
                      <InfoCircleOutlined className="text-gray-400" />
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* 选中图标 */}
              <div className="flex-shrink-0">
                {isSelected ? (
                  <CheckCircleFilled className="text-2xl text-purple-500" />
                ) : (
                  <div className="w-6 h-6 border-2 border-gray-300 rounded-full" />
                )}
              </div>
            </div>

            {/* 平台限制信息 */}
            {isSelected && platform.max_video_duration_sec && (
              <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                <div>
                  {t('publishing.maxDuration') || '最大时长'}: {Math.floor(platform.max_video_duration_sec / 60)}
                  {t('publishing.minutes') || '分钟'}
                </div>
                {platform.max_video_size_mb && (
                  <div>
                    {t('publishing.maxSize') || '最大大小'}: {platform.max_video_size_mb}MB
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}

      {platforms.length === 0 && !loading && (
        <div className="col-span-3 text-center py-12 text-gray-400">
          {t('publishing.noPlatformsAvailable') || '暂无可用平台'}
        </div>
      )}
    </div>
  );
}
