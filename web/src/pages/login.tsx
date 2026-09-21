import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Form, Input, Button, Card, message, Tabs } from "antd";
import { UserOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";

type LoginFormData = {
    username: string;
    password: string;
};

type RegisterFormData = {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
};

export default function LoginPage() {
    const navigate = useNavigate();
    const [loginLoading, setLoginLoading] = useState(false);
    const [registerLoading, setRegisterLoading] = useState(false);
    const [loginForm] = Form.useForm();
    const [registerForm] = Form.useForm();

    const handleLogin = async (values: LoginFormData) => {
        setLoginLoading(true);
        try {
            const response = await fetch("http://localhost:3001/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    login: values.username,  // 后端期望的字段名是 login
                    password: values.password,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("auth_token", data.data.token);
                message.success("登录成功");
                navigate("/");
            } else {
                message.error(data.message || "登录失败");
            }
        } catch (error) {
            message.error("网络错误，请稍后重试");
            console.error("Login error:", error);
        } finally {
            setLoginLoading(false);
        }
    };

    const handleRegister = async (values: RegisterFormData) => {
        if (values.password !== values.confirmPassword) {
            message.error("两次输入的密码不一致");
            return;
        }

        setRegisterLoading(true);
        try {
            const response = await fetch("http://localhost:3001/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: values.username,
                    email: values.email,
                    password: values.password,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("auth_token", data.data.token);
                message.success("注册成功");
                navigate("/");
            } else {
                message.error(data.message || "注册失败");
            }
        } catch (error) {
            message.error("网络错误，请稍后重试");
            console.error("Register error:", error);
        } finally {
            setRegisterLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 dark:bg-stone-900">
            <Card className="w-full max-w-md shadow-lg">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold text-stone-950 dark:text-stone-100">Mxpin</h1>
                    <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">AI视频生成与发布平台</p>
                </div>

                <Tabs
                    defaultActiveKey="login"
                    centered
                    items={[
                        {
                            key: "login",
                            label: "登录",
                            children: (
                                <Form form={loginForm} onFinish={handleLogin} layout="vertical" size="large">
                                    <Form.Item
                                        name="username"
                                        rules={[{ required: true, message: "请输入用户名" }]}
                                    >
                                        <Input prefix={<UserOutlined />} placeholder="用户名" />
                                    </Form.Item>

                                    <Form.Item
                                        name="password"
                                        rules={[{ required: true, message: "请输入密码" }]}
                                    >
                                        <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                                    </Form.Item>

                                    <Form.Item>
                                        <Button type="primary" htmlType="submit" block loading={loginLoading}>
                                            登录
                                        </Button>
                                    </Form.Item>
                                </Form>
                            ),
                        },
                        {
                            key: "register",
                            label: "注册",
                            children: (
                                <Form form={registerForm} onFinish={handleRegister} layout="vertical" size="large">
                                    <Form.Item
                                        name="username"
                                        rules={[
                                            { required: true, message: "请输入用户名" },
                                            { min: 3, message: "用户名至少3个字符" },
                                        ]}
                                    >
                                        <Input prefix={<UserOutlined />} placeholder="用户名" />
                                    </Form.Item>

                                    <Form.Item
                                        name="email"
                                        rules={[
                                            { required: true, message: "请输入邮箱" },
                                            { type: "email", message: "请输入有效的邮箱地址" },
                                        ]}
                                    >
                                        <Input prefix={<MailOutlined />} placeholder="邮箱" />
                                    </Form.Item>

                                    <Form.Item
                                        name="password"
                                        rules={[
                                            { required: true, message: "请输入密码" },
                                            { min: 6, message: "密码至少6个字符" },
                                        ]}
                                    >
                                        <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                                    </Form.Item>

                                    <Form.Item
                                        name="confirmPassword"
                                        dependencies={["password"]}
                                        rules={[
                                            { required: true, message: "请确认密码" },
                                            ({ getFieldValue }) => ({
                                                validator(_, value) {
                                                    if (!value || getFieldValue("password") === value) {
                                                        return Promise.resolve();
                                                    }
                                                    return Promise.reject(new Error("两次输入的密码不一致"));
                                                },
                                            }),
                                        ]}
                                    >
                                        <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
                                    </Form.Item>

                                    <Form.Item>
                                        <Button type="primary" htmlType="submit" block loading={registerLoading}>
                                            注册
                                        </Button>
                                    </Form.Item>
                                </Form>
                            ),
                        },
                    ]}
                />
            </Card>
        </div>
    );
}
