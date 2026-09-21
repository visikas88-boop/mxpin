import { useEffect, useState } from "react";
import { Table, Button, Space, Tag, DatePicker, Select, Input, Tabs, Card, Statistic, Form, InputNumber, message, Modal, Switch, Radio } from "antd";
import { ReloadOutlined, SearchOutlined, DollarOutlined, ShoppingOutlined, RiseOutlined, FallOutlined, SaveOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import type { TabsProps } from "antd";
import dayjs, { Dayjs } from "dayjs";
import PaymentConfigManager from "@/components/PaymentConfigManager";

const { RangePicker } = DatePicker;
const { Search } = Input;
const { TextArea } = Input;

interface PointsTransaction {
    id: number;
    user_id: number;
    username: string;
    email: string;
    display_name: string;
    type: string;
    points: number;
    balance_before: number;
    balance_after: number;
    remark: string;
    created_at: string;
}

interface RechargeOrder {
    id: number;
    user_id: number;
    username: string;
    email: string;
    display_name: string;
    order_no: string;
    amount: number;
    receive_points: number;
    payment_method: string;
    status: string;
    created_at: string;
    paid_at?: string;
}

interface PointsStats {
    overall: {
        total_balance: number;
        total_recharged: number;
        total_consumed: number;
        total_users: number;
    };
    today: {
        recharge_count: number;
        recharge_amount: number;
        consume_count: number;
        consume_amount: number;
    };
    trend: Array<{
        date: string;
        recharge_count: number;
        recharge_amount: number;
        consume_count: number;
        consume_amount: number;
    }>;
}

interface RechargePackage {
    id: number;
    group_id: number;
    package_name: string;
    package_name_en?: string;
    package_desc?: string;
    package_desc_en?: string;
    price: number;
    original_price?: number;
    points_calc_mode: 'auto' | 'manual';
    gift_percent: number;
    manual_base_points?: number;
    manual_gift_points?: number;
    base_points: number;
    gift_points: number;
    total_points: number;
    valid_type: 'permanent' | 'timeLimit';
    valid_days?: number;
    valid_end_date?: string;
    is_hot: boolean;
    sort_order: number;
    is_active: boolean;
    created_at?: string;
}

interface PackageGroup {
    group_id: number;
    group_type: string;
    group_name: string;
    group_name_en?: string;
}

export default function PointsManagementPage() {
    const [activeTab, setActiveTab] = useState("system");
    const [stats, setStats] = useState<PointsStats | null>(null);
    const [exchangeRateForm] = Form.useForm();
    const [packageForm] = Form.useForm();
    const [groupForm] = Form.useForm();

    // 积分设置相关
    const [exchangeRate, setExchangeRate] = useState(10);
    const [saveRateLoading, setSaveRateLoading] = useState(false);
    const [packages, setPackages] = useState<RechargePackage[]>([]);
    const [packageGroups, setPackageGroups] = useState<PackageGroup[]>([]);
    const [packagesLoading, setPackagesLoading] = useState(false);
    const [packageModalVisible, setPackageModalVisible] = useState(false);
    const [groupModalVisible, setGroupModalVisible] = useState(false);
    const [editingPackage, setEditingPackage] = useState<RechargePackage | null>(null);
    const [editingGroup, setEditingGroup] = useState<PackageGroup | null>(null);

    // 积分流水
    const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
    const [transactionsLoading, setTransactionsLoading] = useState(false);
    const [transactionsTotal, setTransactionsTotal] = useState(0);
    const [transactionsPagination, setTransactionsPagination] = useState({ current: 1, pageSize: 50 });
    const [transactionsFilter, setTransactionsFilter] = useState({
        type: "all",
        userId: "",
        dateRange: null as [Dayjs, Dayjs] | null,
    });

    // 充值订单
    const [orders, setOrders] = useState<RechargeOrder[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [ordersTotal, setOrdersTotal] = useState(0);
    const [ordersPagination, setOrdersPagination] = useState({ current: 1, pageSize: 50 });
    const [ordersFilter, setOrdersFilter] = useState({
        status: "all",
        paymentMethod: "all",
        userId: "",
        dateRange: null as [Dayjs, Dayjs] | null,
    });

    useEffect(() => {
        fetchStats();
        fetchExchangeRate();
        fetchPackages();
        fetchPackageGroups();
    }, []);

    useEffect(() => {
        if (activeTab === "transactions") {
            fetchTransactions();
        } else if (activeTab === "orders") {
            fetchOrders();
        }
    }, [activeTab, transactionsPagination, transactionsFilter, ordersPagination, ordersFilter]);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem("admin_token");
            const response = await fetch("http://localhost:3001/api/admin/points/stats", {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();
            if (response.ok) {
                setStats(data.data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchExchangeRate = async () => {
        try {
            const token = localStorage.getItem("admin_token");
            const response = await fetch("http://localhost:3001/api/recharge/settings", {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();
            if (response.ok) {
                const rate = data.data.points_exchange_rate.value;
                setExchangeRate(rate);
                exchangeRateForm.setFieldsValue({ exchangeRate: rate });
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchPackages = async () => {
        setPackagesLoading(true);
        try {
            const token = localStorage.getItem("admin_token");
            const response = await fetch("http://localhost:3001/api/admin/recharge/packages", {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();
            if (response.ok) {
                setPackages(data.data);
            } else {
                console.error("获取套餐失败:", data.message);
                message.error(data.message || "获取套餐列表失败");
            }
        } catch (error) {
            console.error("获取套餐异常:", error);
            message.error("网络错误，请检查后端服务是否启动");
        } finally {
            setPackagesLoading(false);
        }
    };

    const fetchPackageGroups = async () => {
        try {
            const token = localStorage.getItem("admin_token");
            const response = await fetch("http://localhost:3001/api/admin/recharge/package-groups", {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();
            if (response.ok) {
                setPackageGroups(data.data);
            } else {
                console.error("获取分组失败:", data.message);
            }
        } catch (error) {
            console.error("获取分组异常:", error);
        }
    };

    const handleSaveExchangeRate = async (values: any) => {
        setSaveRateLoading(true);
        try {
            const token = localStorage.getItem("admin_token");
            const response = await fetch("http://localhost:3001/api/recharge/settings/exchange-rate", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ rate: values.exchangeRate }),
            });

            const data = await response.json();
            if (response.ok) {
                message.success("积分比例更新成功");
                setExchangeRate(values.exchangeRate);
                fetchPackages(); // 刷新套餐列表以显示新积分
            } else {
                message.error(data.message || "更新失败");
            }
        } catch (error) {
            message.error("网络错误");
            console.error(error);
        } finally {
            setSaveRateLoading(false);
        }
    };

    const handleAddPackage = () => {
        setEditingPackage(null);
        packageForm.resetFields();
        packageForm.setFieldsValue({
            points_calc_mode: 'auto',
            gift_percent: 0,
            valid_type: 'permanent',
            is_hot: false,
            is_active: true,
            sort_order: 0,
        });
        setPackageModalVisible(true);
    };

    const handleEditPackage = (record: RechargePackage) => {
        setEditingPackage(record);
        packageForm.setFieldsValue({
            ...record,
            valid_end_date: record.valid_end_date ? dayjs(record.valid_end_date) : undefined,
        });
        setPackageModalVisible(true);
    };

    const handleDeletePackage = (record: RechargePackage) => {
        Modal.confirm({
            title: "确认删除",
            icon: <ExclamationCircleOutlined />,
            content: `确定要删除套餐"${record.package_name}"吗？`,
            okText: "删除",
            okType: "danger",
            cancelText: "取消",
            async onOk() {
                try {
                    const token = localStorage.getItem("admin_token");
                    const response = await fetch(`http://localhost:3001/api/admin/recharge/packages/${record.id}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${token}` },
                    });

                    const data = await response.json();
                    if (response.ok) {
                        message.success("删除成功");
                        fetchPackages();
                    } else {
                        message.error(data.message || "删除失败");
                    }
                } catch (error) {
                    message.error("网络错误");
                    console.error(error);
                }
            },
        });
    };

    const handlePackageSubmit = async (values: any) => {
        try {
            const token = localStorage.getItem("admin_token");
            const payload = {
                ...values,
                valid_end_date: values.valid_end_date ? values.valid_end_date.format("YYYY-MM-DD") : null,
            };

            const url = editingPackage
                ? `http://localhost:3001/api/admin/recharge/packages/${editingPackage.id}`
                : "http://localhost:3001/api/admin/recharge/packages";

            const response = await fetch(url, {
                method: editingPackage ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (response.ok) {
                message.success(editingPackage ? "更新成功" : "添加成功");
                setPackageModalVisible(false);
                fetchPackages();
            } else {
                message.error(data.message || "操作失败");
            }
        } catch (error) {
            message.error("网络错误");
            console.error(error);
        }
    };

    // 分组管理函数
    const handleAddGroup = () => {
        setEditingGroup(null);
        groupForm.resetFields();
        setGroupModalVisible(true);
    };

    const handleEditGroup = (record: PackageGroup) => {
        setEditingGroup(record);
        groupForm.setFieldsValue(record);
        setGroupModalVisible(true);
    };

    const handleDeleteGroup = (record: PackageGroup) => {
        Modal.confirm({
            title: "确认删除",
            icon: <ExclamationCircleOutlined />,
            content: `确定要删除分组"${record.group_name}"吗？如果有套餐使用该分组，将无法删除。`,
            okText: "删除",
            okType: "danger",
            cancelText: "取消",
            async onOk() {
                try {
                    const token = localStorage.getItem("admin_token");
                    const response = await fetch(`http://localhost:3001/api/admin/recharge/package-groups/${record.group_id}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${token}` },
                    });

                    const data = await response.json();
                    if (response.ok) {
                        message.success("删除成功");
                        fetchPackageGroups();
                    } else {
                        message.error(data.message || "删除失败");
                    }
                } catch (error) {
                    message.error("网络错误");
                    console.error(error);
                }
            },
        });
    };

    const handleGroupSubmit = async (values: any) => {
        try {
            const token = localStorage.getItem("admin_token");
            const url = editingGroup
                ? `http://localhost:3001/api/admin/recharge/package-groups/${editingGroup.group_id}`
                : "http://localhost:3001/api/admin/recharge/package-groups";

            const response = await fetch(url, {
                method: editingGroup ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(values),
            });

            const data = await response.json();
            if (response.ok) {
                message.success(editingGroup ? "更新成功" : "添加成功");
                setGroupModalVisible(false);
                fetchPackageGroups();
            } else {
                message.error(data.message || "操作失败");
            }
        } catch (error) {
            message.error("网络错误");
            console.error(error);
        }
    };

    const fetchTransactions = async () => {
        setTransactionsLoading(true);
        try {
            const token = localStorage.getItem("admin_token");
            const params = new URLSearchParams();

            if (transactionsFilter.type !== "all") params.append("type", transactionsFilter.type);
            if (transactionsFilter.userId) params.append("userId", transactionsFilter.userId);
            if (transactionsFilter.dateRange) {
                params.append("startDate", transactionsFilter.dateRange[0].format("YYYY-MM-DD"));
                params.append("endDate", transactionsFilter.dateRange[1].format("YYYY-MM-DD"));
            }
            params.append("limit", transactionsPagination.pageSize.toString());
            params.append(
                "offset",
                ((transactionsPagination.current - 1) * transactionsPagination.pageSize).toString()
            );

            const response = await fetch(`http://localhost:3001/api/admin/points/transactions?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();
            if (response.ok) {
                setTransactions(data.data.transactions);
                setTransactionsTotal(data.data.total);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setTransactionsLoading(false);
        }
    };

    const fetchOrders = async () => {
        setOrdersLoading(true);
        try {
            const token = localStorage.getItem("admin_token");
            const params = new URLSearchParams();

            if (ordersFilter.status !== "all") params.append("status", ordersFilter.status);
            if (ordersFilter.paymentMethod !== "all") params.append("paymentMethod", ordersFilter.paymentMethod);
            if (ordersFilter.userId) params.append("userId", ordersFilter.userId);
            if (ordersFilter.dateRange) {
                params.append("startDate", ordersFilter.dateRange[0].format("YYYY-MM-DD"));
                params.append("endDate", ordersFilter.dateRange[1].format("YYYY-MM-DD"));
            }
            params.append("limit", ordersPagination.pageSize.toString());
            params.append("offset", ((ordersPagination.current - 1) * ordersPagination.pageSize).toString());

            const response = await fetch(`http://localhost:3001/api/admin/points/recharge-orders?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();
            if (response.ok) {
                setOrders(data.data.orders);
                setOrdersTotal(data.data.total);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setOrdersLoading(false);
        }
    };

    const packageColumns = [
        {
            title: "套餐名称",
            dataIndex: "package_name",
            key: "package_name",
            width: 150,
        },
        {
            title: "分组",
            dataIndex: "group_id",
            key: "group_id",
            width: 120,
            render: (groupId: number) => {
                const group = packageGroups.find(g => g.group_id === groupId);
                return group ? group.group_name : groupId;
            },
        },
        {
            title: "价格",
            key: "price",
            width: 120,
            render: (_: any, record: RechargePackage) => (
                <div>
                    <div className="font-semibold">¥{Number(record.price).toFixed(2)}</div>
                    {record.original_price && Number(record.original_price) > Number(record.price) && (
                        <div className="text-xs text-slate-400 line-through">¥{Number(record.original_price).toFixed(2)}</div>
                    )}
                </div>
            ),
        },
        {
            title: "计算模式",
            dataIndex: "points_calc_mode",
            key: "points_calc_mode",
            width: 100,
            render: (mode: string) => (
                <Tag color={mode === 'auto' ? 'blue' : 'purple'}>
                    {mode === 'auto' ? '自动' : '手动'}
                </Tag>
            ),
        },
        {
            title: "基础积分",
            dataIndex: "base_points",
            key: "base_points",
            width: 100,
            align: "right" as const,
            render: (points: number) => points.toLocaleString(),
        },
        {
            title: "赠送积分",
            dataIndex: "gift_points",
            key: "gift_points",
            width: 100,
            align: "right" as const,
            render: (points: number) => (
                <span className="text-orange-600">+{points.toLocaleString()}</span>
            ),
        },
        {
            title: "总积分",
            dataIndex: "total_points",
            key: "total_points",
            width: 100,
            align: "right" as const,
            render: (points: number) => (
                <span className="font-semibold text-purple-600">{points.toLocaleString()}</span>
            ),
        },
        {
            title: "有效期",
            key: "validity",
            width: 100,
            render: (_: any, record: RechargePackage) => {
                if (record.valid_type === 'permanent') return <Tag color="green">永久</Tag>;
                if (record.valid_days) return <span>{record.valid_days}天</span>;
                if (record.valid_end_date) return <span>{record.valid_end_date}</span>;
                return '-';
            },
        },
        {
            title: "状态",
            key: "status",
            width: 100,
            render: (_: any, record: RechargePackage) => (
                <Space>
                    {record.is_hot && <Tag color="red">HOT</Tag>}
                    <Tag color={record.is_active ? "success" : "default"}>
                        {record.is_active ? "启用" : "禁用"}
                    </Tag>
                </Space>
            ),
        },
        {
            title: "排序",
            dataIndex: "sort_order",
            key: "sort_order",
            width: 80,
            align: "center" as const,
        },
        {
            title: "操作",
            key: "action",
            width: 150,
            fixed: "right" as const,
            render: (_: any, record: RechargePackage) => (
                <Space>
                    <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditPackage(record)}>
                        编辑
                    </Button>
                    <Button
                        type="link"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeletePackage(record)}
                    >
                        删除
                    </Button>
                </Space>
            ),
        },
    ];

    const transactionsColumns = [
        {
            title: "用户",
            key: "user",
            width: 180,
            render: (_: any, record: PointsTransaction) => (
                <div>
                    <div className="font-medium">{record.username}</div>
                    <div className="text-xs text-gray-500">{record.email}</div>
                </div>
            ),
        },
        {
            title: "类型",
            dataIndex: "type",
            key: "type",
            width: 80,
            render: (type: string) => (
                <Tag color={type === "recharge" ? "green" : "orange"} icon={type === "recharge" ? <RiseOutlined /> : <FallOutlined />}>
                    {type === "recharge" ? "充值" : "消费"}
                </Tag>
            ),
        },
        {
            title: "积分变动",
            dataIndex: "points",
            key: "points",
            width: 120,
            align: "right" as const,
            render: (points: number, record: PointsTransaction) => (
                <span className={`font-semibold ${record.type === "recharge" ? "text-green-600" : "text-orange-600"}`}>
                    {record.type === "recharge" ? "+" : "-"}
                    {Math.abs(points).toLocaleString()}
                </span>
            ),
        },
        {
            title: "变动前",
            dataIndex: "balance_before",
            key: "balance_before",
            width: 100,
            align: "right" as const,
            render: (val: number) => val.toLocaleString(),
        },
        {
            title: "变动后",
            dataIndex: "balance_after",
            key: "balance_after",
            width: 100,
            align: "right" as const,
            render: (val: number) => val.toLocaleString(),
        },
        {
            title: "备注",
            dataIndex: "remark",
            key: "remark",
            ellipsis: true,
            render: (text: string) => <span className="text-sm text-gray-600">{text}</span>,
        },
        {
            title: "时间",
            dataIndex: "created_at",
            key: "created_at",
            width: 160,
            render: (date: string) => new Date(date).toLocaleString("zh-CN"),
        },
    ];

    const ordersColumns = [
        {
            title: "订单号",
            dataIndex: "order_no",
            key: "order_no",
            width: 180,
            render: (text: string) => <span className="font-mono text-xs">{text}</span>,
        },
        {
            title: "用户",
            key: "user",
            width: 180,
            render: (_: any, record: RechargeOrder) => (
                <div>
                    <div className="font-medium">{record.username}</div>
                    <div className="text-xs text-gray-500">{record.email}</div>
                </div>
            ),
        },
        {
            title: "充值金额",
            dataIndex: "amount",
            key: "amount",
            width: 100,
            align: "right" as const,
            render: (amount: number) => <span className="font-semibold">¥{Number(amount).toFixed(2)}</span>,
        },
        {
            title: "获得积分",
            dataIndex: "receive_points",
            key: "receive_points",
            width: 100,
            align: "right" as const,
            render: (points: number) => <span className="font-semibold text-orange-600">{points.toLocaleString()}</span>,
        },
        {
            title: "支付方式",
            dataIndex: "payment_method",
            key: "payment_method",
            width: 100,
            render: (method: string) => {
                const methodMap: Record<string, string> = {
                    manual: "手动充值",
                    alipay: "支付宝",
                    wechat: "微信支付",
                };
                return methodMap[method] || method;
            },
        },
        {
            title: "状态",
            dataIndex: "status",
            key: "status",
            width: 80,
            render: (status: string) => {
                const statusMap: Record<string, { color: string; text: string }> = {
                    completed: { color: "success", text: "已完成" },
                    pending: { color: "processing", text: "待支付" },
                    failed: { color: "error", text: "失败" },
                    cancelled: { color: "default", text: "已取消" },
                };
                const config = statusMap[status] || { color: "default", text: status };
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: "创建时间",
            dataIndex: "created_at",
            key: "created_at",
            width: 160,
            render: (date: string) => new Date(date).toLocaleString("zh-CN"),
        },
    ];

    const tabItems: TabsProps["items"] = [
        {
            key: "system",
            label: "⚙️ 分组设置",
            children: (
                <div className="space-y-4 p-6">
                    {/* 积分兑换比例 */}
                    <Card title="积分兑换比例" className="shadow-sm">
                        <Form
                            form={exchangeRateForm}
                            layout="inline"
                            onFinish={handleSaveExchangeRate}
                            initialValues={{ exchangeRate: 10 }}
                        >
                            <Form.Item
                                label="1元人民币兑换"
                                name="exchangeRate"
                                rules={[
                                    { required: true, message: "请输入比例" },
                                    { type: "number", min: 1, max: 1000, message: "比例必须在1-1000之间" },
                                ]}
                            >
                                <InputNumber
                                    min={1}
                                    max={1000}
                                    precision={0}
                                    style={{ width: 120 }}
                                    addonAfter="积分"
                                />
                            </Form.Item>
                            <Form.Item>
                                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saveRateLoading}>
                                    保存
                                </Button>
                            </Form.Item>
                        </Form>
                        <div className="mt-2 text-xs text-blue-600">
                            💡 调整比例后，所有使用"自动计算"模式的套餐积分会实时更新
                        </div>
                    </Card>

                    {/* 套餐分组管理 */}
                    <Card
                        title="套餐分组管理"
                        extra={
                            <Button icon={<PlusOutlined />} onClick={handleAddGroup}>
                                新增分组
                            </Button>
                        }
                        className="shadow-sm"
                    >
                        <Table
                            dataSource={packageGroups}
                            rowKey="group_id"
                            pagination={false}
                            size="small"
                            columns={[
                                {
                                    title: "分组ID",
                                    dataIndex: "group_id",
                                    key: "group_id",
                                    width: 100,
                                },
                                {
                                    title: "分组名称",
                                    dataIndex: "group_name",
                                    key: "group_name",
                                    width: 150,
                                },
                                {
                                    title: "英文名称",
                                    dataIndex: "group_name_en",
                                    key: "group_name_en",
                                    width: 150,
                                },
                                {
                                    title: "分组类型",
                                    dataIndex: "group_type",
                                    key: "group_type",
                                    width: 120,
                                    render: (type: string) => (
                                        <Tag color={type === 'limited' ? 'red' : 'blue'}>
                                            {type === 'limited' ? '限时特惠' : '日常充值'}
                                        </Tag>
                                    ),
                                },
                                {
                                    title: "描述",
                                    dataIndex: "group_desc",
                                    key: "group_desc",
                                    ellipsis: true,
                                },
                                {
                                    title: "操作",
                                    key: "action",
                                    width: 150,
                                    fixed: "right" as const,
                                    render: (_: any, record: PackageGroup) => (
                                        <Space>
                                            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditGroup(record)}>
                                                编辑
                                            </Button>
                                            <Button
                                                type="link"
                                                size="small"
                                                danger
                                                icon={<DeleteOutlined />}
                                                onClick={() => handleDeleteGroup(record)}
                                            >
                                                删除
                                            </Button>
                                        </Space>
                                    ),
                                },
                            ]}
                            className="[&_.ant-table-thead>tr>th]:!bg-gray-50 [&_.ant-table-thead>tr>th]:!text-gray-700"
                        />
                    </Card>
                </div>
            ),
        },
        {
            key: "packages",
            label: "📦 积分包管理",
            children: (
                <div className="p-6">
                    <div className="flex justify-end mb-4">
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPackage}>
                            新增套餐
                        </Button>
                    </div>
                    <Table
                        dataSource={packages}
                        columns={packageColumns}
                        rowKey="id"
                        loading={packagesLoading}
                        scroll={{ x: 1400, y: 500 }}
                        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
                        size="small"
                        className="[&_.ant-table-thead>tr>th]:!bg-gray-50 [&_.ant-table-thead>tr>th]:!text-gray-700"
                    />
                </div>
            ),
        },
        {
            key: "transactions",
            label: "📊 积分流水",
            children: (
                <div className="space-y-4">
                    {/* 筛选栏 */}
                    <div className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm border border-gray-200">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600">类型:</span>
                            <Select
                                value={transactionsFilter.type}
                                onChange={(val) => setTransactionsFilter({ ...transactionsFilter, type: val })}
                                style={{ width: 120 }}
                            >
                                <Select.Option value="all">全部</Select.Option>
                                <Select.Option value="recharge">充值</Select.Option>
                                <Select.Option value="consume">消费</Select.Option>
                            </Select>
                        </div>
                        <Search
                            placeholder="用户ID"
                            allowClear
                            style={{ width: 150 }}
                            value={transactionsFilter.userId}
                            onChange={(e) => setTransactionsFilter({ ...transactionsFilter, userId: e.target.value })}
                        />
                        <RangePicker
                            value={transactionsFilter.dateRange}
                            onChange={(dates) =>
                                setTransactionsFilter({ ...transactionsFilter, dateRange: dates as [Dayjs, Dayjs] | null })
                            }
                            placeholder={["开始日期", "结束日期"]}
                        />
                        <div className="flex-1" />
                        <Button icon={<ReloadOutlined />} onClick={fetchTransactions}>
                            刷新
                        </Button>
                        <div className="text-sm text-gray-500">共 {transactionsTotal} 条</div>
                    </div>

                    {/* 表格 */}
                    <div className="rounded-lg bg-white shadow-sm border border-gray-200 overflow-hidden">
                        <Table
                            dataSource={transactions}
                            columns={transactionsColumns}
                            rowKey="id"
                            loading={transactionsLoading}
                            scroll={{ x: 1200 }}
                            pagination={{
                                current: transactionsPagination.current,
                                pageSize: transactionsPagination.pageSize,
                                total: transactionsTotal,
                                showSizeChanger: true,
                                showTotal: (total) => `共 ${total} 条`,
                                onChange: (page, pageSize) => setTransactionsPagination({ current: page, pageSize }),
                            }}
                            className="[&_.ant-table-thead>tr>th]:!bg-gray-50 [&_.ant-table-thead>tr>th]:!text-gray-700"
                        />
                    </div>
                </div>
            ),
        },
        {
            key: "orders",
            label: "🛒 充值订单",
            children: (
                <div className="space-y-4">
                    {/* 筛选栏 */}
                    <div className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm border border-gray-200">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600">状态:</span>
                            <Select
                                value={ordersFilter.status}
                                onChange={(val) => setOrdersFilter({ ...ordersFilter, status: val })}
                                style={{ width: 120 }}
                            >
                                <Select.Option value="all">全部</Select.Option>
                                <Select.Option value="completed">已完成</Select.Option>
                                <Select.Option value="pending">待支付</Select.Option>
                                <Select.Option value="failed">失败</Select.Option>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600">支付方式:</span>
                            <Select
                                value={ordersFilter.paymentMethod}
                                onChange={(val) => setOrdersFilter({ ...ordersFilter, paymentMethod: val })}
                                style={{ width: 120 }}
                            >
                                <Select.Option value="all">全部</Select.Option>
                                <Select.Option value="manual">手动充值</Select.Option>
                                <Select.Option value="alipay">支付宝</Select.Option>
                                <Select.Option value="wechat">微信支付</Select.Option>
                            </Select>
                        </div>
                        <Search
                            placeholder="用户ID"
                            allowClear
                            style={{ width: 150 }}
                            value={ordersFilter.userId}
                            onChange={(e) => setOrdersFilter({ ...ordersFilter, userId: e.target.value })}
                        />
                        <RangePicker
                            value={ordersFilter.dateRange}
                            onChange={(dates) => setOrdersFilter({ ...ordersFilter, dateRange: dates as [Dayjs, Dayjs] | null })}
                            placeholder={["开始日期", "结束日期"]}
                        />
                        <div className="flex-1" />
                        <Button icon={<ReloadOutlined />} onClick={fetchOrders}>
                            刷新
                        </Button>
                        <div className="text-sm text-gray-500">共 {ordersTotal} 条</div>
                    </div>

                    {/* 表格 */}
                    <div className="rounded-lg bg-white shadow-sm border border-gray-200 overflow-hidden">
                        <Table
                            dataSource={orders}
                            columns={ordersColumns}
                            rowKey="id"
                            loading={ordersLoading}
                            scroll={{ x: 1200 }}
                            pagination={{
                                current: ordersPagination.current,
                                pageSize: ordersPagination.pageSize,
                                total: ordersTotal,
                                showSizeChanger: true,
                                showTotal: (total) => `共 ${total} 条`,
                                onChange: (page, pageSize) => setOrdersPagination({ current: page, pageSize }),
                            }}
                            className="[&_.ant-table-thead>tr>th]:!bg-gray-50 [&_.ant-table-thead>tr>th]:!text-gray-700"
                        />
                    </div>
                </div>
            ),
        },
        {
            key: "payment",
            label: "💳 支付管理",
            children: <PaymentConfigManager />,
        },
    ];

    return (
        <div className="h-full overflow-auto">
            <div className="min-h-full bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50 space-y-6 p-6">
            {/* 统计卡片 */}
            {stats && (
                <div className="grid gap-4 md:grid-cols-4">
                    <Card className="border-gray-200 shadow-sm">
                        <Statistic
                            title="系统积分总余额"
                            value={stats.overall.total_balance}
                            precision={0}
                            valueStyle={{ color: "#f97316" }}
                            prefix={<DollarOutlined />}
                        />
                    </Card>
                    <Card className="border-gray-200 shadow-sm">
                        <Statistic
                            title="累计充值"
                            value={stats.overall.total_recharged}
                            precision={0}
                            valueStyle={{ color: "#22c55e" }}
                            prefix={<RiseOutlined />}
                        />
                        <div className="mt-2 text-xs text-gray-500">今日充值: {stats.today.recharge_amount}</div>
                    </Card>
                    <Card className="border-gray-200 shadow-sm">
                        <Statistic
                            title="累计消费"
                            value={stats.overall.total_consumed}
                            precision={0}
                            valueStyle={{ color: "#ef4444" }}
                            prefix={<FallOutlined />}
                        />
                        <div className="mt-2 text-xs text-gray-500">今日消费: {stats.today.consume_amount}</div>
                    </Card>
                    <Card className="border-gray-200 shadow-sm">
                        <Statistic
                            title="总用户数"
                            value={stats.overall.total_users}
                            precision={0}
                            valueStyle={{ color: "#3b82f6" }}
                            prefix={<ShoppingOutlined />}
                        />
                        <div className="mt-2 text-xs text-gray-500">
                            今日交易: {stats.today.recharge_count + stats.today.consume_count} 笔
                        </div>
                    </Card>
                </div>
            )}

            {/* Tabs */}
            <div className="rounded-lg bg-white shadow-sm border border-gray-200">
                <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} className="px-4" />
            </div>

            {/* 套餐编辑模态框 */}
            <Modal
                title={editingPackage ? "编辑套餐" : "新增套餐"}
                open={packageModalVisible}
                onCancel={() => setPackageModalVisible(false)}
                footer={null}
                width={700}
            >
                <Form
                    form={packageForm}
                    layout="vertical"
                    onFinish={handlePackageSubmit}
                    initialValues={{
                        points_calc_mode: 'auto',
                        gift_percent: 0,
                        valid_type: 'permanent',
                        is_hot: false,
                        is_active: true,
                        sort_order: 0,
                    }}
                >
                    <Form.Item label="套餐名称" name="package_name" rules={[{ required: true, message: "请输入套餐名称" }]}>
                        <Input placeholder="例如：限时特惠包" />
                    </Form.Item>

                    <Form.Item label="套餐名称（英文）" name="package_name_en">
                        <Input placeholder="例如：Limited Time Offer" />
                    </Form.Item>

                    <Form.Item label="套餐分组" name="group_id" rules={[{ required: true, message: "请选择分组" }]}>
                        <Select placeholder="选择分组">
                            {packageGroups.map(group => (
                                <Select.Option key={group.group_id} value={group.group_id}>
                                    {group.group_name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item label="价格（元）" name="price" rules={[{ required: true, message: "请输入价格" }]}>
                            <InputNumber min={0.01} precision={2} style={{ width: "100%" }} placeholder="现价" />
                        </Form.Item>

                        <Form.Item label="原价（元）" name="original_price">
                            <InputNumber min={0} precision={2} style={{ width: "100%" }} placeholder="划线价格（可选）" />
                        </Form.Item>
                    </div>

                    <Form.Item label="积分计算模式" name="points_calc_mode" rules={[{ required: true }]}>
                        <Radio.Group>
                            <Radio value="auto">自动计算（基于兑换比例）</Radio>
                            <Radio value="manual">手动设置</Radio>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) =>
                            prevValues.points_calc_mode !== currentValues.points_calc_mode
                        }
                    >
                        {({ getFieldValue }) =>
                            getFieldValue("points_calc_mode") === "auto" ? (
                                <Form.Item label="赠送比例（%）" name="gift_percent">
                                    <InputNumber min={0} max={100} precision={0} style={{ width: "100%" }} placeholder="例如：20 表示赠送20%" />
                                </Form.Item>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <Form.Item label="基础积分" name="manual_base_points">
                                        <InputNumber min={0} precision={0} style={{ width: "100%" }} />
                                    </Form.Item>
                                    <Form.Item label="赠送积分" name="manual_gift_points">
                                        <InputNumber min={0} precision={0} style={{ width: "100%" }} />
                                    </Form.Item>
                                </div>
                            )
                        }
                    </Form.Item>

                    <Form.Item label="有效期类型" name="valid_type" rules={[{ required: true }]}>
                        <Radio.Group>
                            <Radio value="permanent">永久有效</Radio>
                            <Radio value="timeLimit">时间限制</Radio>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) => prevValues.valid_type !== currentValues.valid_type}
                    >
                        {({ getFieldValue }) =>
                            getFieldValue("valid_type") === "timeLimit" && (
                                <div className="grid grid-cols-2 gap-4">
                                    <Form.Item label="有效天数" name="valid_days">
                                        <InputNumber min={1} precision={0} style={{ width: "100%" }} placeholder="例如：30" />
                                    </Form.Item>
                                    <Form.Item label="截止日期" name="valid_end_date">
                                        <DatePicker style={{ width: "100%" }} placeholder="或选择截止日期" />
                                    </Form.Item>
                                </div>
                            )
                        }
                    </Form.Item>

                    <div className="grid grid-cols-3 gap-4">
                        <Form.Item label="HOT标签" name="is_hot" valuePropName="checked">
                            <Switch />
                        </Form.Item>

                        <Form.Item label="启用状态" name="is_active" valuePropName="checked">
                            <Switch />
                        </Form.Item>

                        <Form.Item label="排序序号" name="sort_order">
                            <InputNumber min={0} precision={0} style={{ width: "100%" }} placeholder="数字越小越靠前" />
                        </Form.Item>
                    </div>

                    <Form.Item label="套餐描述" name="package_desc">
                        <TextArea rows={2} placeholder="套餐说明（可选）" />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                {editingPackage ? "更新" : "创建"}
                            </Button>
                            <Button onClick={() => setPackageModalVisible(false)}>取消</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* 分组编辑模态框 */}
            <Modal
                title={editingGroup ? "编辑分组" : "新增分组"}
                open={groupModalVisible}
                onCancel={() => setGroupModalVisible(false)}
                footer={null}
                width={600}
            >
                <Form
                    form={groupForm}
                    layout="vertical"
                    onFinish={handleGroupSubmit}
                >
                    <Form.Item label="分组类型" name="group_type" rules={[{ required: true, message: "请选择分组类型" }]}>
                        <Select placeholder="选择分组类型">
                            <Select.Option value="limited">限时特惠</Select.Option>
                            <Select.Option value="daily">日常充值</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item label="分组名称" name="group_name" rules={[{ required: true, message: "请输入分组名称" }]}>
                        <Input placeholder="例如：限时加油包" />
                    </Form.Item>

                    <Form.Item label="英文名称" name="group_name_en">
                        <Input placeholder="例如：Limited Time Pack" />
                    </Form.Item>

                    <Form.Item label="分组描述" name="group_desc">
                        <TextArea rows={2} placeholder="分组说明（可选）" />
                    </Form.Item>

                    <Form.Item label="英文描述" name="group_desc_en">
                        <TextArea rows={2} placeholder="English description (optional)" />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                {editingGroup ? "更新" : "创建"}
                            </Button>
                            <Button onClick={() => setGroupModalVisible(false)}>取消</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
            </div>
        </div>
    );
}
