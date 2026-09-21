// =====================================================
// 套餐管理后台页面
// 路径: web/src/pages/admin-subscription-plans.tsx
// =====================================================

import { useState, useEffect } from 'react';
import {
    Card,
    Table,
    Button,
    Modal,
    Form,
    Input,
    InputNumber,
    Switch,
    Select,
    Space,
    message,
    Tabs,
    Tag,
    Statistic,
    Row,
    Col,
    Progress,
    Tooltip,
    Divider,
    Alert
} from 'antd';
import {
    EditOutlined,
    DeleteOutlined,
    PlusOutlined,
    HistoryOutlined,
    EyeOutlined,
    EyeInvisibleOutlined,
    ArrowUpOutlined,
    ArrowDownOutlined,
    DollarOutlined,
    LineChartOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

interface SubscriptionPlan {
    id: number;
    plan_id: string;
    plan_name: string;
    plan_name_en: string;
    price_monthly: number;
    price_yearly: number;
    monthly_credits: number;
    max_social_profiles: number;
    max_monthly_publishes: number;
    upload_post_cost: number;
    ai_generation_cost: number;
    total_cost: number;
    profit_amount: number;
    profit_margin: number;
    features: any;
    feature_list: any[];
    description: string;
    description_en: string;
    is_enabled: boolean;
    is_visible: boolean;
    is_popular: boolean;
    sort_order: number;
    badge_text: string;
    badge_color: string;
    subscriber_count?: number;
    actual_monthly_revenue?: number;
    actual_monthly_cost?: number;
    actual_monthly_profit?: number;
}

interface ProfitStats {
    total_subscribers: number;
    total_monthly_revenue: number;
    total_monthly_cost: number;
    total_monthly_profit: number;
    avg_profit_margin: number;
}

export default function AdminSubscriptionPlansPage() {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [profitStats, setProfitStats] = useState<ProfitStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
    const [historyData, setHistoryData] = useState([]);
    const [form] = Form.useForm();

    useEffect(() => {
        loadPlans();
        loadProfitStats();
    }, []);

    async function loadPlans() {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/subscription/plans', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                }
            });
            const data = await res.json();
            if (data.success) {
                // 转换字符串类型的数字字段为number类型
                const normalizedPlans = data.data.map((plan: any) => ({
                    ...plan,
                    price_monthly: parseFloat(plan.price_monthly),
                    price_yearly: parseFloat(plan.price_yearly),
                    upload_post_cost: parseFloat(plan.upload_post_cost),
                    ai_generation_cost: parseFloat(plan.ai_generation_cost),
                    total_cost: parseFloat(plan.total_cost),
                    profit_amount: parseFloat(plan.profit_amount),
                    profit_margin: parseFloat(plan.profit_margin),
                    subscriber_count: parseInt(plan.subscriber_count) || 0,
                    actual_monthly_revenue: parseFloat(plan.actual_monthly_revenue) || 0,
                    actual_monthly_cost: parseFloat(plan.actual_monthly_cost) || 0,
                    actual_monthly_profit: parseFloat(plan.actual_monthly_profit) || 0,
                }));
                setPlans(normalizedPlans);
            } else {
                message.error(data.message);
            }
        } catch (error) {
            console.error('Load plans error:', error);
            message.error('加载套餐列表失败');
        } finally {
            setLoading(false);
        }
    }

    async function loadProfitStats() {
        try {
            const res = await fetch('/api/admin/subscription/stats/profit-overview', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                }
            });
            const data = await res.json();
            if (data.success) {
                setProfitStats(data.data);
            }
        } catch (error) {
            console.error('Load profit stats error:', error);
        }
    }

    function handleEdit(plan: SubscriptionPlan) {
        setEditingPlan(plan);
        form.setFieldsValue({
            ...plan,
            features: JSON.stringify(plan.features, null, 2),
            feature_list: JSON.stringify(plan.feature_list, null, 2)
        });
        setEditModalOpen(true);
    }

    function handleCreateNew() {
        setEditingPlan(null);
        form.resetFields();
        // 设置默认值
        form.setFieldsValue({
            plan_id: `plan_${Date.now()}`,
            is_enabled: true,
            is_visible: true,
            is_popular: false,
            sort_order: plans.length + 1,
            features: JSON.stringify({
                videoResolutions: ['720p', '1080p', '4K'],
                scheduledPublish: true,
                batchPublish: true,
                batchPublishLimit: 10
            }, null, 2),
            feature_list: JSON.stringify([
                { text: '视频生成积分', text_en: 'Video generation credits' },
                { text: '社交账号连接', text_en: 'Social accounts connection' }
            ], null, 2)
        });
        setEditModalOpen(true);
    }

    async function handleSave() {
        try {
            const values = await form.validateFields();

            const payload = {
                ...values,
                features: JSON.parse(values.features),
                feature_list: JSON.parse(values.feature_list)
            };

            // 判断是新建还是更新
            const isCreate = !editingPlan;
            const url = isCreate
                ? '/api/admin/subscription/plans'
                : `/api/admin/subscription/plans/${editingPlan.id}`;
            const method = isCreate ? 'POST' : 'PUT';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.success) {
                message.success(isCreate ? '套餐创建成功' : '套餐配置已更新');
                setEditModalOpen(false);
                loadPlans();
                loadProfitStats();
            } else {
                message.error(data.message);
            }

        } catch (error: any) {
            console.error('Save plan error:', error);
            if (error.errorFields) {
                message.error('请检查表单填写是否正确');
            } else {
                message.error('保存失败');
            }
        }
    }

    async function handleDelete(plan: SubscriptionPlan) {
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除套餐"${plan.plan_name}"吗？此操作不可恢复。`,
            okText: '确定',
            cancelText: '取消',
            okType: 'danger',
            onOk: async () => {
                try {
                    const res = await fetch(`/api/admin/subscription/plans/${plan.id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                        }
                    });

                    const data = await res.json();

                    if (data.success) {
                        message.success('套餐已删除');
                        loadPlans();
                        loadProfitStats();
                    } else {
                        message.error(data.message);
                    }
                } catch (error) {
                    console.error('Delete plan error:', error);
                    message.error('删除失败');
                }
            }
        });
    }

    async function handleViewHistory(plan: SubscriptionPlan) {
        try {
            const res = await fetch(`/api/admin/subscription/plans/${plan.id}/history`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                }
            });
            const data = await res.json();
            if (data.success) {
                setHistoryData(data.data);
                setHistoryModalOpen(true);
            }
        } catch (error) {
            message.error('加载历史记录失败');
        }
    }

    const columns: ColumnsType<SubscriptionPlan> = [
        {
            title: '套餐名称',
            dataIndex: 'plan_name',
            key: 'plan_name',
            fixed: 'left',
            width: 140,
            render: (text, record) => (
                <Space direction="vertical" size={0}>
                    <Space size={4}>
                        <span className="font-semibold text-sm">{text}</span>
                        {record.is_popular && <Tag color="purple" className="text-xs">热门</Tag>}
                    </Space>
                    <span className="text-gray-400 text-xs">{record.plan_id}</span>
                    {!record.is_visible && <Tag color="default" className="text-xs mt-1">隐藏</Tag>}
                </Space>
            )
        },
        {
            title: '定价',
            key: 'price',
            width: 100,
            render: (_, record) => (
                <Space direction="vertical" size={0}>
                    <span className="font-bold text-base">¥{record.price_monthly}</span>
                    <span className="text-gray-400 text-xs">月付</span>
                    <span className="text-gray-400 text-xs">¥{record.price_yearly}/年</span>
                </Space>
            )
        },
        {
            title: '成本分析',
            key: 'cost',
            width: 150,
            render: (_, record) => (
                <Space direction="vertical" size={0} className="w-full">
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">API:</span>
                        <span className="text-red-600">¥{record.upload_post_cost}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">AI:</span>
                        <span className="text-red-600">¥{record.ai_generation_cost}</span>
                    </div>
                    <Divider className="my-1" />
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-600 font-medium">成本:</span>
                        <span className="font-semibold text-red-700">¥{record.total_cost}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-600 font-medium">利润:</span>
                        <span className="font-semibold text-green-600">¥{record.profit_amount}</span>
                    </div>
                </Space>
            )
        },
        {
            title: '利润率',
            dataIndex: 'profit_margin',
            key: 'profit_margin',
            width: 100,
            sorter: (a, b) => a.profit_margin - b.profit_margin,
            render: (value) => {
                const color = value >= 200 ? 'green' : value >= 150 ? 'orange' : value >= 100 ? 'blue' : 'red';
                const status = value >= 200 ? '✅ 达标' : value >= 150 ? '⚠️ 接近' : '❌ 低';
                return (
                    <Space direction="vertical" size={0}>
                        <Tag color={color} className="text-sm font-bold">
                            {value.toFixed(1)}%
                        </Tag>
                        <span className="text-xs text-gray-500">{status}</span>
                    </Space>
                );
            }
        },
        {
            title: '配额',
            key: 'quota',
            width: 130,
            render: (_, record) => (
                <Space direction="vertical" size={0}>
                    <div className="text-xs">
                        <span className="text-gray-500">积分: </span>
                        <span className="font-medium">{record.monthly_credits}</span>
                    </div>
                    <div className="text-xs">
                        <span className="text-gray-500">账号: </span>
                        <span className="font-medium">{record.max_social_profiles}个</span>
                    </div>
                    <div className="text-xs">
                        <span className="text-gray-500">发布: </span>
                        <span className="font-medium">
                            {record.max_monthly_publishes === -1 ? '无限' : `${record.max_monthly_publishes}次`}
                        </span>
                    </div>
                </Space>
            )
        },
        {
            title: '订阅数',
            dataIndex: 'subscriber_count',
            key: 'subscriber_count',
            width: 80,
            align: 'center',
            sorter: (a, b) => (a.subscriber_count || 0) - (b.subscriber_count || 0),
            render: (value) => (
                <div className="text-center">
                    <div className="text-xl font-bold text-blue-600">{value || 0}</div>
                    <div className="text-xs text-gray-400">位用户</div>
                </div>
            )
        },
        {
            title: '实际收益',
            key: 'actual_profit',
            width: 130,
            render: (_, record) => {
                if (!record.subscriber_count || record.subscriber_count === 0) {
                    return <span className="text-gray-400 text-xs">-</span>;
                }
                return (
                    <Space direction="vertical" size={0}>
                        <div className="text-xs text-gray-500">
                            收入: ¥{(record.actual_monthly_revenue || 0).toFixed(0)}
                        </div>
                        <div className="text-xs text-gray-500">
                            成本: ¥{(record.actual_monthly_cost || 0).toFixed(0)}
                        </div>
                        <div className="text-sm font-bold text-green-600">
                            ¥{(record.actual_monthly_profit || 0).toFixed(0)}
                        </div>
                    </Space>
                );
            }
        },
        {
            title: '状态',
            key: 'status',
            width: 80,
            align: 'center',
            render: (_, record) => (
                <Space direction="vertical" size={2}>
                    <Tag color={record.is_enabled ? 'green' : 'red'} className="text-xs">
                        {record.is_enabled ? '启用' : '禁用'}
                    </Tag>
                    {record.is_visible ? (
                        <Tooltip title="前台可见">
                            <EyeOutlined className="text-green-500 text-sm" />
                        </Tooltip>
                    ) : (
                        <Tooltip title="前台隐藏">
                            <EyeInvisibleOutlined className="text-gray-400 text-sm" />
                        </Tooltip>
                    )}
                </Space>
            )
        },
        {
            title: '操作',
            key: 'actions',
            fixed: 'right',
            width: 120,
            render: (_, record) => (
                <Space direction="vertical" size={2}>
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        size="small"
                        type="link"
                        className="!p-0 !h-auto"
                    >
                        编辑
                    </Button>
                    <Button
                        icon={<HistoryOutlined />}
                        onClick={() => handleViewHistory(record)}
                        size="small"
                        type="link"
                        className="!p-0 !h-auto"
                    >
                        历史
                    </Button>
                    <Button
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record)}
                        size="small"
                        danger
                        type="link"
                        className="!p-0 !h-auto"
                    >
                        删除
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50 p-6 pb-24">
            {/* 利润统计看板 */}
            {profitStats && (
                <div className="mb-6">
                    <h3 className="mb-4 text-lg font-semibold text-gray-700 flex items-center gap-2">
                        <DollarOutlined className="text-blue-600" />
                        利润统计
                    </h3>
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
                            <div className="text-sm text-blue-600 font-medium">总订阅用户</div>
                            <div className="mt-2 text-3xl font-bold text-blue-700">{profitStats.total_subscribers}</div>
                            <div className="mt-1 text-xs text-gray-500">当前活跃订阅</div>
                        </div>
                        <div className="rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-white p-6 shadow-sm">
                            <div className="text-sm text-green-600 font-medium">月度总收入</div>
                            <div className="mt-2 text-3xl font-bold text-green-700">¥{profitStats.total_monthly_revenue.toFixed(0)}</div>
                            <div className="mt-1 text-xs text-gray-500">本月预计收入</div>
                        </div>
                        <div className="rounded-lg border border-red-200 bg-gradient-to-br from-red-50 to-white p-6 shadow-sm">
                            <div className="text-sm text-red-600 font-medium">月度总成本</div>
                            <div className="mt-2 text-3xl font-bold text-red-700">¥{profitStats.total_monthly_cost.toFixed(0)}</div>
                            <div className="mt-1 text-xs text-gray-500">Upload-Post + AI</div>
                        </div>
                        <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-6 shadow-sm">
                            <div className="text-sm text-purple-600 font-medium">月度净利润</div>
                            <div className="mt-2 text-3xl font-bold text-purple-700">¥{profitStats.total_monthly_profit.toFixed(0)}</div>
                            <div className="mt-1 text-xs text-gray-500">利润率 {profitStats.avg_profit_margin.toFixed(1)}%</div>
                        </div>
                    </div>
                </div>
            )}

            {/* 套餐列表 */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <DollarOutlined className="text-blue-600 text-xl" />
                        <h3 className="text-lg font-semibold text-gray-700 m-0">套餐配置管理</h3>
                        <Tag color="purple">高利润率策略</Tag>
                    </div>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleCreateNew}
                        size="large"
                    >
                        新建套餐
                    </Button>
                </div>

                <Alert
                    message={
                        <span>
                            <strong>利润率说明：</strong>
                            ✅ 达标≥200% | ⚠️ 接近150-200% | ❌ 偏低&lt;150%
                        </span>
                    }
                    type="info"
                    showIcon
                    closable
                    className="mb-4"
                    style={{ backgroundColor: 'white', borderColor: '#cbd5e1' }}
                />

                <Table
                    columns={columns}
                    dataSource={plans}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1300 }}
                    pagination={false}
                    size="small"
                    className="[&_.ant-table-cell]:!py-2"
                />

                <style>{`
                    .admin-layout .ant-alert-info {
                        background-color: white !important;
                        border-color: #cbd5e1 !important;
                    }
                    .admin-layout .ant-pagination-options .ant-select-selector,
                    .admin-layout .dark .ant-pagination-options .ant-select-selector {
                        background-color: white !important;
                        border: 1px solid #cbd5e1 !important;
                        color: #1e293b !important;
                    }
                    .admin-layout .ant-select-dropdown,
                    .admin-layout .dark .ant-select-dropdown {
                        background-color: white !important;
                    }
                `}</style>
            </div>

            {/* 编辑弹窗 */}
            <Modal
                title={editingPlan ? `编辑套餐: ${editingPlan.plan_name}` : '新建套餐'}
                open={editModalOpen}
                onCancel={() => setEditModalOpen(false)}
                onOk={handleSave}
                width={1000}
                okText="保存"
                cancelText="取消"
            >
                <Form form={form} layout="vertical">
                    <PlanEditForm form={form} />
                </Form>
            </Modal>

            {/* 历史记录弹窗 */}
            <Modal
                title="配置变更历史"
                open={historyModalOpen}
                onCancel={() => setHistoryModalOpen(false)}
                footer={null}
                width={800}
            >
                <HistoryTimeline data={historyData} />
            </Modal>
        </div>
    );
}

