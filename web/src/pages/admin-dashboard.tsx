import { useEffect, useState } from "react";
import { apiFetch } from "@/utils/api-config";
import { useNavigate } from "react-router-dom";
import { Layout, Menu, Avatar, Dropdown, message } from "antd";
import {
    DashboardOutlined,
    UserOutlined,
    VideoCameraOutlined,
    SettingOutlined,
    LogoutOutlined,
    WalletOutlined,
    FileTextOutlined,
    HomeOutlined,
    CrownOutlined,
    ApiOutlined,
    TeamOutlined,
    CheckCircleOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import ModelManagementPage from "./admin-models";
import UserManagementPage from "./admin-users";
import PointsManagementPage from "./admin-points";
import AdminSettingsPage from "./admin-settings";
import AdminSettingsPageSimple from "./admin-settings-simple";
import AdminSettingsPageFixed from "./admin-settings-fixed";
// Upload-Post 集成页面
import AdminSubscriptionPlans from "./admin-subscription-plans";
import AdminUploadPostConfig from "./admin-upload-post-config";
import AdminProfileQuota from "./admin-profile-quota";

const { Header, Sider, Content } = Layout;

interface DashboardStats {
    users: {
        total_users: number;
        active_users: number;
        new_users_today: number;
        active_today: number;
    };
    tasks: {
        total_tasks: number;
        completed_tasks: number;
        failed_tasks: number;
        tasks_today: number;
    };
    points: {
        total_balance: number;
        total_recharged: number;
        total_consumed: number;
        recharged_today: number;
        consumed_today: number;
    };
}

function DashboardOverview() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("admin_token");
            const response = await apiFetch("/admin/dashboard/stats", {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();
            if (response.ok) {
                setStats(data.data);
            } else {
                message.error(data.message || "获取统计数据失败");
            }
        } catch (error) {
            message.error("网络错误");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-gray-500">加载中...</div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-gray-500">暂无数据</div>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 p-6">
            <div className="space-y-8">
                {/* 用户统计 */}
                <div>
                    <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                            <UserOutlined className="text-xl text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">用户统计</h3>
                            <p className="text-sm text-gray-500">User Statistics</p>
                        </div>
                    </div>
                    <div className="grid gap-5 md:grid-cols-4">
                        <div className="group relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm transition-all hover:shadow-md">
                            <div className="relative z-10">
                                <div className="text-sm font-semibold text-blue-600">总用户数</div>
                                <div className="mt-3 text-4xl font-bold text-blue-700">{stats.users.total_users}</div>
                                <div className="mt-2 flex items-center gap-1 text-xs text-gray-600">
                                    <CheckCircleOutlined className="text-green-500" />
                                    <span>活跃 {stats.users.active_users}</span>
                                </div>
                            </div>
                            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-blue-200/30" />
                        </div>
                        <div className="group relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm transition-all hover:shadow-md">
                            <div className="relative z-10">
                                <div className="text-sm font-semibold text-emerald-600">今日新增</div>
                                <div className="mt-3 text-4xl font-bold text-emerald-700">{stats.users.new_users_today}</div>
                                <div className="mt-2 text-xs text-gray-600">新注册用户</div>
                            </div>
                            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-emerald-200/30" />
                        </div>
                        <div className="group relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-6 shadow-sm transition-all hover:shadow-md">
                            <div className="relative z-10">
                                <div className="text-sm font-semibold text-violet-600">今日活跃</div>
                                <div className="mt-3 text-4xl font-bold text-violet-700">{stats.users.active_today}</div>
                                <div className="mt-2 text-xs text-gray-600">今日登录用户</div>
                            </div>
                            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-violet-200/30" />
                        </div>
                        <div className="group relative overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white p-6 shadow-sm transition-all hover:shadow-md">
                            <div className="relative z-10">
                                <div className="text-sm font-semibold text-cyan-600">活跃率</div>
                                <div className="mt-3 text-4xl font-bold text-cyan-700">
                                    {stats.users.total_users > 0
                                        ? ((stats.users.active_users / stats.users.total_users) * 100).toFixed(1)
                                        : 0}%
                                </div>
                                <div className="mt-2 text-xs text-gray-600">活跃用户占比</div>
                            </div>
                            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-cyan-200/30" />
                        </div>
                    </div>
                </div>

                {/* 任务统计 */}
                <div>
                    <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
                            <VideoCameraOutlined className="text-xl text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">任务统计</h3>
                            <p className="text-sm text-gray-500">Task Statistics</p>
                        </div>
                    </div>
                    <div className="grid gap-5 md:grid-cols-4">
                        <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
                            <div className="relative z-10">
                                <div className="text-sm font-semibold text-gray-600">总任务数</div>
                                <div className="mt-3 text-4xl font-bold text-gray-800">{stats.tasks.total_tasks}</div>
                                <div className="mt-2 text-xs text-gray-500">All Tasks</div>
                            </div>
                        </div>
                        <div className="group relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm transition-all hover:shadow-md">
                            <div className="relative z-10">
                                <div className="text-sm font-semibold text-emerald-600">已完成</div>
                                <div className="mt-3 text-4xl font-bold text-emerald-700">{stats.tasks.completed_tasks}</div>
                                <div className="mt-2 text-xs text-gray-600">Completed</div>
                            </div>
                            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-emerald-200/30" />
                        </div>
                        <div className="group relative overflow-hidden rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-6 shadow-sm transition-all hover:shadow-md">
                            <div className="relative z-10">
                                <div className="text-sm font-semibold text-red-600">失败</div>
                                <div className="mt-3 text-4xl font-bold text-red-700">{stats.tasks.failed_tasks}</div>
                                <div className="mt-2 text-xs text-gray-600">Failed</div>
                            </div>
                            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-red-200/30" />
                        </div>
                        <div className="group relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm transition-all hover:shadow-md">
                            <div className="relative z-10">
                                <div className="text-sm font-semibold text-blue-600">今日任务</div>
                                <div className="mt-3 text-4xl font-bold text-blue-700">{stats.tasks.tasks_today}</div>
                                <div className="mt-2 text-xs text-gray-600">Today</div>
                            </div>
                            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-blue-200/30" />
                        </div>
                    </div>
                </div>

                {/* 积分统计 */}
                <div>
                    <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
                            <WalletOutlined className="text-xl text-orange-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">积分统计</h3>
                            <p className="text-sm text-gray-500">Points Statistics</p>
                        </div>
                    </div>
                    <div className="grid gap-5 md:grid-cols-4">
                        <div className="group relative overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-6 shadow-sm transition-all hover:shadow-md">
                            <div className="relative z-10">
                                <div className="text-sm font-semibold text-orange-600">系统总余额</div>
                                <div className="mt-3 text-4xl font-bold text-orange-700">
                                    {stats.points.total_balance.toLocaleString()}
                                </div>
                                <div className="mt-2 text-xs text-gray-600">所有用户积分总和</div>
                            </div>
                            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-orange-200/30" />
                        </div>
                        <div className="group relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm transition-all hover:shadow-md">
                            <div className="relative z-10">
                                <div className="text-sm font-semibold text-emerald-600">累计充值</div>
                                <div className="mt-3 text-4xl font-bold text-emerald-700">
                                    {stats.points.total_recharged.toLocaleString()}
                                </div>
                                <div className="mt-2 text-xs text-gray-600">
                                    今日: +{stats.points.recharged_today.toLocaleString()}
                                </div>
                            </div>
                            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-emerald-200/30" />
                        </div>
                        <div className="group relative overflow-hidden rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-6 shadow-sm transition-all hover:shadow-md">
                            <div className="relative z-10">
                                <div className="text-sm font-semibold text-red-600">累计消费</div>
                                <div className="mt-3 text-4xl font-bold text-red-700">
                                    {stats.points.total_consumed.toLocaleString()}
                                </div>
                                <div className="mt-2 text-xs text-gray-600">
                                    今日: -{stats.points.consumed_today.toLocaleString()}
                                </div>
                            </div>
                            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-red-200/30" />
                        </div>
                        <div className="group relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-6 shadow-sm transition-all hover:shadow-md">
                            <div className="relative z-10">
                                <div className="text-sm font-semibold text-violet-600">消费率</div>
                                <div className="mt-3 text-4xl font-bold text-violet-700">
                                    {stats.points.total_recharged > 0
                                        ? ((stats.points.total_consumed / stats.points.total_recharged) * 100).toFixed(1)
                                        : 0}%
                                </div>
                                <div className="mt-2 text-xs text-gray-600">消费/充值比例</div>
                            </div>
                            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-violet-200/30" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface AdminUser {
    id: number;
    username: string;
    email: string;
    role: string;
}

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
    const [selectedMenu, setSelectedMenu] = useState("dashboard");

    useEffect(() => {
        // 检查登录状态
        const token = localStorage.getItem("admin_token");
        const user = localStorage.getItem("admin_user");

        if (!token || !user) {
            navigate("/admin/login");
            return;
        }

        setAdminUser(JSON.parse(user));
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
        message.success("已退出登录");
        navigate("/admin/login");
    };

    const userMenuItems: MenuProps["items"] = [
        {
            key: "home",
            icon: <HomeOutlined />,
            label: "返回首页",
            onClick: () => navigate("/"),
        },
        {
            type: "divider",
        },
        {
            key: "logout",
            icon: <LogoutOutlined />,
            label: "退出登录",
            danger: true,
            onClick: handleLogout,
        },
    ];

    const sideMenuItems: MenuProps["items"] = [
        {
            key: "dashboard",
            icon: <DashboardOutlined />,
            label: "数据概览",
        },
        {
            key: "users",
            icon: <UserOutlined />,
            label: "用户管理",
        },
        {
            key: "models",
            icon: <VideoCameraOutlined />,
            label: "模型管理",
        },
        {
            key: "tasks",
            icon: <FileTextOutlined />,
            label: "任务管理",
        },
        {
            key: "points",
            icon: <WalletOutlined />,
            label: "积分管理",
        },
        {
            type: "divider",
        },
        {
            key: "subscription-plans",
            icon: <CrownOutlined />,
            label: "订阅套餐",
        },
        {
            key: "upload-post",
            icon: <ApiOutlined />,
            label: "Upload-Post配置",
        },
        {
            key: "profile-quota",
            icon: <TeamOutlined />,
            label: "Profile配额",
        },
        {
            type: "divider",
        },
        {
            key: "settings",
            icon: <SettingOutlined />,
            label: "系统设置",
        },
    ];

    const handleMenuClick = ({ key }: { key: string }) => {
        console.log("Menu clicked:", key); // 调试日志
        setSelectedMenu(key);
    };

    const renderContent = () => {
        console.log("Rendering content for:", selectedMenu);

        try {
            switch (selectedMenu) {
                case "models":
                    return <ModelManagementPage />;
                case "users":
                    return <UserManagementPage />;
                case "points":
                    return <PointsManagementPage />;
                case "tasks":
                    return <div className="min-h-full bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50 p-8 pb-24"><div className="text-center text-lg text-gray-500">任务管理功能开发中...</div></div>;
                case "subscription-plans":
                    return <AdminSubscriptionPlans />;
                case "upload-post":
                    return <AdminUploadPostConfig />;
                case "profile-quota":
                    return <AdminProfileQuota />;
                case "settings":
                    return <AdminSettingsPage />;
                case "dashboard":
                default:
                    return <DashboardOverview />;
            }
        } catch (error) {
            console.error('渲染内容错误:', error);
            return (
                <div className="p-8">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
                        <h3 className="text-lg font-semibold text-red-800 mb-2">渲染错误</h3>
                        <p className="text-sm text-red-600">{String(error)}</p>
                    </div>
                </div>
            );
        }
    };

    const getPageTitle = () => {
        const titleMap: Record<string, string> = {
            dashboard: "数据概览",
            users: "用户管理",
            models: "模型管理",
            tasks: "任务管理",
            points: "积分管理",
            "subscription-plans": "订阅套餐管理",
            "upload-post": "Upload-Post配置",
            "profile-quota": "Profile配额管理",
            settings: "系统设置",
        };
        return titleMap[selectedMenu] || "数据概览";
    };

    if (!adminUser) {
        return null;
    }

    return (
        <Layout className="admin-layout min-h-screen bg-slate-50">
            {/* 左侧边栏 - 固定 */}
            <Sider
                width={260}
                className="!fixed !left-0 !top-0 !h-screen !overflow-auto !bg-gradient-to-b !from-slate-900 !to-slate-950"
                theme="dark"
            >
                {/* Logo区域 */}
                <div className="flex h-16 items-center justify-center border-b border-slate-700/50 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600">
                            <VideoCameraOutlined className="text-lg text-white" />
                        </div>
                        <h1 className="text-lg font-bold text-white">VideoFlow Pro</h1>
                    </div>
                </div>

                {/* 菜单区域 */}
                <Menu
                    mode="inline"
                    selectedKeys={[selectedMenu]}
                    items={sideMenuItems}
                    onClick={handleMenuClick}
                    className="admin-sidebar-menu !border-r-0 !bg-transparent mt-4 px-3"
                    theme="dark"
                    style={{
                        fontSize: '14px',
                    }}
                />

                {/* 版本信息 */}
                <div className="absolute bottom-0 left-0 right-0 border-t border-slate-700/50 bg-slate-900/50 p-4">
                    <div className="text-center text-xs text-slate-400">
                        v0.20.0
                    </div>
                </div>

                <style>{`
                    .admin-sidebar-menu .ant-menu-item,
                    .admin-sidebar-menu .ant-menu-submenu-title {
                        margin: 4px 0;
                        border-radius: 0.5rem;
                        color: #cbd5e1 !important;
                        transition: all 0.2s;
                    }
                    .admin-sidebar-menu .ant-menu-item:hover,
                    .admin-sidebar-menu .ant-menu-submenu-title:hover {
                        color: #f1f5f9 !important;
                        background-color: rgba(255, 255, 255, 0.08) !important;
                    }
                    .admin-sidebar-menu .ant-menu-item-selected {
                        color: #ffffff !important;
                        background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%) !important;
                        border-left: 3px solid #3b82f6;
                    }
                    .admin-sidebar-menu .ant-menu-item .anticon,
                    .admin-sidebar-menu .ant-menu-submenu-title .anticon {
                        color: #94a3b8 !important;
                        font-size: 16px;
                    }
                    .admin-sidebar-menu .ant-menu-item-selected .anticon {
                        color: #60a5fa !important;
                    }
                    .admin-sidebar-menu .ant-menu-item-divider {
                        background-color: rgba(148, 163, 184, 0.1) !important;
                        margin: 12px 0;
                    }
                `}</style>
            </Sider>

            {/* 右侧内容区 - 左边距260px */}
            <Layout className="ml-[260px] bg-slate-50">
                {/* 顶部导航栏 */}
                <Header className="!bg-white !px-8 shadow-sm border-b border-slate-200">
                    <div className="flex h-full items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold text-slate-900">
                                {getPageTitle()}
                            </h2>
                            <div className="h-6 w-px bg-slate-200" />
                            <span className="text-sm text-slate-500">管理后台</span>
                        </div>
                        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                            <div className="flex cursor-pointer items-center gap-3 rounded-xl px-4 py-2 transition-all hover:bg-slate-50">
                                <Avatar
                                    size={36}
                                    icon={<UserOutlined />}
                                    style={{
                                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                                    }}
                                />
                                <div className="flex flex-col items-start">
                                    <span className="text-sm font-semibold text-slate-900">
                                        {adminUser.username}
                                    </span>
                                    <span className="text-xs text-slate-500">管理员</span>
                                </div>
                            </div>
                        </Dropdown>
                    </div>
                </Header>

                {/* 主内容区 */}
                <Content className="bg-slate-50">
                    {renderContent()}
                </Content>
            </Layout>
        </Layout>
    );
}
