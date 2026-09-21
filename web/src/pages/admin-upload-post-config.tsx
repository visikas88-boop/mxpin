// =====================================================
// Upload-Post配置管理页面
// 路径: web/src/pages/admin-upload-post-config.tsx
// 说明: 管理员配置Upload-Post API Key
// =====================================================

import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Space, message, Alert, Tag, Divider, Row, Col, Statistic } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, ApiOutlined, KeyOutlined, LinkOutlined, SaveOutlined, UserOutlined } from '@ant-design/icons';

interface UploadPostConfig {
    id?: number;
    api_base_url: string;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
    plan?: string;
    max_profiles?: number;
}

interface VerifyResult {
    valid: boolean;
    plan?: string;
    max_profiles?: number;
    error?: string;
}

export default function AdminUploadPostConfigPage() {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [config, setConfig] = useState<UploadPostConfig | null>(null);
    const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

    useEffect(() => {
        loadConfig();
    }, []);

    async function loadConfig() {
        try {
            const res = await fetch('/api/admin/upload-post/config', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                }
            });
            const data = await res.json();
            if (data.success && data.data) {
                setConfig(data.data);
                form.setFieldsValue({
                    api_base_url: data.data.api_base_url
                });
            }
        } catch (error) {
            console.error('Load config error:', error);
        }
    }

    async function handleTest() {
        try {
            const apiKey = form.getFieldValue('api_key');
            if (!apiKey) {
                message.warning('请先输入API Key');
                return;
            }

            setTesting(true);
            setVerifyResult(null);

            const res = await fetch('/api/admin/upload-post/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                },
                body: JSON.stringify({
                    api_key: apiKey
                })
            });

            const data = await res.json();

            if (data.success) {
                setVerifyResult({
                    valid: true,
                    plan: data.data.plan,
                    max_profiles: data.data.max_profiles
                });
                message.success('API Key验证成功');
            } else {
                setVerifyResult({
                    valid: false,
                    error: data.message || '验证失败'
                });
                message.error(data.message || 'API Key验证失败');
            }
        } catch (error: any) {
            console.error('Verify error:', error);
            setVerifyResult({
                valid: false,
                error: error.message || '网络错误'
            });
            message.error('验证失败');
        } finally {
            setTesting(false);
        }
    }

    async function handleSave() {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const res = await fetch('/api/admin/upload-post/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                },
                body: JSON.stringify(values)
            });

            const data = await res.json();

            if (data.success) {
                message.success('配置已保存');
                loadConfig();
                // 保存后自动验证
                await handleTest();
            } else {
                message.error(data.message);
            }
        } catch (error: any) {
            console.error('Save config error:', error);
            message.error('保存失败');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50 p-6">
            <div className="w-full px-6">
                {/* 当前配置状态卡片 */}
                {config && (
                    <div className="mb-4">
                        <h3 className="mb-3 text-base font-semibold text-gray-700 flex items-center gap-2">
                            <ApiOutlined className="text-blue-600" />
                            当前配置状态
                        </h3>
                        <div className="grid gap-3 md:grid-cols-4">
                            <div className="rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-white p-4 shadow-sm">
                                <div className="text-xs text-green-600 font-medium">状态</div>
                                <div className="mt-1 text-2xl font-bold text-green-700">已启用</div>
                                <div className="mt-1 text-xs text-gray-500">配置正常运行中</div>
                            </div>
                            {config.plan && (
                                <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
                                    <div className="text-xs text-blue-600 font-medium">订阅计划</div>
                                    <div className="mt-1 text-xl font-bold text-blue-700">{config.plan}</div>
                                    <div className="mt-1 text-xs text-gray-500">当前套餐</div>
                                </div>
                            )}
                            {config.max_profiles && (
                                <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-4 shadow-sm">
                                    <div className="text-xs text-purple-600 font-medium">Profile配额</div>
                                    <div className="mt-1 text-2xl font-bold text-purple-700">{config.max_profiles}</div>
                                    <div className="mt-1 text-xs text-gray-500">个可用Profile</div>
                                </div>
                            )}
                            <div className="rounded-lg border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-4 shadow-sm">
                                <div className="text-xs text-cyan-600 font-medium">配置时间</div>
                                <div className="mt-1 text-base font-bold text-cyan-700">
                                    {config.updated_at ? new Date(config.updated_at).toLocaleDateString('zh-CN') : '-'}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">最后更新</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 配置表单卡片 */}
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <ApiOutlined className="text-2xl text-blue-600" />
                            <div>
                                <h2 className="text-xl font-bold m-0">Upload-Post API配置</h2>
                                <p className="text-gray-500 text-xs m-0 mt-1">配置多平台视频发布服务</p>
                            </div>
                        </div>
                        {config && (
                            <Tag color="green" icon={<CheckCircleFilled />} className="text-sm px-3 py-0.5">
                                已配置
                            </Tag>
                        )}
                    </div>

                {/* 说明信息 */}
                <Alert
                    type="info"
                    showIcon
                    message="获取API Key步骤"
                    description={
                        <div className="text-sm">
                            <span className="mr-2">1. 访问 <a href="https://app.upload-post.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">app.upload-post.com</a></span>
                            <span className="mr-2">2. 登录账号 → Settings → API Keys</span>
                            <span className="mr-2">3. 点击"Generate New API Key"</span>
                            <span>4. 复制API Key并粘贴到下方</span>
                        </div>
                    }
                    className="mb-4"
                    style={{ backgroundColor: 'white', borderColor: '#cbd5e1' }}
                />

                {/* 当前配置状态 */}
                {config && (
                    <Card type="inner" className="mb-4 bg-blue-50 border-blue-200" bodyStyle={{ padding: '12px 16px' }}>
                        <Row gutter={[16, 8]}>
                            <Col span={6}>
                                <Statistic
                                    title="状态"
                                    value={config.is_active ? "已启用" : "已禁用"}
                                    valueStyle={{ color: config.is_active ? '#52c41a' : '#ff4d4f', fontSize: '16px' }}
                                    prefix={config.is_active ? <CheckCircleFilled /> : <CloseCircleFilled />}
                                />
                            </Col>
                            {config.plan && (
                                <>
                                    <Col span={6}>
                                        <Statistic
                                            title="订阅计划"
                                            value={config.plan}
                                            valueStyle={{ color: '#1890ff', fontSize: '16px' }}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Profile配额"
                                            value={config.max_profiles || '-'}
                                            suffix="个"
                                            valueStyle={{ color: '#1890ff', fontSize: '16px' }}
                                            prefix={<UserOutlined />}
                                        />
                                    </Col>
                                </>
                            )}
                            <Col span={6}>
                                <Statistic
                                    title="配置时间"
                                    value={config.updated_at ? new Date(config.updated_at).toLocaleDateString('zh-CN') : '-'}
                                    valueStyle={{ fontSize: '14px' }}
                                />
                            </Col>
                        </Row>
                    </Card>
                )}

                {/* 表单 */}
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        api_base_url: 'https://api.upload-post.com/api'
                    }}
                    className="[&_.ant-form-item]:mb-3"
                >
                    <Form.Item
                        label={
                            <span className="font-medium text-sm">
                                <KeyOutlined style={{ color: '#1890ff' }} /> API Key
                            </span>
                        }
                        name="api_key"
                        rules={[
                            { required: true, message: '请输入API Key' },
                            { min: 20, message: 'API Key长度不能少于20个字符' }
                        ]}
                    >
                        <Input.Password
                            placeholder="sk_live_xxxxxxxxxxxxx"
                            prefix={<KeyOutlined />}
                        />
                    </Form.Item>

                    <Form.Item
                        label={
                            <span className="font-medium text-sm">
                                <LinkOutlined style={{ color: '#1890ff' }} /> API Base URL
                            </span>
                        }
                        name="api_base_url"
                        rules={[
                            { required: true, message: '请输入API地址' },
                            { type: 'url', message: '请输入有效的URL' }
                        ]}
                    >
                        <Input prefix={<LinkOutlined />} />
                    </Form.Item>

                    {/* 验证结果显示 */}
                    {verifyResult && (
                        <Alert
                            type={verifyResult.valid ? 'success' : 'error'}
                            message={verifyResult.valid ? 'API Key有效' : 'API Key无效'}
                            description={verifyResult.valid ? (
                                <div className="space-y-1">
                                    <p className="mb-1">✅ 验证成功！</p>
                                    {verifyResult.plan && <p className="mb-1">订阅计划: <Tag color="blue">{verifyResult.plan}</Tag></p>}
                                    {verifyResult.max_profiles && <p className="mb-0">Profile配额: <strong>{verifyResult.max_profiles}</strong> 个</p>}
                                </div>
                            ) : (
                                <div>❌ {verifyResult.error}</div>
                            )}
                            showIcon
                            className="mb-3"
                        />
                    )}

                    {/* 按钮组 */}
                    <Space size="middle">
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={handleSave}
                            loading={loading}
                        >
                            保存配置
                        </Button>
                        <Button
                            icon={<ApiOutlined />}
                            onClick={handleTest}
                            loading={testing}
                        >
                            验证API Key
                        </Button>
                    </Space>
                </Form>

                {/* 底部说明 */}
                <Divider className="my-4" />
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg">
                    <h3 className="font-semibold mb-2 text-sm text-gray-800">💡 配置完成后的功能</h3>
                    <Row gutter={[16, 8]}>
                        <Col span={12}>
                            <div className="text-xs">✅ Instagram、TikTok、YouTube视频发布</div>
                        </Col>
                        <Col span={12}>
                            <div className="text-xs">✅ 一键发布到多个平台</div>
                        </Col>
                        <Col span={12}>
                            <div className="text-xs">✅ 查看发布状态和统计</div>
                        </Col>
                        <Col span={12}>
                            <div className="text-xs">✅ 根据订阅套餐限制Profile数量</div>
                        </Col>
                    </Row>
                </div>

                <Alert
                    message="成本参考（按汇率1:7计算）"
                    description={
                        <div className="space-y-1 text-xs">
                            <Row gutter={[16, 4]}>
                                <Col span={12}>
                                    <div>• <strong>Basic</strong>: $24/月 (¥168) - 5 profiles</div>
                                </Col>
                                <Col span={12}>
                                    <div>• <strong>Professional</strong>: $50/月 (¥350) - 25 profiles</div>
                                </Col>
                                <Col span={12}>
                                    <div>• <strong>Advanced</strong>: $147/月 (¥1029) - 75 profiles</div>
                                </Col>
                                <Col span={12}>
                                    <div>• <strong>Business</strong>: $438/月 (¥3066) - 225 profiles</div>
                                </Col>
                            </Row>
                            <p className="text-orange-600 mt-2 mb-0 font-medium text-xs">
                                💡 建议根据系统用户数和套餐设计选择合适的Upload-Post订阅
                            </p>
                        </div>
                    }
                    type="warning"
                    showIcon
                    className="mt-4"
                />
                </div>
            </div>

            <style>{`
                .admin-layout .ant-alert-info,
                .admin-layout .ant-alert-warning {
                    background-color: white !important;
                    border-color: #cbd5e1 !important;
                }
            `}</style>
        </div>
    );
}