// =====================================================
// 套餐编辑表单组件
// =====================================================
function PlanEditForm({ form }: { form: any }) {
    return (
        <Tabs
            items={[
                {
                    key: 'basic',
                    label: '基础信息',
                    children: <BasicInfoTab form={form} />
                },
                {
                    key: 'quota',
                    label: '配额设置',
                    children: <QuotaTab />
                },
                {
                    key: 'features',
                    label: '功能权限',
                    children: <FeaturesTab />
                },
                {
                    key: 'display',
                    label: '显示设置',
                    children: <DisplayTab />
                }
            ]}
        />
    );
}

// 基础信息标签页
function BasicInfoTab({ form }: { form: any }) {
    return (
        <>
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item label="套餐名称（中文）" name="plan_name" rules={[{ required: true }]}>
                        <Input placeholder="如：专业版" />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item label="套餐名称（英文）" name="plan_name_en">
                        <Input placeholder="如：Professional" />
                    </Form.Item>
                </Col>
            </Row>

            {/* 成本设置 */}
            <Card title="成本设置" size="small" className="mb-4">
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Upload-Post月费成本"
                            name="upload_post_cost"
                            rules={[{ required: true }]}
                            extra="美元价格×7（汇率）"
                        >
                            <InputNumber style={{ width: '100%' }} prefix="¥" min={0} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="AI生成预估成本" name="ai_generation_cost" extra="每月AI调用预估成本">
                            <InputNumber style={{ width: '100%' }} prefix="¥" min={0} />
                        </Form.Item>
                    </Col>
                </Row>
            </Card>

            {/* 利润率计算器 */}
            <ProfitCalculator form={form} />

            {/* 定价 */}
            <Card title="定价策略" size="small" className="mb-4">
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label="月付价格" name="price_monthly" rules={[{ required: true }]}>
                            <InputNumber style={{ width: '100%' }} prefix="¥" min={0} step={100} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="年付价格" name="price_yearly" extra="建议：月付×10（节省17%）">
                            <InputNumber style={{ width: '100%' }} prefix="¥" min={0} step={100} />
                        </Form.Item>
                    </Col>
                </Row>

                <PricingSuggestion form={form} />
            </Card>
        </>
    );
}

