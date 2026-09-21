import { useEffect, useState } from "react";
import { apiFetch } from "@/utils/api-config";
import { Table, Button, Space, Tag, Modal, Form, Input, Select, InputNumber, Switch, message, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined, CheckCircleOutlined } from "@ant-design/icons";

const { Search } = Input;

interface Model {
    id: number;
    model_type: string;
    model_name: string;
    model_key: string;
    provider: string;
    description: string;
    api_base_url: string;
    api_format: string;
    points_cost: number;
    billing_type: string;
    is_enabled: boolean;
    sort_order: number;
    created_at: string;
    test_status?: "success" | "error" | "testing";
    test_message?: string;
}

export default function ModelManagementPage() {
    const [models, setModels] = useState<Model[]>([]);
    const [filteredModels, setFilteredModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingModel, setEditingModel] = useState<Model | null>(null);
    const [filterType, setFilterType] = useState<string>("all");
    const [searchText, setSearchText] = useState<string>("");
    const [form] = Form.useForm();

    useEffect(() => {
        fetchModels();
    }, []);

    useEffect(() => {
        filterModels();
    }, [models, filterType, searchText]);

    const fetchModels = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("admin_token");
            const response = await apiFetch("/models", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();
            if (response.ok) {
                setModels(data.data.models);
            } else {
                message.error(data.message || "获取模型列表失败");
            }
        } catch (error) {
            message.error("网络错误");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const filterModels = () => {
        let filtered = models;

        // 按类型筛选
        if (filterType !== "all") {
            filtered = filtered.filter((m) => m.model_type === filterType);
        }

        // 按关键词搜索
        if (searchText) {
            const keyword = searchText.toLowerCase();
            filtered = filtered.filter(
                (m) =>
                    m.model_name.toLowerCase().includes(keyword) ||
                    m.model_key.toLowerCase().includes(keyword) ||
                    m.provider.toLowerCase().includes(keyword)
            );
        }

        setFilteredModels(filtered);
    };

    const handleAdd = () => {
        setEditingModel(null);
        setTimeout(() => {
            form.resetFields();
            form.setFieldsValue({
                modelType: "video",
                apiFormat: "openai",
                pointsCost: 10,
                billingType: "per_request",
                isEnabled: true,
                sortOrder: 0,
            });
            setModalVisible(true);
        }, 50);
    };

    const handleEdit = (model: Model) => {
        setEditingModel(model);
        form.setFieldsValue({
            modelType: model.model_type,
            modelName: model.model_name,
            modelKey: model.model_key,
            provider: model.provider,
            description: model.description,
            apiBaseUrl: model.api_base_url,
            apiFormat: model.api_format,
            pointsCost: model.points_cost,
            billingType: model.billing_type,
            sortOrder: model.sort_order,
            isEnabled: model.is_enabled,
            apiKey: "", // 不显示原密钥
        });
        setModalVisible(true);
    };

    const handleDisable = async (id: number) => {
        try {
            const token = localStorage.getItem("admin_token");
            const response = await apiFetch(`/models/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();
            if (response.ok) {
                message.success("模型已停用");
                fetchModels();
            } else {
                message.error(data.message || "操作失败");
            }
        } catch (error) {
            message.error("网络错误");
            console.error(error);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            const token = localStorage.getItem("admin_token");
            const response = await apiFetch(`/models/${id}/permanent`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();
            if (response.ok) {
                message.success("模型已永久删除");
                fetchModels();
            } else {
                message.error(data.message || "操作失败");
            }
        } catch (error) {
            message.error("网络错误");
            console.error(error);
        }
    };

    const handleTestModel = async (id: number) => {
        try {
            // 更新测试状态
            setModels((prev) =>
                prev.map((m) => (m.id === id ? { ...m, test_status: "testing" as const, test_message: "测试中..." } : m))
            );

            const token = localStorage.getItem("admin_token");
            const response = await apiFetch(`/models/${id}/test`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();

            // 更新测试结果
            setModels((prev) =>
                prev.map((m) =>
                    m.id === id
                        ? {
                              ...m,
                              test_status: data.success ? ("success" as const) : ("error" as const),
                              test_message: data.message || (data.success ? "连接成功" : "连接失败"),
                          }
                        : m
                )
            );

            if (data.success) {
                message.success(`${data.modelName || "模型"} 测试成功`);
            } else {
                message.error(`${data.modelName || "模型"} 测试失败：${data.message}`);
            }
        } catch (error) {
            setModels((prev) =>
                prev.map((m) => (m.id === id ? { ...m, test_status: "error" as const, test_message: "网络错误" } : m))
            );
            message.error("测试失败：网络错误");
            console.error(error);
        }
    };

    const handleTestAll = async () => {
        setTesting(true);
        message.info("开始测试所有模型...");

        for (const model of filteredModels) {
            await handleTestModel(model.id);
            // 延迟避免请求过快
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        setTesting(false);
        message.success("所有模型测试完成");
    };

    const handleSubmit = async (values: any) => {
        try {
            const token = localStorage.getItem("admin_token");
            const url = editingModel
                ? `http://localhost:3001/api/models/${editingModel.id}`
                : "http://localhost:3001/api/models";

            const method = editingModel ? "PUT" : "POST";

            // 如果是编辑且未输入新密钥，则不传apiKey
            const payload = { ...values };
            if (editingModel && !values.apiKey) {
                delete payload.apiKey;
            }

            // API Base URL 自动补全
            if (payload.apiBaseUrl) {
                const baseUrl = payload.apiBaseUrl.trim();
                // 如果是中转站URL且没有加路径，自动补全
                if (!baseUrl.includes('/v1') && !baseUrl.includes('/api')) {
                    payload.apiBaseUrl = baseUrl.endsWith('/') ? `${baseUrl}v1` : `${baseUrl}/v1`;
                }
            }

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (response.ok) {
                message.success(editingModel ? "模型更新成功" : "模型创建成功");
                setModalVisible(false);
                setTimeout(() => setEditingModel(null), 300);
                fetchModels();
            } else {
                // 更友好的错误提示
                let errorMsg = data.message || "操作失败";
                if (errorMsg.includes("重复键") || errorMsg.includes("unique")) {
                    errorMsg = "模型标识已存在，请使用不同的标识";
                }
                message.error(errorMsg);
            }
        } catch (error) {
            message.error("网络错误");
            console.error(error);
        }
    };

    const columns = [
        {
            title: "类型",
            dataIndex: "model_type",
            key: "model_type",
            width: 80,
            render: (type: string) => (
                <Tag color={type === "video" ? "blue" : "green"}>
                    {type === "video" ? "视频" : "图片"}
                </Tag>
            ),
        },
        {
            title: "模型名称",
            dataIndex: "model_name",
            key: "model_name",
            width: 150,
            ellipsis: true,
        },
        {
            title: "模型标识",
            dataIndex: "model_key",
            key: "model_key",
            width: 150,
            ellipsis: true,
            render: (text: string) => (
                <span className="font-mono text-xs text-gray-600">{text}</span>
            ),
        },
        {
            title: "提供商",
            dataIndex: "provider",
            key: "provider",
            width: 100,
        },
        {
            title: "说明",
            dataIndex: "description",
            key: "description",
            width: 200,
            ellipsis: true,
            render: (text: string) => (
                <span className="text-sm text-gray-600">{text}</span>
            ),
        },
        {
            title: "计费",
            key: "billing",
            width: 120,
            render: (record: Model) => (
                <div>
                    <Tag color={record.billing_type === "per_request" ? "orange" : "purple"}>
                        {record.billing_type === "per_request" ? "按次" : "按秒"}
                    </Tag>
                    <div className="mt-1 text-xs font-semibold text-orange-600">
                        {record.points_cost} {record.billing_type === "per_request" ? "积分/次" : "积分/秒"}
                    </div>
                </div>
            ),
        },
        {
            title: "排序",
            dataIndex: "sort_order",
            key: "sort_order",
            width: 60,
            align: "center" as const,
        },
        {
            title: "状态",
            key: "status",
            width: 120,
            render: (record: Model) => (
                <div>
                    <Tag color={record.is_enabled ? "success" : "default"}>
                        {record.is_enabled ? "启用" : "停用"}
                    </Tag>
                    {record.test_status && (
                        <div className="mt-1">
                            {record.test_status === "testing" && (
                                <Tag color="processing" className="text-xs">测试中</Tag>
                            )}
                            {record.test_status === "success" && (
                                <Tag color="success" className="text-xs">✓ 连通</Tag>
                            )}
                            {record.test_status === "error" && (
                                <Tag color="error" className="text-xs">✗ 失败</Tag>
                            )}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: "操作",
            key: "action",
            width: 200,
            fixed: "right" as const,
            render: (_: any, record: Model) => (
                <Space size="small">
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    >
                        编辑
                    </Button>
                    <Button
                        type="link"
                        size="small"
                        onClick={() => handleTestModel(record.id)}
                        loading={record.test_status === "testing"}
                        className="!text-blue-500"
                    >
                        测试
                    </Button>
                    {record.is_enabled ? (
                        <Popconfirm
                            title="确定要停用此模型吗？"
                            description="停用后用户将无法使用此模型"
                            onConfirm={() => handleDisable(record.id)}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Button type="link" size="small" className="!text-orange-500">
                                停用
                            </Button>
                        </Popconfirm>
                    ) : (
                        <span className="text-xs text-slate-400">已停用</span>
                    )}
                    <Popconfirm
                        title="确定要永久删除此模型吗？"
                        description="删除后将无法恢复，且需保证该类型至少保留一个模型"
                        onConfirm={() => handleDelete(record.id)}
                        okText="确定删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                    >
                        <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="min-h-full bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50 space-y-6 p-6">
            {/* 筛选和搜索栏 */}
            <div className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm border border-gray-200">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">模型类型:</span>
                    <Select
                        value={filterType}
                        onChange={setFilterType}
                        style={{ width: 120 }}
                    >
                        <Select.Option value="all">全部</Select.Option>
                        <Select.Option value="video">视频模型</Select.Option>
                        <Select.Option value="image">图片模型</Select.Option>
                    </Select>
                </div>
                <Search
                    placeholder="搜索模型名称、标识或提供商"
                    allowClear
                    style={{ width: 300 }}
                    onSearch={setSearchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    prefix={<SearchOutlined />}
                />
                <div className="flex-1" />
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={fetchModels} className="!border-slate-300 hover:!border-slate-400">
                        刷新
                    </Button>
                    <Button icon={<PlusOutlined />} onClick={handleAdd} className="!border-slate-300 hover:!border-slate-400">
                        添加模型
                    </Button>
                    <Button
                        icon={<CheckCircleOutlined />}
                        onClick={handleTestAll}
                        loading={testing}
                        disabled={models.length === 0}
                        className="!border-slate-300 hover:!border-slate-400"
                    >
                        {testing ? "测试中..." : "测试全部"}
                    </Button>
                </Space>
                <div className="text-sm text-gray-500">
                    共 {filteredModels.length} 个模型
                </div>
            </div>

            {/* 表格 */}
            <div className="rounded-lg bg-white shadow-sm border border-gray-200 overflow-hidden">
                <Table
                    dataSource={filteredModels}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        pageSize: 20,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条`,
                    }}
                    className="[&_.ant-table-thead>tr>th]:!bg-gray-50 [&_.ant-table-thead>tr>th]:!text-gray-700 [&_.ant-table-thead>tr>th]:!font-semibold [&_.ant-table-tbody>tr:hover>td]:!bg-gray-50"
                />
            </div>

            <style>{`
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

            {/* 编辑模态框 */}
            <Modal
                title={editingModel ? "编辑模型" : "添加模型"}
                open={modalVisible}
                onCancel={() => {
                    setModalVisible(false);
                    setTimeout(() => setEditingModel(null), 300);
                }}
                onOk={() => form.submit()}
                width={700}
                okText="保存"
                cancelText="取消"
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{
                        modelType: "video",
                        apiFormat: "openai",
                        pointsCost: 10,
                        billingType: "per_request",
                        isEnabled: true,
                        sortOrder: 0,
                    }}
                >
                    <Form.Item
                        label="模型类型"
                        name="modelType"
                        rules={[{ required: true, message: "请选择模型类型" }]}
                    >
                        <Select disabled={!!editingModel}>
                            <Select.Option value="video">视频模型</Select.Option>
                            <Select.Option value="image">图片模型</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="模型名称"
                        name="modelName"
                        rules={[{ required: true, message: "请输入模型名称" }]}
                    >
                        <Input placeholder="例如：MiniMax H3" />
                    </Form.Item>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            label="模型标识"
                            name="modelKey"
                            rules={[{ required: true, message: "请输入模型标识" }]}
                            tooltip="用于API调用的模型ID，创建后不可修改"
                        >
                            <Input
                                placeholder="例如：minimax-h3"
                                disabled={!!editingModel}
                                className={editingModel ? "!cursor-not-allowed" : ""}
                            />
                        </Form.Item>

                        <Form.Item
                            label="提供商"
                            name="provider"
                            rules={[{ required: true, message: "请输入提供商" }]}
                        >
                            <Input placeholder="例如：MiniMax" />
                        </Form.Item>
                    </div>

                    <Form.Item
                        label="模型说明"
                        name="description"
                        tooltip="将显示在前端模型选择下拉菜单中"
                    >
                        <Input.TextArea rows={2} placeholder="模型功能说明，显示在前端下拉菜单" />
                    </Form.Item>

                    <Form.Item
                        label="API Base URL"
                        name="apiBaseUrl"
                        rules={[{ required: true, message: "请输入API地址" }]}
                    >
                        <Input placeholder="https://api.example.com/v1" />
                    </Form.Item>

                    <Form.Item
                        label="API Key"
                        name="apiKey"
                        rules={editingModel ? [] : [{ required: true, message: "请输入API密钥" }]}
                        tooltip={editingModel ? "留空表示不修改密钥" : ""}
                    >
                        <Input.Password placeholder={editingModel ? "留空表示不修改" : "输入API密钥"} />
                    </Form.Item>

                    <Form.Item label="API格式" name="apiFormat">
                        <Select>
                            <Select.Option value="openai">OpenAI格式</Select.Option>
                            <Select.Option value="custom">自定义格式</Select.Option>
                        </Select>
                    </Form.Item>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            label="计费类型"
                            name="billingType"
                            rules={[{ required: true, message: "请选择计费类型" }]}
                        >
                            <Select>
                                <Select.Option value="per_request">按次收费</Select.Option>
                                <Select.Option value="per_second">按秒收费</Select.Option>
                            </Select>
                        </Form.Item>

                        <Form.Item
                            label="单价（积分）"
                            name="pointsCost"
                            rules={[{ required: true, message: "请输入单价" }]}
                        >
                            <InputNumber min={1} style={{ width: "100%" }} />
                        </Form.Item>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item label="排序" name="sortOrder" tooltip="数字越小越靠前">
                            <InputNumber min={0} style={{ width: "100%" }} />
                        </Form.Item>

                        <Form.Item label="启用状态" name="isEnabled" valuePropName="checked">
                            <Switch checkedChildren="启用" unCheckedChildren="停用" />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}
