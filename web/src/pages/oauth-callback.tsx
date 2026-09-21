// =====================================================
import { apiFetch } from "@/utils/api-config";
// OAuth回调处理页面
// 路径: web/src/pages/oauth-callback.tsx
// 说明: 处理社交平台OAuth授权回调
// =====================================================

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, Result, Button } from 'antd';
import { LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

export default function OAuthCallbackPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('正在验证授权...');

    useEffect(() => {
        handleCallback();
    }, []);

    const handleCallback = async () => {
        try {
            // 从URL获取参数
            const code = searchParams.get('code');
            const state = searchParams.get('state');
            const platform = searchParams.get('platform');
            const error = searchParams.get('error');
            const errorDescription = searchParams.get('error_description');

            // 检查是否有错误
            if (error) {
                setStatus('error');
                setMessage(errorDescription || `授权失败: ${error}`);
                return;
            }

            // 验证必需参数
            if (!code || !state || !platform) {
                setStatus('error');
                setMessage('缺少必需的授权参数');
                return;
            }

            // 调用后端API验证连接
            const token = localStorage.getItem('token');
            const response = await apiFetch('/social-accounts/verify-connection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    platform,
                    code,
                    state
                })
            });

            const data = await response.json();

            if (response.ok) {
                setStatus('success');
                setMessage(`成功连接 ${data.data.platform_display_name || platform} 账号！`);

                // 3秒后跳转到社交账号管理页面
                setTimeout(() => {
                    navigate('/social-accounts');
                }, 3000);
            } else {
                setStatus('error');
                setMessage(data.message || '连接失败，请重试');
            }
        } catch (error) {
            console.error('OAuth callback error:', error);
            setStatus('error');
            setMessage('网络错误，请检查连接后重试');
        }
    };

    const handleRetry = () => {
        navigate('/social-accounts');
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50/20 to-slate-50">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
                {status === 'loading' && (
                    <div className="text-center">
                        <Spin
                            indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
                            size="large"
                        />
                        <h2 className="mt-6 text-xl font-semibold text-gray-900">{message}</h2>
                        <p className="mt-2 text-sm text-gray-500">请稍候，正在处理授权信息...</p>
                    </div>
                )}

                {status === 'success' && (
                    <Result
                        icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                        title="授权成功！"
                        subTitle={message}
                        extra={
                            <Button type="primary" onClick={() => navigate('/social-accounts')}>
                                查看账号管理
                            </Button>
                        }
                    />
                )}

                {status === 'error' && (
                    <Result
                        icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                        title="授权失败"
                        subTitle={message}
                        extra={[
                            <Button type="primary" onClick={handleRetry} key="retry">
                                返回重试
                            </Button>,
                            <Button onClick={() => navigate('/')} key="home">
                                返回首页
                            </Button>
                        ]}
                    />
                )}
            </div>
        </div>
    );
}