// 配额设置标签页
function QuotaTab() {
    return (
        <>
            <Form.Item
                label="每月视频生成积分"
                name="monthly_credits"
                rules={[{ required: true }]}
                extra="用于视频/图片生成（引流工具）"
            >
                <InputNumber style={{ width: '100%' }} min={0} step={100} />
            </Form.Item>

            <Form.Item
                label="最大社交账号数"
                name="max_social_profiles"
                rules={[{ required: true }]}
                extra="对应Upload-Post的Profile限制（核心盈利点）"
            >
                <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>

            <Form.Item
                label="每月最大发布次数"
                name="max_monthly_publishes"
                extra="-1表示无限次（推荐）"
            >
                <InputNumber style={{ width: '100%' }} min={-1} />
            </Form.Item>
        </>
    );
}

// 功能权限标签页
function FeaturesTab() {
    return (
        <>
            <Form.Item
                label="功能配置（JSON）"
                name="features"
                rules={[
                    { required: true },
                    {
                        validator: (_, value) => {
                            try {
                                JSON.parse(value);
                                return Promise.resolve();
                            } catch {
                                return Promise.reject('请输入有效的JSON');
                            }
                        }
                    }
                ]}
            >
                <Input.TextArea
                    rows={12}
                    placeholder={JSON.stringify(
                        {
                            videoResolutions: ['720p', '1080p', '4K'],
                            scheduledPublish: true,
                            batchPublish: true,
                            batchPublishLimit: 10
                        },
                        null,
                        2
                    )}
                />
            </Form.Item>

            <Form.Item
                label="功能列表（用于前台展示）"
                name="feature_list"
                rules={[
                    {
                        validator: (_, value) => {
                            try {
                                JSON.parse(value);
                                return Promise.resolve();
                            } catch {
                                return Promise.reject('请输入有效的JSON');
                            }
                        }
                    }
                ]}
            >
                <Input.TextArea
                    rows={10}
                    placeholder={JSON.stringify(
                        [
                            { text: '5000积分/月', text_en: '5000 credits/month' },
                            { text: '连接25个社交账号', text_en: 'Connect 25 accounts' }
                        ],
                        null,
                        2
                    )}
                />
            </Form.Item>
        </>
    );
}

