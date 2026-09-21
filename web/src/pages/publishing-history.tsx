// =====================================================
import { apiFetch } from "@/utils/api-config";
// 发布历史页面
// 路径: web/src/pages/publishing-history.tsx
// 说明: 用户查看视频发布任务列表和详情
// =====================================================

import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, Modal, message, Tooltip, Timeline, Empty } from 'antd';
import {
    ReloadOutlined,
    EyeOutlined,
    RedoOutlined,
    CheckCircleFilled,
    CloseCircleFilled,
    ClockCircleFilled,
    SyncOutlined,
    ExclamationCircleFilled
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';

interface PublishingTask {
    id: number;
    video_url: string;
    video_title: string;
    video_description: string;
    thumbnail_url: string;
    target_platforms: string[];
    status: 'pending' | 'processing' | 'completed' | 'partial_success' | 'failed' | 'cancelled';
    points_cost: number;
    points_deducted: boolean;
    created_at: string;
    started_at: string;
    completed_at: string;
    success_count?: number;
    failed_count?: number;
}

interface PublishingLog {
    id: number;
    task_id: number;
    platform: string;
    status: 'pending' | 'processing' | 'success' | 'failed';
    post_url: string;
    post_id: string;
    error_message: string;
    processed_at: string;
}

const STATUS_CONFIG = {
    pending: { text: '等待中', color: 'default', icon: <ClockCircleFilled /> },
    processing: { text: '处理中', color: 'processing', icon: <SyncOutlined spin /> },
    completed: { text: '全部成功', color: 'success', icon: <CheckCircleFilled /> },
    partial_success: { text: '部分成功', color: 'warning', icon: <ExclamationCircleFilled /> },
    failed: { text: '全部失败', color: 'error', icon: <CloseCircleFilled /> },
    cancelled: { text: '已取消', color: 'default', icon: <CloseCircleFilled /> }
};

const PLATFORM_INFO: Record<string, { name: string; color: string; icon: string }> = {
    instagram: { name: 'Instagram', color: '#E4405F', icon: '📷' },
    tiktok: { name: 'TikTok', color: '#000000', icon: '🎵' },
    youtube: { name: 'YouTube', color: '#FF0000', icon: '▶️' },
    facebook: { name: 'Facebook', color: '#1877F2', icon: '📘' },
    twitter: { name: 'Twitter/X', color: '#1DA1F2', icon: '🐦' },
    linkedin: { name: 'LinkedIn', color: '#0A66C2', icon: '💼' }
};

export default function PublishingHistoryPage() {
    const { t } = useTranslation();
    const [tasks, setTasks] = useState<PublishingTask[]>([]);
    const [loading, setLoading] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<PublishingTask | null>(null);
    const [taskLogs, setTaskLogs] = useState<PublishingLog[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await apiFetch('/publishing/tasks', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await response.json();
            if (response.ok) {
                setTasks(data.data || []);
            } else {
                message.error(data.message || '获取任务列表失败');
            }
        } catch (error) {
            message.error('网络错误');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTaskLogs = async (taskId: number) => {
        setLogsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await apiFetch(`/publishing/tasks/${taskId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await response.json();
            if (response.ok) {
                setTaskLogs(data.data.logs || []);
            } else {
                message.error(data.message || '获取任务详情失败');
            }
        } catch (error) {
            message.error('网络错误');
            console.error(error);
        } finally {
            setLogsLoading(false);
        }
    };

    const handleViewDetail = async (task: PublishingTask) => {
        setSelectedTask(task);
        setDetailModalOpen(true);
        await fetchTaskLogs(task.id);
    };

    const handleRetry = async (taskId: number) => {
        try {
            const token = localStorage.getItem('token');
            const response = await apiFetch(`/publishing/tasks/${taskId}/retry`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await response.json();
            if (response.ok) {
                message.success('重试任务已提交');
                fetchTasks();
            } else {
                message.error(data.message || '重试失败');
            }
        } catch (error) {
            message.error('网络错误');
            console.error(error);
        }
    };

    const columns: ColumnsType<PublishingTask> = [
        {
            title: '视频标题',
            dataIndex: 'video_title',
            key: 'video_title',
            width: 250,
            ellipsis: true,
            render: (text: string, record: PublishingTask) => (
                <div className="flex items-center gap-2">
                    {record.thumbnail_url && (
                        <img
                            src={record.thumbnail_url}
                            alt={text}
                            className="h-10 w-16 rounded object-cover"
                        />
                    )}
                    <Tooltip title={text}>
                        <span className="font-medium">{text}</span>
                    </Tooltip>
                </div>
            )
        },
        {
            title: '目标平台',
            dataIndex: 'target_platforms',
            key: 'target_platforms',
            width: 200,
            render: (platforms: string[]) => (
                <Space wrap>
                    {platforms.map(platform => {
                        const info = PLATFORM_INFO[platform] || { name: platform, icon: '📱', color: '#999' };
                        return (
                            <Tag key={platform} style={{ borderColor: info.color, color: info.color }}>
                                {info.icon} {info.name}
                            </Tag>
                        );
                    })}
                </Space>
            )
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status: string, record: PublishingTask) => {
                const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
                return (
                    <div className="space-y-1">
                        <Tag color={config.color} icon={config.icon}>
                            {config.text}
                        </Tag>
                        {status === 'partial_success' && (
                            <div className="text-xs text-gray-500">
                                {record.success_count}/{record.target_platforms.length}
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: '积分消耗',
            dataIndex: 'points_cost',
            key: 'points_cost',
            width: 100,
            render: (cost: number, record: PublishingTask) => (
                <div className="space-y-1">
                    <span className="font-semibold text-purple-600">{cost}</span>
                    {!record.points_deducted && (
                        <div className="text-xs text-gray-400">未扣除</div>
                    )}
                </div>
            )
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 180,
            render: (time: string) => new Date(time).toLocaleString('zh-CN')
        },
        {
            title: '操作',
            key: 'actions',
            width: 150,
            render: (_, record: PublishingTask) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewDetail(record)}
                    >
                        详情
                    </Button>
                    {(record.status === 'failed' || record.status === 'partial_success') && (
                        <Button
                            type="link"
                            size="small"
                            icon={<RedoOutlined />}
                            onClick={() => handleRetry(record.id)}
                        >
                            重试
                        </Button>
                    )}
                </Space>
            )
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-slate-50 p-6">
            <div className="mx-auto max-w-7xl space-y-6">
                {/* 页面头部 */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">发布历史</h1>
                        <p className="mt-1 text-sm text-gray-500">查看和管理您的视频发布任务</p>
                    </div>
                    <Button
                        type="primary"
                        icon={<ReloadOutlined />}
                        onClick={fetchTasks}
                        loading={loading}
                    >
                        刷新
                    </Button>
                </div>

                {/* 任务列表 */}
                <Card>
                    <Table
                        columns={columns}
                        dataSource={tasks}
                        rowKey="id"
                        loading={loading}
                        pagination={{
                            pageSize: 20,
                            showTotal: (total) => `共 ${total} 条任务`,
                            showSizeChanger: true
                        }}
                        locale={{
                            emptyText: (
                                <Empty
                                    description="暂无发布任务"
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                />
                            )
                        }}
                    />
                </Card>

                {/* 任务详情弹窗 */}
                <Modal
                    title="任务详情"
                    open={detailModalOpen}
                    onCancel={() => setDetailModalOpen(false)}
                    footer={null}
                    width={800}
                >
                    {selectedTask && (
                        <div className="space-y-6">
                            {/* 基本信息 */}
                            <div className="space-y-3">
                                <div className="flex items-start gap-4">
                                    {selectedTask.thumbnail_url && (
                                        <img
                                            src={selectedTask.thumbnail_url}
                                            alt={selectedTask.video_title}
                                            className="h-24 w-40 rounded-lg object-cover"
                                        />
                                    )}
                                    <div className="flex-1 space-y-2">
                                        <h3 className="text-lg font-semibold">{selectedTask.video_title}</h3>
                                        <p className="text-sm text-gray-600">{selectedTask.video_description}</p>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span>积分消耗: <span className="font-semibold text-purple-600">{selectedTask.points_cost}</span></span>
                                            <span>创建时间: {new Date(selectedTask.created_at).toLocaleString('zh-CN')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 各平台发布结果 */}
                            <div>
                                <h4 className="mb-4 text-base font-semibold">各平台发布结果</h4>
                                {logsLoading ? (
                                    <div className="text-center text-gray-500">加载中...</div>
                                ) : taskLogs.length > 0 ? (
                                    <Timeline
                                        items={taskLogs.map(log => {
                                            const platformInfo = PLATFORM_INFO[log.platform] || { name: log.platform, icon: '📱', color: '#999' };
                                            const isSuccess = log.status === 'success';

                                            return {
                                                color: isSuccess ? 'green' : log.status === 'processing' ? 'blue' : 'red',
                                                dot: isSuccess ? <CheckCircleFilled /> : log.status === 'processing' ? <SyncOutlined spin /> : <CloseCircleFilled />,
                                                children: (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg">{platformInfo.icon}</span>
                                                            <span className="font-medium">{platformInfo.name}</span>
                                                            <Tag color={isSuccess ? 'success' : log.status === 'processing' ? 'processing' : 'error'}>
                                                                {log.status === 'success' ? '成功' : log.status === 'processing' ? '处理中' : '失败'}
                                                            </Tag>
                                                        </div>
                                                        {log.post_url && (
                                                            <a
                                                                href={log.post_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm text-blue-600 hover:underline"
                                                            >
                                                                查看帖子 →
                                                            </a>
                                                        )}
                                                        {log.error_message && (
                                                            <div className="text-sm text-red-600">{log.error_message}</div>
                                                        )}
                                                        {log.processed_at && (
                                                            <div className="text-xs text-gray-400">
                                                                {new Date(log.processed_at).toLocaleString('zh-CN')}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            };
                                        })}
                                    />
                                ) : (
                                    <Empty description="暂无发布记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                )}
                            </div>
                        </div>
                    )}
                </Modal>
            </div>
        </div>
    );
}
