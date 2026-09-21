import { useEffect, useState } from "react";
import { Card, Form, InputNumber, Button, message, Divider, Table, Modal, Input, Select, Space } from "antd";
import { SaveOutlined, ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";

interface SystemSettings {
    points_exchange_rate: {
        value: number;
        desc: string;
    };
}

interface RechargePackage {
    id: number;
    package_name: string;
    price: number;
    points_calc_mode: string;
    gift_percent: number;
    manual_base_points: number;
    manual_gift_points: number;
    base_points: number;
    gift_points: number;
    total_points: number;
}

export default function PointsSettingsPage() {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [packages, setPackages] = useState<RechargePackage[]>([]);
    const [previewModalVisible, setPreviewModalVisible] = useState(false);
    const [previewRate, setPreviewRate] = useState<number>(10);

    useEffect(() => {
        fetchSettings();
        fetchPackagesPreview();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("admin_token");
            const response = await fetch("http://localhost:3001/api/recharge/settings", {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();
            if (response.ok) {
                setSettings(data.data);
                form.setFieldsValue({
                    exchangeRate: data.data.points_exchange_rate.value,
                });
            } else {
                message.error(data.message || "获取设置失败");
            }
        } catch (error) {
            message.error("网络错误");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPackagesPreview = async (rate?: number) => {
        try {
            const token = localStorage.getItem("admin_token");
            const response = await fetch("http://localhost:3001/api/recharge/packages", {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();
            if (response.ok) {
                const allPackages: RechargePackage[] = [];
                data.data.packageGroups.forEach((group: any) => {
                    allPackages.push(...group.packages);
                });
                setPackages(allPackages);

                // 如果提供了rate，预览新比例下的积分
                if (rate && rate !== data.data.systemConfig.exchangeRate) {
                    const previewPackages = allPackages.map(pkg => {
                        if (pkg.points_calc_mode === 'auto') {
                            const basePoints = Math.floor(pkg.price * rate);
                            const giftPoints = Math.floor(basePoints * (pkg.gift_percent / 100));
                            return {
                                ...pkg,
                                base_points: basePoints,
                                gift_points: giftPoints,
                                total_points: basePoints + giftPoints
                            };
                        }
                        return pkg;
                    });
                    setPackages(previewPackages);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleSave = async (values: any) => {
        setSaveLoading(true);
        try {
            const token = localStorage.getItem("admin_token");
            const response = await fetch("http://localhost:3001/api/recharge/settings/exchange-rate", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    rate: values.exchangeRate,
                }),
            });

            const data = await response.json();
            if (response.ok) {
                message.success(data.message || "积分比例更新成功");
                fetchSettings();
                fetchPackagesPreview();
            } else {
                message.error(data.message || "更新失败");
            }
        } catch (error) {
            message.error("网络错误");
            console.error(error);
        } finally {
            setSaveLoading(false);
        }
    };

    const handlePreview = () => {
        const rate = form.getFieldValue("exchangeRate");
        if (!rate || rate <= 0) {
            message.warning("请输入有效的积分比例");
            return;
        }
        setPreviewRate(rate);
        fetchPackagesPreview(rate);
        setPreviewModalVisible(true);
    };

    const columns = [
        {
            title: "套餐名称",
            dataIndex: "package_name",
            key: "package_name",
            width: 150,
        },
        {
            title: "价格",
            dataIndex: "price",
            key: "price",
            width: 100,
            render: (price: number) => `¥${price.toFixed(2)}`,
        },
        {
            title: "计算模式",
            dataIndex: "points_calc_mode",
            key: "points_calc_mode",
            width: 100,
            render: (mode: string) => (
                <span className={mode === 'auto' ? 'text-blue-600' : 'text-purple-600'}>
                    {mode === 'auto' ? '自动计算' : '手动设置'}
                </span>
            ),
        },
        {
            title: "基础积分",
            dataIndex: "base_points",
            key: "base_points",
            width: 100,
            render: (points: number) => points.toLocaleString(),
        },
        {
            title: "赠送积分",
            dataIndex: "gift_points",
            key: "gift_points",
            width: 100,
            render: (points: number) => (
                <span className="text-orange-600">+{points.toLocaleString()}</span>
            ),
        },
        {
            title: "总积分",
            dataIndex: "total_points",
            key: "total_points",
            width: 100,
            render: (points: number) => (
                <span className="font-semibold text-purple-600">{points.toLocaleString()}</span>
            ),
        },
        {
            title: "赠送比例",
            dataIndex: "gift_percent",
            key: "gift_percent",
            width: 100,
            render: (percent: number, record: RechargePackage) => (
                record.points_calc_mode === 'auto' && percent > 0 ? `+${percent}%` : '-'
            ),
        },
    ];

    return (
        <div className="space-y-6 p-6">
            {/* 顶部标题 */}
            <div>
                <h2 className="text-2xl font-semibold text-slate-800">积分设置</h2>
                <p className="mt-1 text-sm text-slate-500">配置积分兑换比例，调整后所有自动计算的套餐积分会实时更新</p>
            </div>

            {/* 积分比例设置 */}
            <Card title="💰 积分兑换比例" className="shadow-sm">
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                    initialValues={{ exchangeRate: 10 }}
                >
                    <div className="max-w-md">
                        <Form.Item
                            label={
                                <span className="text-base font-medium">
                                    1元人民币兑换多少积分
                                </span>
                            }
                            name="exchangeRate"
                            rules={[
                                { required: true, message: "请输入积分比例" },
                                { type: "number", min: 1, max: 1000, message: "比例必须在1-1000之间" },
                            ]}
                            extra="例如：输入10表示1元=10积分，输入11表示1元=11积分"
                        >
                            <InputNumber
                                min={1}
                                max={1000}
                                precision={0}
                                style={{ width: "100%" }}
                                size="large"
                                addonBefore="1 元 ="
                                addonAfter="积分"
                            />
                        </Form.Item>

                        <div className="mb-4 rounded-lg bg-blue-50 p-4 dark:bg-blue-950/30">
                            <div className="text-sm text-blue-600 dark:text-blue-400">
                                <strong>💡 说明：</strong>
                                <ul className="mt-2 space-y-1 pl-4">
                                    <li>• 调整比例后，所有使用"自动计算"模式的套餐积分会实时更新</li>
                                    <li>• 使用"手动设置"模式的套餐不受影响</li>
                                    <li>• 建议在调整前先点击"预览效果"查看变化</li>
                                </ul>
                            </div>
                        </div>

                        <Space>
                            <Button
                                type="primary"
                                htmlType="submit"
                                icon={<SaveOutlined />}
                                loading={saveLoading}
                                size="large"
                            >
                                保存设置
                            </Button>
                            <Button
                                type="default"
                                onClick={handlePreview}
                                size="large"
                            >
                                预览效果
                            </Button>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={fetchSettings}
                                size="large"
                            >
                                重置
                            </Button>
                        </Space>
                    </div>
                </Form>
            </Card>

            {/* 当前套餐列表 */}
            <Card
                title="📦 当前套餐积分预览"
                extra={
                    settings && (
                        <span className="text-sm text-slate-500">
                            当前比例：1元 = {settings.points_exchange_rate.value} 积分
                        </span>
                    )
                }
                className="shadow-sm"
            >
                <Table
                    dataSource={packages}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    className="[&_.ant-table-thead>tr>th]:!bg-slate-50 [&_.ant-table-thead>tr>th]:!text-slate-700"
                />
            </Card>

            {/* 预览模态框 */}
            <Modal
                title={`预览积分变化（比例：1元 = ${previewRate} 积分）`}
                open={previewModalVisible}
                onCancel={() => setPreviewModalVisible(false)}
                footer={null}
                width={900}
            >
                <div className="space-y-4">
                    <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/30">
                        <p className="text-sm text-yellow-700 dark:text-yellow-400">
                            <strong>注意：</strong>以下为调整比例后的预览效果，仅"自动计算"模式的套餐会发生变化。
                        </p>
                    </div>

                    <Table
                        dataSource={packages}
                        columns={columns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                    />
                </div>
            </Modal>
        </div>
    );
}