// 显示设置标签页
function DisplayTab() {
    return (
        <>
            <Row gutter={16}>
                <Col span={8}>
                    <Form.Item label="启用状态" name="is_enabled" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item label="前台可见" name="is_visible" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item label="标记为热门" name="is_popular" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                </Col>
            </Row>

            <Form.Item label="角标文字" name="badge_text">
                <Input placeholder="如：最受欢迎、限时优惠" />
            </Form.Item>

            <Form.Item label="角标颜色" name="badge_color">
                <Select>
                    <Select.Option value="purple">紫色（推荐）</Select.Option>
                    <Select.Option value="gold">金色（热门）</Select.Option>
                    <Select.Option value="red">红色（促销）</Select.Option>
                    <Select.Option value="blue">蓝色</Select.Option>
                    <Select.Option value="green">绿色</Select.Option>
                </Select>
            </Form.Item>

            <Form.Item label="排序" name="sort_order">
                <InputNumber style={{ width: '100%' }} />
            </Form.Item>
        </>
    );
}

// =====================================================
// 利润率计算器组件
// =====================================================
function ProfitCalculator({ form }: { form: any }) {
    const [calculation, setCalculation] = useState<any>(null);

    const uploadPostCost = Form.useWatch('upload_post_cost', form) || 0;
    const aiCost = Form.useWatch('ai_generation_cost', form) || 0;
    const price = Form.useWatch('price_monthly', form) || 0;

    useEffect(() => {
        const totalCost = uploadPostCost + aiCost;
        const profit = price - totalCost;
        const margin = totalCost > 0 ? (profit / totalCost) * 100 : 0;

        setCalculation({
            totalCost: totalCost.toFixed(2),
            profit: profit.toFixed(2),
            margin: margin.toFixed(1),
            color: margin >= 200 ? 'success' : margin >= 150 ? 'warning' : 'error'
        });
    }, [uploadPostCost, aiCost, price]);

    if (!calculation) return null;

    return (
        <Card title="利润率计算器" size="small" type="inner" className="mb-4">
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-gray-600">总成本：</span>
                    <span className="font-bold text-red-600">¥{calculation.totalCost}</span>
                </div>

                <div className="flex justify-between items-center">
                    <span className="text-gray-600">净利润：</span>
                    <span className="font-bold text-green-600">¥{calculation.profit}</span>
                </div>

                <div className="flex justify-between items-center">
                    <span className="text-gray-600">利润率：</span>
                    <Tag color={calculation.color} className="text-base font-bold px-3">
                        {calculation.margin}%
                    </Tag>
                </div>

                <Progress
                    percent={Math.min(parseFloat(calculation.margin), 300)}
                    strokeColor={{
                        '0%': '#108ee9',
                        '100%': '#87d068'
                    }}
                    format={() => `${calculation.margin}%`}
                />

                {parseFloat(calculation.margin) >= 200 && (
                    <Alert message="✅ 已达到200%目标利润率" type="success" showIcon />
                )}

                {parseFloat(calculation.margin) < 150 && (
                    <Alert message="⚠️ 利润率低于150%，建议调整定价" type="warning" showIcon />
                )}
            </div>
        </Card>
    );
}

