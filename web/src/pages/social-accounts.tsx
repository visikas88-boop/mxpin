// =====================================================
// 社交账号管理页面 v2.0 - 国际化+修复登录检测
// 路径: web/src/pages/social-accounts.tsx
// 说明: 用户连接和管理社交账号，支持中英文切换
// =====================================================

import { useState, useEffect } from 'react';
import { Card, Button, Space, Table, Tag, message, Modal, Alert, Tooltip, Empty } from 'antd';
import {
    PlusOutlined,
    DeleteOutlined,
    SyncOutlined,
    CheckCircleFilled,
    CloseCircleFilled,
    EyeOutlined,
    EyeInvisibleOutlined,
    WarningOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PlatformConnectModal } from '@/components/publishing/PlatformConnectModal';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface SocialAccount {
    id: number;
    platform: string;
    platform_username: string;
    platform_display_name: string;
    platform_avatar_url: string;
    is_active: boolean;
    connection_status: string;
    last_sync_at: string;
    created_at: string;
    current_count?: number;
    subscription_limit?: number;
}

const PLATFORM_INFO: Record<string, { name: string; color: string; icon: string }> = {
    instagram: { name: 'Instagram', color: '#E4405F', icon: '📷' },
    tiktok: { name: 'TikTok', color: '#000000', icon: '🎵' },
    youtube: { name: 'YouTube', color: '#FF0000', icon: '▶️' },
    facebook: { name: 'Facebook', color: '#1877F2', icon: '📘' },
    twitter: { name: 'Twitter/X', color: '#1DA1F2', icon: '🐦' },
    linkedin: { name: 'LinkedIn', color: '#0A66C2', icon: '💼' },
    pinterest: { name: 'Pinterest', color: '#E60023', icon: '📌' },
    reddit: { name: 'Reddit', color: '#FF4500', icon: '🔴' }
};

