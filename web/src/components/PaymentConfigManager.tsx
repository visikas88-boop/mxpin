import { useEffect, useState } from "react";
import { Table, Button, Form, Input, Switch, message, Modal, Space } from "antd";
import { EditOutlined, SaveOutlined, ReloadOutlined } from "@ant-design/icons";
import { apiFetch } from "@/utils/api-config";

interface PaymentConfig {
    id: number;
    gateway_name: string;
    display_name: string;
    is_enabled: boolean;
    api_url: string;
    callback_url: string;
    return_url?: string;
    merchant_id: string;
    merchant_key: string;
    app_id?: string;
    app_secret?: string;
    extra_config?: any;
    created_at: string;
    updated_at: string;
}

export default function PaymentConfigManager() {
    const [configs, setConfigs] = useState<PaymentConfig[]>([]);
    const [loading, setLoading] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingConfig, setEditingConfig] = useState<PaymentConfig | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("auth_token");
            const response = await apiFetch("/payment-config", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();
            if (data.success) {
                setConfigs(data.data);
            } else {
                message.error(data.message || "获取支付配置失败");
            }
        } catch (error) {
            console.error("获取支付配置失败:", error);
            message.error("网络错误");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (record: PaymentConfig) => {
        setEditingConfig(record);
        form.setFieldsValue(record);
        setEditModalVisible(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const token = localStorage.getItem("auth_token");

            const response = await apiFetch(`/payment-config/${editingConfig?.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(values),
            });

            const data = await response.json();
            if (data.success) {
                message.success("保存成功");
                setEditModalVisible(false);
                fetchConfigs();
            } else {
                message.error(data.message || "保存失败");
            }
        } catch (error) {
            console.error("保存失败:", error);
            message.error("保存失败");
        }
    };

    const handleToggleEnable = async (record: PaymentConfig) => {
        try {
            const token = localStorage.getItem("auth_token");
            const response = await apiFetch(`/payment-config/${record.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    is_enabled: !record.is_enabled,
                }),
            });

            const data = await response.json();
            if (data.success) {
                message.success(record.is_enabled ? "已禁用" : "已启用");
                fetchConfigs();
            } else {
                message.error(data.message || "操作失败");
            }
        } catch (error) {
            console.error("操作失败:", error);
            message.error("操作失败");
        }
    };

    const columns = [
        {
            title: "支付网关",
            dataIndex: "display_name",
            key: "display_name",
            width: 120,
        },
        {
            title: "网关名称",
            dataIndex: "gateway_name",
            key: "gateway_name",
            width: 120,
        },
        {
            title: "状态",
            dataIndex: "is_enabled",
            key: "is_enabled",
            width: 100,
            render: (enabled: boolean, record: PaymentConfig) => (
                <Switch checked={enabled} onChange={() => handleToggleEnable(record)} />
            ),
        },
        {
            title: "API地址",
            dataIndex: "api_url",
            key: "api_url",
            ellipsis: true,
            width: 200,
        },
        {
            title: "回调地址",
            dataIndex: "callback_url",
            key: "callback_url",
            ellipsis: true,
            width: 200,
        },
        {
            title: "商户ID",
            dataIndex: "merchant_id",
            key: "merchant_id",
            width: 150,
            render: (text: string) => text || "-",
        },
        {
            title: "商户密钥",
            dataIndex: "merchant_key",
            key: "merchant_key",
            width: 150,
            render: (text: string) => (text ? "••••••••" : "-"),
        },
        {
            title: "操作",
            key: "action",
            width: 120,
            fixed: "right" as const,
            render: (_: any, record: PaymentConfig) => (
                <Space>
                    <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                        编辑
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <div className="space-y-4 p-6">
            <div className="flex justify-between items-center">
                <div className="text-sm text-slate-600">
                    💡 配置各支付网关的参数，启用后用户可在充值时选择对应的支付方式
                </div>
                <Button icon={<ReloadOutlined />} onClick={fetchConfigs}>
                    刷新
                </Button>
            </div>

            <Table
                dataSource={configs}
                columns={columns}
                rowKey="id"
                loading={loading}
                scroll={{ x: 1200 }}
                pagination={false}
                size="small"
                className="[&_.ant-table-thead>tr>th]:!bg-slate-50 [&_.ant-table-thead>tr>th]:!text-slate-700"
            />

            <Modal
                title={`编辑支付配置 - ${editingConfig?.display_name}`}
                open={editModalVisible}
                onCancel={() => setEditModalVisible(false)}
                onOk={handleSave}
                width={700}
                okText="保存"
                cancelText="取消"
            >
                <Form form={form} layout="vertical" className="mt-4">
                    <Form.Item label="显示名称" name="display_name" rules={[{ required: true, message: "请输入显示名称" }]}>
                        <Input placeholder="例如：码支付" />
                    </Form.Item>

                    <Form.Item label="API接口地址" name="api_url" rules={[{ required: true, message: "请输入API地址" }]}>
                        <Input placeholder="https://api.example.com/pay" />
                    </Form.Item>

                    <Form.Item label="回调地址" name="callback_url" rules={[{ required: true, message: "请输入回调地址" }]}>
                        <Input placeholder="http://localhost:3001/api/recharge/callback" />
                    </Form.Item>

                    <Form.Item label="同步返回地址" name="return_url">
                        <Input placeholder="支付完成后跳转的地址（可选）" />
                    </Form.Item>

                    <Form.Item label="商户ID" name="merchant_id" rules={[{ required: true, message: "请输入商户ID" }]}>
                        <Input placeholder="商户ID" />
                    </Form.Item>

                    <Form.Item label="商户密钥" name="merchant_key" rules={[{ required: true, message: "请输入商户密钥" }]}>
                        <Input.Password placeholder="商户密钥" />
                    </Form.Item>

                    <Form.Item label="应用ID" name="app_id">
                        <Input placeholder="应用ID（可选）" />
                    </Form.Item>

                    <Form.Item label="应用密钥" name="app_secret">
                        <Input.Password placeholder="应用密钥（可选）" />
                    </Form.Item>

                    <Form.Item label="启用状态" name="is_enabled" valuePropName="checked">
                        <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
