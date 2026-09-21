// =====================================================
// Profile配额管理仪表盘
// 路径: web/src/pages/admin-profile-quota.tsx
// 说明: 管理员监控和管理Profile配额使用情况
// =====================================================

import { useState, useEffect } from 'react';
import {
    Card,
    Row,
    Col,
    Statistic,
    Progress,
    Alert,
    Table,
    Button,
    Space,
    Tag,
    Modal,
    Form,
    InputNumber,
    message,
    Divider,
    Tooltip
} from 'antd';
import {
    UserOutlined,
    WarningOutlined,
    CheckCircleFilled,
    CloseCircleFilled,
    DeleteOutlined,
    ReloadOutlined,
    SettingOutlined,
    ArrowUpOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

interface ProfileQuota {
    max_profiles: number;
    current_used: number;
    available: number;
    usage_percent: number;
    is_warning: boolean;
    is_full: boolean;
}

interface ProfileUsage {
    user_id: string;
    username: string;
    email: string;
    upload_post_user: string;
    profile_created_at: string;
    connected_platforms_count: number;
    platforms: Array<{
        platform: string;
        username: string;
        is_active: boolean;
    }>;
    total_publish_tasks: number;
    completed_tasks: number;
}

interface Recommendation {
    type: 'error' | 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    actions?: string[];
}

export default function AdminProfileQuotaPage() {
    const [quota, setQuota] = useState<ProfileQuota | null>(null);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [profiles, setProfiles] = useState<ProfileUsage[]>([]);
    const [loading, setLoading] = useState(false);
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        loadQuotaInfo();
        loadProfiles();
    }, []);

    async function loadQuotaInfo() {
        try {
            const res = await fetch('/api/admin/profile-quota/quota', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                }
            });
            const data = await res.json();

            if (data.success) {
                // 转换字符串类型的数字字段为number类型
                const normalizedQuota = {
                    ...data.data.quota,
                    max_profiles: parseInt(data.data.quota.max_profiles),
                    current_used: parseInt(data.data.quota.current_used),
                    available: parseInt(data.data.quota.available),
                    usage_percent: parseFloat(data.data.quota.usage_percent),
                };
                setQuota(normalizedQuota);
                setRecommendations(data.data.recommendations || []);
            }
        } catch (error) {
            console.error('Load quota error:', error);
            message.error('加载配额信息失败');
        }
    }

    async function loadProfiles() {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/profile-quota/profiles/usage', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                }
            });
            const data = await res.json();

            if (data.success) {
                setProfiles(data.data);
            }
        } catch (error) {
            console.error('Load profiles error:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleUpdateSettings() {
        try {
            const values = await form.validateFields();

            const res = await fetch('/api/admin/profile-quota/quota/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                },
                body: JSON.stringify(values)
            });

            const data = await res.json();

            if (data.success) {
                message.success('配额设置已更新');
                setSettingsModalOpen(false);
                loadQuotaInfo();
            } else {
                message.error(data.message);
            }
        } catch (error: any) {
            console.error('Update settings error:', error);
            message.error('更新失败');
        }
    }

    async function handleDeleteProfile(userId: string, username: string) {
        Modal.confirm({
            title: '确认删除用户',
            content: `删除用户 ${username} 后，将释放1个Profile配额。此操作不可恢复，确定继续吗？`,
            okText: '确定删除',
            cancelText: '取消',
            okType: 'danger',
            onOk: async () => {
                try {
                    const res = await fetch(`/api/admin/profile-quota/profiles/${userId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                        }
                    });

                    const data = await res.json();

                    if (data.success) {
                        message.success('用户已删除，Profile已释放');
                        loadQuotaInfo();
                        loadProfiles();
                    } else {
                        message.error(data.message);
                    }
                } catch (error) {
                    console.error('Delete profile error:', error);
                    message.error('删除失败');
                }
            }
        });
    }

    function getStatusColor(quota: ProfileQuota | null) {
        if (!quota) return 'default';
        if (quota.is_full) return 'exception';
        if (quota.is_warning) return 'warning';
        return 'success';
    }

    function getAlertType(type: string): 'success' | 'info' | 'warning' | 'error' {
        if (type === 'error' || type === 'critical') return 'error';
        if (type === 'warning') return 'warning';
        return 'info';
    }

    const columns: ColumnsType<ProfileUsage> = [
        {
            title: '用户',
            key: 'user',
            width: 200,
            render: (_, record) => (
                <Space direction="vertical" size={0}>
                    <span className="font-semibold">{record.username}</span>
                    <span className="text-xs text-gray-500">{record.email}</span>
                    <span className="text-xs text-gray-400 font-mono">{record.upload_post_user}</span>
                </Space>
            )
        },
        {
            title: '已连接平台',
            dataIndex: 'connected_platforms_count',
            key: 'platforms',
            width: 300,
            render: (_, record) => (
                <Space wrap>
                    {record.platforms?.map((p, idx) => (
                        <Tag key={idx} color={p.is_active ? 'blue' : 'default'}>
                            {p.platform}: @{p.username}
                        </Tag>
                    )) || <span className="text-gray-400">未连接</span>}
                </Space>
            )
        },
        {
            title: '发布任务',
            key: 'tasks',
            width: 120,
            render: (_, record) => (
                <Space direction="vertical" size={0}>
                    <span>总计: {record.total_publish_tasks}</span>
                    <span className="text-green-600">成功: {record.completed_tasks}</span>
                </Space>
            )
        },
        {
            title: '创建时间',
            dataIndex: 'profile_created_at',
            key: 'created',
            width: 180,
            render: (time) => new Date(time).toLocaleString('zh-CN')
        },
        {
            title: '操作',
            key: 'actions',
            width: 100,
            render: (_, record) => (
                <Button
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteProfile(record.user_id, record.username)}
                >
                    删除
                </Button>
            )
        }
    ];

    if (!quota) {
        return (
            <div className="p-6">
                <Alert
                    message="正在加载配额信息..."
                    type="info"
                    showIcon
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50 p-6 pb-24">
            {/* 配额概览 */}
            <div className="mb-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-700 flex items-center gap-2">
                    <UserOutlined className="text-blue-600" />
                    Profile配额概览
                </h3>
                <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
                        <div className="text-sm text-blue-600 font-medium">Profile总配额</div>
                        <div className="mt-2 text-3xl font-bold text-blue-700">{quota.max_profiles}</div>
                        <div className="mt-1 text-xs text-gray-500">最大可用数量</div>
                    </div>
                    <div className="rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-white p-6 shadow-sm">
                        <div className="text-sm text-green-600 font-medium">已使用</div>
                        <div className="mt-2 text-3xl font-bold text-green-700">{quota.current_used}</div>
                        <div className="mt-1 text-xs text-gray-500">当前使用中</div>
                    </div>
                    <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-6 shadow-sm">
                        <div className="text-sm text-purple-600 font-medium">剩余可用</div>
                        <div className="mt-2 text-3xl font-bold text-purple-700">{quota.available}</div>
                        <div className="mt-1 text-xs text-gray-500">可注册用户数</div>
                    </div>
                    <div className="rounded-lg border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-6 shadow-sm">
                        <div className="text-sm text-cyan-600 font-medium">使用率</div>
                        <div className="mt-2 text-3xl font-bold text-cyan-700">{quota.usage_percent.toFixed(1)}%</div>
                        <div className="mt-1 text-xs text-gray-500">配额使用比例</div>
                    </div>
                </div>
            </div>

            {/* 配额进度条 */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-700 m-0">Profile配额使用情况</h3>
                    <Space>
                        <Button
                            icon={<SettingOutlined />}
                            onClick={() => {
                                form.setFieldsValue({
                                    max_profiles: quota.max_profiles,
                                    profile_quota_warning_threshold: Math.floor(quota.max_profiles * 0.8)
                                });
                                setSettingsModalOpen(true);
                            }}
                        >
                            配额设置
                        </Button>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => {
                                loadQuotaInfo();
                                loadProfiles();
                            }}
                        >
                            刷新
                        </Button>
                    </Space>
                </div>
                <Progress
                    percent={quota.usage_percent}
                    status={getStatusColor(quota)}
                    strokeWidth={20}
                    strokeColor={{
                        '0%': '#52c41a',
                        '60%': '#faad14',
                        '80%': '#ff4d4f',
                    }}
                    format={(percent) => `${quota.current_used} / ${quota.max_profiles} (${percent?.toFixed(1)}%)`}
                />
                <div className="mt-4">
                    {quota.is_full ? (
                        <Alert
                            message="⚠️ 配额已满！无法注册新用户，请立即升级Upload-Post订阅或删除不活跃用户。"
                            type="error"
                            showIcon
                            banner
                            style={{ backgroundColor: 'white', borderColor: '#cbd5e1' }}
                        />
                    ) : quota.is_warning ? (
                        <Alert
                            message="⚠️ 配额即将用完，建议提前升级Upload-Post订阅。"
                            type="warning"
                            showIcon
                            banner
                            style={{ backgroundColor: 'white', borderColor: '#cbd5e1' }}
                        />
                    ) : (
                        <Alert
                            message={`✅ 配额正常，还可注册 ${quota.available} 个用户。`}
                            type="success"
                            showIcon
                            banner
                            style={{ backgroundColor: 'white', borderColor: '#cbd5e1' }}
                        />
                    )}
                </div>
            </div>

            {/* 建议和预警 */}
            {recommendations.length > 0 && (
                <div className="mb-6">
                    {recommendations.map((rec, idx) => (
                        <Alert
                            key={idx}
                            message={rec.message}
                            type={getAlertType(rec.type)}
                            showIcon
                            banner
                            className="mb-2"
                            style={{ backgroundColor: 'white', borderColor: '#cbd5e1' }}
                        />
                    ))}
                </div>
            )}

            {/* Profile使用列表 */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <UserOutlined className="text-blue-600 text-xl" />
                    <h3 className="text-lg font-semibold text-gray-700 m-0">用户Profile使用情况</h3>
                </div>
                <Table
                    columns={columns}
                    dataSource={profiles}
                    rowKey="user_id"
                    loading={loading}
                    pagination={{
                        pageSize: 20,
                        showTotal: (total) => `共 ${total} 个用户`
                    }}
                    scroll={{ x: 1200 }}
                />
            </div>

            {/* 配额设置弹窗 */}
            <Modal
                title="Profile配额设置"
                open={settingsModalOpen}
                onCancel={() => setSettingsModalOpen(false)}
                onOk={handleUpdateSettings}
                okText="保存"
                cancelText="取消"
            >
                <Alert
                    message="重要说明"
                    description="Profile上限应与Upload-Post订阅套餐一致。修改前请确认已升级Upload-Post订阅。"
                    type="warning"
                    showIcon
                    className="mb-4"
                    style={{ backgroundColor: 'white', borderColor: '#cbd5e1' }}
                />

                <Form form={form} layout="vertical">
                    <Form.Item
                        label="Profile最大数量"
                        name="max_profiles"
                        rules={[
                            { required: true, message: '请输入最大数量' },
                            { type: 'number', min: 1, message: '必须大于0' }
                        ]}
                        extra="根据Upload-Post订阅套餐设置：Free=2, Basic=5, Professional=25, Advanced=75"
                    >
                        <InputNumber style={{ width: '100%' }} min={1} />
                    </Form.Item>

                    <Form.Item
                        label="预警阈值"
                        name="profile_quota_warning_threshold"
                        extra="达到此数量时发出预警，建议设置为最大数量的80%"
                    >
                        <InputNumber style={{ width: '100%' }} min={1} />
                    </Form.Item>
                </Form>

                <Divider />

                <div className="bg-white border border-gray-200 p-3 rounded text-sm">
                    <div className="font-semibold mb-2">Upload-Post订阅参考：</div>
                    <ul className="space-y-1">
                        <li>• Free: $0/月 - 2 profiles</li>
                        <li>• Basic: $24/月 - 5 profiles</li>
                        <li>• Professional: $50/月 - 25 profiles</li>
                        <li>• Advanced: $147/月 - 75 profiles</li>
                        <li>• Business: $438/月 - 225 profiles</li>
                    </ul>
                </div>
            </Modal>

            <style>{`
                .admin-layout .ant-alert-success,
                .admin-layout .ant-alert-warning,
                .admin-layout .ant-alert-error,
                .admin-layout .ant-alert-info {
                    background-color: white !important;
                    border-color: #cbd5e1 !important;
                }
            `}</style>
        </div>
    );
}
