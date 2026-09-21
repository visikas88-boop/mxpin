import { useState, useEffect } from "react";
import { Dropdown, Button, Avatar, Space, Badge } from "antd";
import { UserOutlined, LogoutOutlined, LoginOutlined, DollarOutlined, SettingOutlined, LinkOutlined, HistoryOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { MenuProps } from "antd";
import { RechargeModal } from "@/components/points/RechargeModal";

interface UserInfo {
    id: number;
    username: string;
    email: string;
    balancePoints: number;
    role?: string;
}

export function UserDropdown() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [rechargeModalOpen, setRechargeModalOpen] = useState(false);

    useEffect(() => {
        fetchUserInfo();
    }, []);

    const fetchUserInfo = async () => {
        try {
            // 检查所有可能的token位置
            const token = localStorage.getItem("user_token")
                || localStorage.getItem("token")
                || localStorage.getItem("auth_token")
                || localStorage.getItem("admin_token");

            if (!token) {
                setLoading(false);
                return;
            }

            const response = await fetch("http://localhost:3001/api/auth/me", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.data.user || data.data);
            } else {
                // 清除所有token
                localStorage.removeItem("auth_token");
                localStorage.removeItem("user_token");
                localStorage.removeItem("token");
                localStorage.removeItem("admin_token");
            }
        } catch (error) {
            console.error("Failed to fetch user info:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        // 清除所有可能的token
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user_token");
        localStorage.removeItem("token");
        localStorage.removeItem("admin_token");

        setUser(null);

        // 跳转到登录页
        navigate("/login");
    };

    const handleLogin = () => {
        navigate("/login");
    };

    const handleRechargeSuccess = () => {
        // 充值成功后刷新用户信息
        fetchUserInfo();
    };

    if (loading) {
        return (
            <Button type="text" shape="circle" loading className="!h-9 !w-9 !min-w-9" />
        );
    }

    // 未登录状态
    if (!user) {
        return (
            <Button
                type="text"
                icon={<LoginOutlined />}
                onClick={handleLogin}
                className="!h-9 !px-4 text-stone-600 hover:!text-stone-950 dark:text-stone-400 dark:hover:!text-stone-100"
            >
                登录
            </Button>
        );
    }

    // 已登录状态
    const items: MenuProps["items"] = [
        {
            key: "user-info",
            label: (
                <div className="px-2 py-1">
                    <div className="text-sm font-medium text-stone-950 dark:text-stone-100">{user.username}</div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">{user.email}</div>
                </div>
            ),
            disabled: true,
        },
        {
            type: "divider",
        },
        {
            key: "recharge",
            icon: <DollarOutlined />,
            label: t("userMenu.recharge"),
            onClick: () => setRechargeModalOpen(true),
        },
        {
            type: "divider",
        },
        {
            key: "social-accounts",
            icon: <LinkOutlined />,
            label: "社交账号",
            onClick: () => navigate("/social-accounts"),
        },
        {
            key: "publishing-history",
            icon: <HistoryOutlined />,
            label: "发布历史",
            onClick: () => navigate("/publishing-history"),
        },
        // 只对管理员显示后台管理入口
        ...(user.role === "admin"
            ? [
                  {
                      type: "divider" as const,
                  },
                  {
                      key: "admin",
                      icon: <SettingOutlined />,
                      label: t("userMenu.admin"),
                      onClick: () => navigate("/admin/dashboard"),
                  },
              ]
            : []),
        {
            type: "divider",
        },
        {
            key: "logout",
            icon: <LogoutOutlined />,
            label: t("userMenu.logout"),
            onClick: handleLogout,
            danger: true,
        },
    ];

    return (
        <>
            {/* 积分余额显示 */}
            <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 dark:border-stone-700 dark:bg-stone-900">
                <DollarOutlined className="text-orange-500" />
                <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                    {(user.balancePoints || 0).toLocaleString()}
                </span>
            </div>

            {/* 用户下拉菜单 */}
            <Dropdown menu={{ items }} placement="bottomRight" arrow>
                <Button type="text" className="!h-9 !min-w-9 !px-2 hover:!bg-stone-100 dark:hover:!bg-stone-900">
                    <Space size={8}>
                        <Avatar
                            size={28}
                            icon={<UserOutlined />}
                            style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                border: 'none'
                            }}
                        />
                        <span className="text-sm font-medium text-stone-950 dark:text-stone-100">{user.username}</span>
                    </Space>
                </Button>
            </Dropdown>

            {/* 积分充值弹窗 */}
            <RechargeModal
                open={rechargeModalOpen}
                onClose={() => setRechargeModalOpen(false)}
                onSuccess={handleRechargeSuccess}
            />
        </>
    );
}