// =====================================================
// 智能定价建议组件
// =====================================================
function PricingSuggestion({ form }: { form: any }) {
    const uploadPostCost = Form.useWatch('upload_post_cost', form) || 0;
    const aiCost = Form.useWatch('ai_generation_cost', form) || 0;

    const suggestions = [
        { margin: 150, label: '保守定价', color: 'blue' },
        { margin: 200, label: '目标定价 ⭐', color: 'green' },
        { margin: 250, label: '进取定价', color: 'purple' }
    ];

    const totalCost = uploadPostCost + aiCost;

    if (totalCost === 0) return null;

    return (
        <Card title="智能定价建议" size="small" type="inner">
            <div className="space-y-2">
                {suggestions.map((s) => {
                    const suggestedPrice = Math.ceil((totalCost * (1 + s.margin / 100)) / 100) * 100 - 1;
                    const profit = suggestedPrice - totalCost;

                    return (
                        <div
                            key={s.margin}
                            className="flex justify-between items-center p-3 hover:bg-gray-50 rounded cursor-pointer"
                            onClick={() => form.setFieldValue('price_monthly', suggestedPrice)}
                        >
                            <div>
                                <Tag color={s.color}>{s.label}</Tag>
                                <span className="text-gray-600 text-sm ml-2">利润率 {s.margin}%</span>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-lg">¥{suggestedPrice}</div>
                                <div className="text-xs text-gray-500">净利润 ¥{profit.toFixed(0)}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

// =====================================================
// 历史记录时间线组件
// =====================================================
function HistoryTimeline({ data }: { data: any[] }) {
    if (data.length === 0) {
        return <div className="text-center text-gray-500 py-8">暂无历史记录</div>;
    }

    return (
        <div className="space-y-4 max-h-96 overflow-y-auto">
            {data.map((item) => (
                <div key={item.id} className="border-l-2 border-blue-500 pl-4 pb-4">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <span className="font-semibold">{item.field_name}</span>
                            <span className="text-gray-500 text-sm ml-2">by {item.changed_by_username}</span>
                        </div>
                        <span className="text-gray-400 text-xs">
                            {new Date(item.created_at).toLocaleString('zh-CN')}
                        </span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded text-sm">
                        <div className="text-red-600">
                            <span className="font-semibold">旧值: </span>
                            {item.old_value}
                        </div>
                        <div className="text-green-600 mt-1">
                            <span className="font-semibold">新值: </span>
                            {item.new_value}
                        </div>
                        {item.reason && (
                            <div className="text-gray-600 mt-1">
                                <span className="font-semibold">原因: </span>
                                {item.reason}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
