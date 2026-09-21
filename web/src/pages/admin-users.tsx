import { useEffect, useState } from "react";
import { apiFetch } from "@/utils/api-config";
import { Table, Button, Space, Tag, Modal, Input, Select, message, Popconfirm, Descriptions, Tabs } from "antd";
import { PlusOutlined, ReloadOutlined, SearchOutlined, EyeOutlined, DollarOutlined, StopOutlined, CheckCircleOutlined } from "@ant-design/icons";
import type { TabsProps } from "antd";

const { Search } = Input;

interface User {
    id: string;
    email: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    role: string;
    status: string;
    balance_points: number;
    total_recharged: number;
    total_consumed: number;
    created_at: string;
    last_login_at?: string;
}

interface UserDetail extends User {
    stats: {
        tasks: {
            total: number;
            completed: number;
            failed: number;
            active: number;
        };
    };
    recentRecharges: any[];
    recentTransactions: any[];
}

export default function UserManagementPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterRole, setFilterRole] = useState<string>("all");
    const [searchText, setSearchText] = useState<string>("");
    const [total, setTotal] = useState(0);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

    // 用户详情模态框
    const [detailVisible, setDetailVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // 充值模态框
    const [rechargeVisible, setRechargeVisible] = useState(false);
    const [rechargeAmount, setRechargeAmount] = useState<number>(100);
    const [rechargeNote, setRechargeNote] = useState<string>("");
    const [rechargeUserId, setRechargeUserId] = useState<number | null>(null);

    useEffect(() => {
        fetchUsers();
    }, [filterStatus, filterRole, searchText, pagination.current, pagination.pageSize]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("admin_token");
            const params = new URLSearchParams();

            if (filterStatus !== "all") params.append("status", filterStatus);
            if (filterRole !== "all") params.append("role", filterRole);
            if (searchText) params.append("keyword", searchText);
            params.append("limit", pagination.pageSize.toString());
            params.append("offset", ((pagination.current - 1) * pagination.pageSize).toString());

            const response = await fetch(`/api/admin/users?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();
            if (response.ok) {
                setUsers(data.data.users);
                setTotal(data.data.total);
            } else {
                message.error(data.message || "获取用户列表失败");
            }
        } catch (error) {
            message.error("网络错误");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserDetail = async (userId: number) => {
        setDetailLoading(true);
        try {
            const token = localStorage.getItem("admin_token");
            const response = await fetch(`/api/admin/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();
            if (response.ok) {
                // 合并user对象和其他数据
                setSelectedUser({
                    ...data.data.user,
                    stats: data.data.stats,
                    recentRecharges: data.data.recentRecharges,
                    recentTransactions: data.data.recentTransactions
                });
            } else {
                message.error(data.message || "获取用户详情失败");
            }
        } catch (error) {
            message.error("网络错误");
            console.error(error);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleViewDetail = async (user: User) => {
        setDetailVisible(true);
        await fetchUserDetail(user.id);
    };

    const handleRecharge = (userId: string) => {
        setRechargeUserId(userId);
        setRechargeAmount(100);
        setRechargeNote("");
        setRechargeVisible(true);
    };

    const handleRechargeSubmit = async () => {
        if (!rechargeUserId || !rechargeAmount || rechargeAmount <= 0) {
            message.error("请输入有效的充值金额");
            return;
        }

        try {
            const token = localStorage.getItem("admin_token");
            const response = await fetch("/api/points/recharge", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    userId: rechargeUserId,
                    amount: rechargeAmount,
                    note: rechargeNote,
                }),
            });

            const data = await response.json();
            if (response.ok) {
                message.success("充值成功");
                setRechargeVisible(false);
                fetchUsers();
            } else {
                message.error(data.message || "充值失败");
            }
        } catch (error) {
            message.error("网络错误");
            console.error(error);
        }
    };

    const handleUpdateStatus = async (userId: string, status: string, reason?: string) => {
        try {
            const token = localStorage.getItem("admin_token");
            const response = await fetch(`/api/admin/users/${userId}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status, reason }),
            });

            const data = await response.json();
            if (response.ok) {
                message.success("状态更新成功");
                fetchUsers();
            } else {
                message.error(data.message || "操作失败");
            }
        } catch (error) {
            message.error("网络错误");
            console.error(error);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        try {
            const token = localStorage.getItem("admin_token") || localStorage.getItem("auth_token");

            // 先尝试删除，后端会检查是否有消费记录
            const response = await apiFetch(`/admin/users/${userId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();

            // 如果需要确认（有消费记录）
            if (data.needConfirm) {
                Modal.confirm({
                    title: '该用户存在消费记录',
                    content: (
                        <div>
                            <p>该用户存在以下记录：</p>
                            <ul style={{ marginTop: 8 }}>
                                {data.data.transactionCount > 0 && <li>积分交易: {data.data.transactionCount} 条</li>}
                                {data.data.orderCount > 0 && <li>充值订单: {data.data.orderCount} 条</li>}
                                {data.data.taskCount > 0 && <li>生成任务: {data.data.taskCount} 条</li>}
                            </ul>
                            <p style={{ marginTop: 12, color: '#ff4d4f' }}>
                                共 <strong>{data.data.totalRecords}</strong> 条记录
                            </p>
                            <p style={{ marginTop: 12, color: '#ff4d4f', fontWeight: 'bold' }}>
                                确认删除将同时删除该用户的所有记录，此操作不可恢复！
                            </p>
                        </div>
                    ),
                    okText: '确认删除',
                    okType: 'danger',
                    cancelText: '取消',
                    onOk: async () => {
                        // 强制删除（级联删除所有记录）
                        const forceResponse = await apiFetch(`/admin/users/${userId}?force=true&cascade=true`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${token}` },
                        });

                        const forceData = await forceResponse.json();
                        if (forceData.success) {
                            message.success("用户及所有记录已删除");
                            fetchUsers();
                        } else {
                            message.error(forceData.message || "删除失败");
                        }
                    },
                });
            } else if (data.success) {
                // 没有消费记录，直接删除成功
                message.success("用户删除成功");
                fetchUsers();
            } else {
                message.error(data.message || "删除失败");
            }
        } catch (error) {
            message.error("网络错误");
            console.error(error);
        }
    };

    const columns = [
        {
            title: "用户名",
            dataIndex: "username",
            key: "username",
            width: 120,
            render: (text: string, record: User) => (
                <div>
                    <div className="font-semibold text-slate-900">{text}</div>
                    {record.display_name && <div className="text-xs text-slate-500 mt-0.5">{record.display_name}</div>}
                </div>
            ),
        },
        {
            title: "邮箱",
            dataIndex: "email",
            key: "email",
            width: 200,
            ellipsis: true,
            render: (text: string) => (
                <span className="text-slate-700">{text}</span>
            ),
        },
        {
            title: "角色",
            dataIndex: "role",
            key: "role",
            width: 80,
            render: (role: string) => (
                <Tag color={role === "admin" ? "red" : "blue"} className="font-medium">
                    {role === "admin" ? "管理员" : "用户"}
                </Tag>
            ),
        },
        {
            title: "状态",
            dataIndex: "status",
            key: "status",
            width: 80,
            render: (status: string) => {
                const statusMap: Record<string, { color: string; text: string }> = {
                    active: { color: "success", text: "正常" },
                    inactive: { color: "default", text: "未激活" },
                    banned: { color: "error", text: "已封禁" },
                };
                const config = statusMap[status] || { color: "default", text: status };
                return <Tag color={config.color} className="font-medium">{config.text}</Tag>;
            },
        },
        {
            title: "积分余额",
            dataIndex: "balance_points",
            key: "balance_points",
            width: 100,
            align: "right" as const,
            render: (points: number) => (
                <span className="font-bold text-orange-600">{points.toLocaleString()}</span>
            ),
        },
        {
            title: "累计充值",
            dataIndex: "total_recharged",
            key: "total_recharged",
            width: 100,
            align: "right" as const,
            render: (points: number) => (
                <span className="font-medium text-emerald-600">{points.toLocaleString()}</span>
            ),
        },
        {
            title: "累计消费",
            dataIndex: "total_consumed",
            key: "total_consumed",
            width: 100,
            align: "right" as const,
            render: (points: number) => (
                <span className="font-medium text-slate-600">{points.toLocaleString()}</span>
            ),
        },
        {
            title: "注册时间",
            dataIndex: "created_at",
            key: "created_at",
            width: 160,
            render: (date: string) => (
                <span className="text-sm text-slate-600">{new Date(date).toLocaleString("zh-CN")}</span>
            ),
        },
        {
            title: "操作",
            key: "action",
            width: 260,
            fixed: "right" as const,
            render: (_: any, record: User) => (
                <Space size="small">
                    <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewDetail(record)}
                        className="!text-blue-600 hover:!text-blue-700"
                    >
                        详情
                    </Button>
                    <Button
                        type="link"
                        size="small"
                        icon={<DollarOutlined />}
                        onClick={() => handleRecharge(record.id)}
                        className="!text-emerald-600 hover:!text-emerald-700"
                    >
                        充值
                    </Button>
                    {record.status === "active" ? (
                        <Popconfirm
                            title="确定要封禁此用户吗？"
                            onConfirm={() => handleUpdateStatus(record.id, "banned", "管理员操作")}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Button
                                type="link"
                                size="small"
                                danger
                                icon={<StopOutlined />}
                                className="!text-red-600 hover:!text-red-700"
                            >
                                封禁
                            </Button>
                        </Popconfirm>
                    ) : record.status === "banned" ? (
                        <Button
                            type="link"
                            size="small"
                            icon={<CheckCircleOutlined />}
                            onClick={() => handleUpdateStatus(record.id, "active", "解除封禁")}
                            className="!text-green-600 hover:!text-green-700"
                        >
                            解封
                        </Button>
                    ) : null}
                    <Popconfirm
                        title="确定要删除此用户吗？"
                        description="删除后用户将无法登录"
                        onConfirm={() => handleDeleteUser(record.id)}
                        okText="确定删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                    >
                        <Button
                            type="link"
                            size="small"
                            danger
                            className="!text-red-600 hover:!text-red-700"
                        >
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 p-6">
            {/* 页面标题 */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">用户管理</h2>
                <p className="text-slate-600">管理系统用户、查看用户详情、充值和状态控制</p>
            </div>

            {/* 筛选和搜索栏 */}
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">状态:</span>
                    <Select
                        value={filterStatus}
                        onChange={setFilterStatus}
                        style={{
                            width: 120,
                        }}
                        popupClassName="admin-select-dropdown"
                    >
                        <Select.Option value="all">全部</Select.Option>
                        <Select.Option value="active">正常</Select.Option>
                        <Select.Option value="inactive">未激活</Select.Option>
                        <Select.Option value="banned">已封禁</Select.Option>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">角色:</span>
                    <Select
                        value={filterRole}
                        onChange={setFilterRole}
                        style={{
                            width: 120,
                        }}
                        popupClassName="admin-select-dropdown"
                    >
                        <Select.Option value="all">全部</Select.Option>
                        <Select.Option value="user">普通用户</Select.Option>
                        <Select.Option value="admin">管理员</Select.Option>
                    </Select>
                </div>
                <Search
                    placeholder="搜索用户名、邮箱或昵称"
                    allowClear
                    style={{ width: 300 }}
                    onSearch={setSearchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    prefix={<SearchOutlined className="text-slate-400" />}
                />
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-500">共</span>
                    <span className="text-lg font-bold text-blue-600">{total}</span>
                    <span className="text-sm font-medium text-slate-500">个用户</span>
                </div>
                <Button
                    icon={<ReloadOutlined />}
                    onClick={fetchUsers}
                    className="!border-slate-200 !text-slate-600 hover:!border-blue-500 hover:!text-blue-600"
                >
                    刷新
                </Button>
            </div>

            {/* 表格 */}
            <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
                <style>{`
                    /* 强制修复分页下拉框样式 - 覆盖暗色主题 */
                    .ant-pagination-options .ant-select,
                    .dark .ant-pagination-options .ant-select {
                        background-color: white !important;
                    }

                    .ant-pagination-options .ant-select-selector,
                    .dark .ant-pagination-options .ant-select-selector {
                        background-color: white !important;
                        border: 1px solid #cbd5e1 !important;
                        color: #1e293b !important;
                    }

                    .ant-pagination-options .ant-select-selection-item,
                    .dark .ant-pagination-options .ant-select-selection-item {
                        color: #1e293b !important;
                        background-color: transparent !important;
                    }

                    .ant-pagination-options .ant-select-arrow,
                    .dark .ant-pagination-options .ant-select-arrow {
                        color: #64748b !important;
                    }

                    .ant-select-dropdown,
                    .dark .ant-select-dropdown {
                        background-color: white !important;
                    }

                    .ant-select-item,
                    .dark .ant-select-item {
                        color: #1e293b !important;
                        background-color: white !important;
                    }

                    .ant-select-item-option-selected,
                    .dark .ant-select-item-option-selected {
                        background-color: #eff6ff !important;
                        color: #2563eb !important;
                    }

                    .ant-select-item-option-active,
                    .dark .ant-select-item-option-active {
                        background-color: #f1f5f9 !important;
                    }

                    /* 顶部Select框也修复 */
                    .admin-select-dropdown,
                    .dark .admin-select-dropdown {
                        background-color: white !important;
                    }

                    .admin-select-dropdown .ant-select-item,
                    .dark .admin-select-dropdown .ant-select-item {
                        background-color: white !important;
                        color: #1e293b !important;
                    }
                `}</style>
                <Table
                    dataSource={users}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1400 }}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: total,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条`,
                        onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
                    }}
                />
            </div>

            {/* 用户详情模态框 */}
            <Modal
                title="用户详情"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={null}
                width={800}
            >
                {detailLoading ? (
                    <div className="text-center py-8">加载中...</div>
                ) : selectedUser ? (
                    <div className="space-y-6">
                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="用户名">{selectedUser.username}</Descriptions.Item>
                            <Descriptions.Item label="昵称">{selectedUser.display_name}</Descriptions.Item>
                            <Descriptions.Item label="邮箱">{selectedUser.email}</Descriptions.Item>
                            <Descriptions.Item label="角色">
                                <Tag color={selectedUser.role === "admin" ? "red" : "blue"}>
                                    {selectedUser.role === "admin" ? "管理员" : "用户"}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="状态">
                                <Tag color={selectedUser.status === "active" ? "success" : "error"}>
                                    {selectedUser.status === "active" ? "正常" : selectedUser.status}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="积分余额">
                                <span className="font-semibold text-orange-600">
                                    {selectedUser.balance_points.toLocaleString()}
                                </span>
                            </Descriptions.Item>
                            <Descriptions.Item label="累计充值">
                                {selectedUser.total_recharged.toLocaleString()}
                            </Descriptions.Item>
                            <Descriptions.Item label="累计消费">
                                {selectedUser.total_consumed.toLocaleString()}
                            </Descriptions.Item>
                            <Descriptions.Item label="注册时间" span={2}>
                                {new Date(selectedUser.created_at).toLocaleString("zh-CN")}
                            </Descriptions.Item>
                            {selectedUser.last_login_at && (
                                <Descriptions.Item label="最后登录" span={2}>
                                    {new Date(selectedUser.last_login_at).toLocaleString("zh-CN")}
                                </Descriptions.Item>
                            )}
                        </Descriptions>

                        <div>
                            <h3 className="text-lg font-semibold mb-3">任务统计</h3>
                            <div className="grid grid-cols-4 gap-4">
                                <div className="rounded-lg border bg-gray-50 p-4">
                                    <div className="text-sm text-gray-600">总任务数</div>
                                    <div className="mt-1 text-2xl font-bold">{selectedUser.stats.tasks.total}</div>
                                </div>
                                <div className="rounded-lg border bg-green-50 p-4">
                                    <div className="text-sm text-green-600">已完成</div>
                                    <div className="mt-1 text-2xl font-bold text-green-600">{selectedUser.stats.tasks.completed}</div>
                                </div>
                                <div className="rounded-lg border bg-red-50 p-4">
                                    <div className="text-sm text-red-600">失败</div>
                                    <div className="mt-1 text-2xl font-bold text-red-600">{selectedUser.stats.tasks.failed}</div>
                                </div>
                                <div className="rounded-lg border bg-blue-50 p-4">
                                    <div className="text-sm text-blue-600">进行中</div>
                                    <div className="mt-1 text-2xl font-bold text-blue-600">{selectedUser.stats.tasks.active}</div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-3">最近交易记录</h3>
                            <div className="max-h-60 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left">类型</th>
                                            <th className="px-3 py-2 text-right">积分</th>
                                            <th className="px-3 py-2 text-left">备注</th>
                                            <th className="px-3 py-2 text-left">时间</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedUser.recentTransactions.map((tx) => (
                                            <tr key={tx.id} className="border-t">
                                                <td className="px-3 py-2">
                                                    <Tag color={tx.type === "recharge" ? "green" : "orange"}>
                                                        {tx.type === "recharge" ? "充值" : "消费"}
                                                    </Tag>
                                                </td>
                                                <td className="px-3 py-2 text-right font-medium">
                                                    {tx.type === "recharge" ? "+" : "-"}{Math.abs(tx.points)}
                                                </td>
                                                <td className="px-3 py-2 text-gray-600">{tx.remark}</td>
                                                <td className="px-3 py-2 text-gray-500">
                                                    {new Date(tx.created_at).toLocaleString("zh-CN")}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : null}
            </Modal>

            {/* 充值模态框 */}
            <Modal
                title="手动充值积分"
                open={rechargeVisible}
                onCancel={() => setRechargeVisible(false)}
                onOk={handleRechargeSubmit}
                okText="确认充值"
                cancelText="取消"
            >
                <div className="space-y-4 py-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">充值金额（积分）</label>
                        <Input
                            type="number"
                            value={rechargeAmount}
                            onChange={(e) => setRechargeAmount(Number(e.target.value))}
                            placeholder="请输入充值积分数量"
                            min={1}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">备注（可选）</label>
                        <Input.TextArea
                            value={rechargeNote}
                            onChange={(e) => setRechargeNote(e.target.value)}
                            placeholder="充值原因或备注"
                            rows={3}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