export default function SocialAccountsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<SocialAccount[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [connectModalOpen, setConnectModalOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(true);

    useEffect(() => {
        // 先检查登录状态（支持管理员和普通用户）
        const token = localStorage.getItem('auth_token')
            || localStorage.getItem('admin_token')
            || localStorage.getItem('token')
            || localStorage.getItem('user_token');

        if (!token) {
            setIsLoggedIn(false);
            message.warning(t('common.pleaseLogin') || '请先登录');
            // 不自动跳转，显示提示
            return;
        }

        loadAccounts();

        // 检查URL参数（OAuth回调）
        const params = new URLSearchParams(window.location.search);
        if (params.get('success') === 'true') {
            message.success(`${params.get('platform')} ${t('publishing.accountConnected') || '账号连接成功'}！`);
            window.history.replaceState({}, '', window.location.pathname);
        } else if (params.get('error')) {
            message.error(`${t('publishing.connectFailed') || '连接失败'}: ${params.get('error')}`);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [t]);

    async function loadAccounts() {
        setLoading(true);
        try {
            // 优先使用 auth_token（普通用户），然后是 admin_token（管理员）
            const token = localStorage.getItem('auth_token')
                || localStorage.getItem('admin_token')
                || localStorage.getItem('token')
                || localStorage.getItem('user_token');

            if (!token) {
                setIsLoggedIn(false);
                setAccounts([]);
                setLoading(false);
                return;
            }

            const res = await fetch('http://localhost:3001/api/social-accounts', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                if (res.status === 401) {
                    message.error(t('publishing.loginExpired') || '登录已过期，请重新登录');
                    setIsLoggedIn(false);
                    setAccounts([]);
                    setLoading(false);
                    return;
                }
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();

            if (data.success) {
                setAccounts(data.data || []);
                setIsLoggedIn(true);
            } else {
                message.error(data.message || t('publishing.loadAccountsFailed') || '加载账号列表失败');
                setAccounts([]);
            }
        } catch (error) {
            console.error('Load accounts error:', error);
            message.error(t('publishing.loadAccountsFailed') || '加载账号列表失败');
            setAccounts([]);
        } finally {
            setLoading(false);
        }
    }

    async function handleSync() {
        setSyncing(true);
        try {
            const token = localStorage.getItem('auth_token')
                || localStorage.getItem('admin_token')
                || localStorage.getItem('token');
            const res = await fetch('http://localhost:3001/api/social-accounts/sync', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await res.json();

            if (data.success) {
                message.success(data.message || t('publishing.accountRefreshed'));
                loadAccounts();
            } else {
                message.error(data.message || t('publishing.syncFailed') || '同步失败');
            }
        } catch (error) {
            console.error('Sync error:', error);
            message.error(t('publishing.syncFailed') || '同步失败');
        } finally {
            setSyncing(false);
        }
    }

    async function handleDisconnect(account: SocialAccount) {
        Modal.confirm({
            title: t('publishing.disconnectConfirm') || '确认断开连接',
            content: `${t('publishing.disconnectAccount')} ${account.platform_display_name} (${PLATFORM_INFO[account.platform]?.name})？`,
            okText: t('common.confirm') || '确定',
            cancelText: t('common.cancel'),
            okType: 'danger',
            onOk: async () => {
                try {
                    const token = localStorage.getItem('auth_token')
                        || localStorage.getItem('admin_token')
                        || localStorage.getItem('token');
                    const res = await fetch(`http://localhost:3001/api/social-accounts/${account.id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    const data = await res.json();

                    if (data.success) {
                        message.success(t('publishing.accountDisconnected'));
                        loadAccounts();
                    } else {
                        message.error(data.message || t('publishing.disconnectFailed') || '断开连接失败');
                    }
                } catch (error) {
                    console.error('Disconnect error:', error);
                    message.error(t('publishing.disconnectFailed') || '断开连接失败');
                }
            }
        });
    }

    const columns: ColumnsType<SocialAccount> = [
        {
            title: t('publishing.platform') || '平台',
            dataIndex: 'platform',
            key: 'platform',
            render: (platform: string) => {
                const info = PLATFORM_INFO[platform] || { name: platform, color: '#666', icon: '🌐' };
                return (
                    <Space>
                        <span style={{ fontSize: '18px' }}>{info.icon}</span>
                        <Tag color={info.color}>{info.name}</Tag>
                    </Space>
                );
            }
        },
        {
            title: t('publishing.accountNumber') || '账号信息',
            key: 'account',
            render: (_, record) => (
                <Space direction="vertical" size={0}>
                    <span style={{ fontWeight: 500 }}>{record.platform_display_name}</span>
                    <span style={{ fontSize: '12px', color: '#999' }}>@{record.platform_username}</span>
                </Space>
            )
        },
        {
            title: t('publishing.status') || '状态',
            dataIndex: 'connection_status',
            key: 'status',
            render: (status: string, record) => (
                <Space>
                    {record.is_active ? (
                        <Tag icon={<CheckCircleFilled />} color="success">
                            {t('publishing.connected') || '已连接'}
                        </Tag>
                    ) : (
                        <Tag icon={<CloseCircleFilled />} color="error">
                            {t('publishing.inactive') || '未激活'}
                        </Tag>
                    )}
                </Space>
            )
        },
        {
            title: t('publishing.connectionTime') || '连接时间',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (date: string) => new Date(date).toLocaleString()
        },
        {
            title: t('publishing.lastSync') || '最后同步',
            dataIndex: 'last_sync_at',
            key: 'last_sync_at',
            render: (date: string) => date ? new Date(date).toLocaleString() : '-'
        },
        {
            title: t('common.actions') || '操作',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDisconnect(record)}
                    >
                        {t('publishing.disconnectAccount') || '断开'}
                    </Button>
                </Space>
            )
        }
    ];

    // 未登录提示
    if (!isLoggedIn) {
        return (
            <div style={{ padding: '24px' }}>
                <Card>
                    <Empty
                        image={<WarningOutlined style={{ fontSize: 64, color: '#faad14' }} />}
                        description={
                            <Space direction="vertical" size="large">
                                <span style={{ fontSize: '16px', color: '#595959' }}>
                                    {t('common.pleaseLogin') || '请先登录'}
                                </span>
                                <Button type="primary" onClick={() => navigate('/login')}>
                                    {t('common.goToLogin') || '前往登录'}
                                </Button>
                            </Space>
                        }
                    />
                </Card>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px' }}>
            <Card
                title={
                    <Space>
                        <span style={{ fontSize: '18px', fontWeight: 600 }}>
                            {t('publishing.accountManagement') || '社交账号管理'}
                        </span>
                        {accounts.length > 0 && (
                            <Tag color="blue">{accounts.length} {t('publishing.accounts') || '个账号'}</Tag>
                        )}
                    </Space>
                }
                extra={
                    <Space>
                        <Button
                            icon={<SyncOutlined />}
                            onClick={handleSync}
                            loading={syncing}
                        >
                            {t('publishing.sync') || '同步账号'}
                        </Button>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setConnectModalOpen(true)}
                        >
                            {t('publishing.connectAccount') || '连接账号'}
                        </Button>
                    </Space>
                }
            >
                {accounts.length === 0 && !loading ? (
                    <Empty
                        description={
                            <Space direction="vertical" size="middle">
                                <span>{t('publishing.noConnectedAccounts') || '暂无连接的账号'}</span>
                                <span style={{ fontSize: '12px', color: '#999' }}>
                                    {t('publishing.clickConnectToStart') || '点击右上角"连接账号"按钮开始添加'}
                                </span>
                            </Space>
                        }
                    />
                ) : (
                    <Table
                        columns={columns}
                        dataSource={accounts}
                        loading={loading}
                        rowKey="id"
                        pagination={{
                            pageSize: 10,
                            showTotal: (total) => `${t('common.total') || '共'} ${total} ${t('publishing.accounts') || '个账号'}`
                        }}
                    />
                )}
            </Card>

            <PlatformConnectModal
                open={connectModalOpen}
                onClose={() => setConnectModalOpen(false)}
                onConnect={() => {
                    setConnectModalOpen(false);
                    loadAccounts();
                }}
                currentPlatformCount={accounts.length}
            />
        </div>
    );
}
