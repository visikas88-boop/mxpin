import { useState } from "react";
import { apiFetch } from "@/utils/api-config";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, Card, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";

type AdminLoginFormData = {
    username: string;
    password: string;
};

export default function AdminLoginPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    const handleLogin = async (values: AdminLoginFormData) => {
        setLoading(true);
        try {
            const response = await apiFetch("/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    login: values.username,
                    password: values.password,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // 检查是否是管理员
                if (data.data.user.role !== "admin") {
                    message.error("您没有管理员权限");
                    return;
                }

                localStorage.setItem("admin_token", data.data.token);
                localStorage.setItem("admin_user", JSON.stringify(data.data.user));
                message.success("登录成功");
                navigate("/admin/dashboard");
            } else {
                message.error(data.message || "登录失败");
            }
        } catch (error) {
            message.error("网络错误，请稍后重试");
            console.error("Admin login error:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-4">
            <div className="w-full max-w-md">
                {/* Logo和标题 */}
                <div className="mb-8 text-center">
                    <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg">
                        <UserOutlined className="text-3xl text-white" />
                    </div>
                    <h1 className="mb-2 text-3xl font-bold text-white">
                        VideoFlow Pro
                    </h1>
                    <p className="text-lg text-slate-300">
                        后台管理系统
                    </p>
                </div>

                {/* 登录卡片 */}
                <Card className="shadow-2xl border-0">
                    <Form form={form} onFinish={handleLogin} layout="vertical" size="large">
                        <Form.Item
                            name="username"
                            rules={[{ required: true, message: "请输入管理员账号" }]}
                        >
                            <Input
                                prefix={<UserOutlined className="text-gray-400" />}
                                placeholder="管理员账号"
                                className="h-12"
                            />
                        </Form.Item>

                        <Form.Item
                            name="password"
                            rules={[{ required: true, message: "请输入密码" }]}
                        >
                            <Input.Password
                                prefix={<LockOutlined className="text-gray-400" />}
                                placeholder="密码"
                                className="h-12"
                            />
                        </Form.Item>

                        <Form.Item className="mb-0">
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={loading}
                                size="large"
                                className="h-12 text-base font-semibold"
                            >
                                {loading ? "登录中..." : "登录"}
                            </Button>
                        </Form.Item>
                    </Form>

                    <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
                        <LockOutlined />
                        <span>仅限管理员访问</span>
                    </div>
                </Card>

                {/* 底部提示 */}
                <div className="mt-6 text-center text-sm text-slate-400">
                    © 2024 VideoFlow Pro. All rights reserved.
                </div>
            </div>
        </div>
    );
}
