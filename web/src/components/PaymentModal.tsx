import { Modal, Tabs, QRCode, Button, message, Spin } from 'antd';
import { AlipayOutlined, WechatOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useState, useEffect, useRef } from 'react';

interface PaymentModalProps {
    visible: boolean;
    onClose: () => void;
    orderId: string;
    amount: number;
    onSuccess: () => void;
}

export default function PaymentModal({ visible, onClose, orderId, amount, onSuccess }: PaymentModalProps) {
    const [activeTab, setActiveTab] = useState<'alipay' | 'wechat'>('alipay');
    const [loading, setLoading] = useState(false);
    const [paymentData, setPaymentData] = useState<any>(null);
    const [countdown, setCountdown] = useState(300); // 5分钟倒计时
    const [polling, setPolling] = useState(false);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    // 创建支付
    const createPayment = async (payType: 'alipay' | 'wechat') => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3001/api/payment/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    order_id: orderId,
                    amount: amount,
                    pay_type: payType,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setPaymentData(data.data);
                setCountdown(Math.floor((data.data.expire_time - Date.now()) / 1000));
                startPolling();
                startCountdown();
            } else {
                message.error(data.message || '创建支付失败');
            }
        } catch (error) {
            console.error('创建支付失败:', error);
            message.error('网络错误，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    // 轮询支付状态
    const checkPaymentStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:3001/api/payment/status/${orderId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (response.ok) {
                if (data.data.status === 'completed') {
                    stopPolling();
                    stopCountdown();
                    message.success('支付成功！');
                    onSuccess();
                    onClose();
                } else if (data.data.status === 'failed') {
                    stopPolling();
                    stopCountdown();
                    message.error('支付失败');
                    onClose();
                }
            }
        } catch (error) {
            console.error('查询支付状态失败:', error);
        }
    };

    // 开始轮询
    const startPolling = () => {
        setPolling(true);
        pollingRef.current = setInterval(() => {
            checkPaymentStatus();
        }, 3000); // 每3秒查询一次
    };

    // 停止轮询
    const stopPolling = () => {
        setPolling(false);
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    // 开始倒计时
    const startCountdown = () => {
        countdownRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    stopCountdown();
                    stopPolling();
                    message.warning('支付超时，请重新下单');
                    onClose();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    // 停止倒计时
    const stopCountdown = () => {
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
    };

    // 取消订单
    const handleCancel = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:3001/api/payment/cancel/${orderId}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (response.ok) {
                message.info('订单已取消');
                onClose();
            } else {
                message.error(data.message || '取消失败');
            }
        } catch (error) {
            console.error('取消订单失败:', error);
            message.error('网络错误');
        }
    };

    // 切换支付方式
    const handleTabChange = (key: string) => {
        const payType = key as 'alipay' | 'wechat';
        setActiveTab(payType);
        if (!paymentData) {
            createPayment(payType);
        }
    };

    // 初始化
    useEffect(() => {
        if (visible && !paymentData) {
            createPayment(activeTab);
        }
    }, [visible]);

    // 清理
    useEffect(() => {
        return () => {
            stopPolling();
            stopCountdown();
        };
    }, []);

    // 关闭弹窗时清理
    const handleClose = () => {
        stopPolling();
        stopCountdown();
        setPaymentData(null);
        setCountdown(300);
        onClose();
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const tabItems = [
        {
            key: 'alipay',
            label: (
                <span className="flex items-center gap-2">
                    <AlipayOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                    支付宝
                </span>
            ),
            children: (
                <div className="flex flex-col items-center py-6">
                    {loading ? (
                        <Spin tip="正在生成支付码..." />
                    ) : paymentData ? (
                        <>
                            <div className="mb-4 rounded-lg bg-white p-4 shadow-sm border border-gray-200">
                                <QRCode value={paymentData.qr_code || paymentData.pay_url} size={200} />
                            </div>
                            <div className="text-center">
                                <div className="mb-2 text-lg font-medium">
                                    请使用支付宝扫码支付
                                </div>
                                <div className="mb-4 text-2xl font-bold text-red-500">
                                    ¥{amount}
                                </div>
                                <div className="text-sm text-gray-500">
                                    剩余时间: <span className="font-mono text-red-500">{formatTime(countdown)}</span>
                                </div>
                                {polling && (
                                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-500">
                                        <Spin size="small" />
                                        <span>等待支付中...</span>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-gray-400">加载支付信息...</div>
                    )}
                </div>
            ),
        },
        {
            key: 'wechat',
            label: (
                <span className="flex items-center gap-2">
                    <WechatOutlined style={{ fontSize: 20, color: '#07c160' }} />
                    微信支付
                </span>
            ),
            children: (
                <div className="flex flex-col items-center py-6">
                    {loading ? (
                        <Spin tip="正在生成支付码..." />
                    ) : paymentData ? (
                        <>
                            <div className="mb-4 rounded-lg bg-white p-4 shadow-sm border border-gray-200">
                                <QRCode value={paymentData.qr_code || paymentData.pay_url} size={200} />
                            </div>
                            <div className="text-center">
                                <div className="mb-2 text-lg font-medium">
                                    请使用微信扫码支付
                                </div>
                                <div className="mb-4 text-2xl font-bold text-red-500">
                                    ¥{amount}
                                </div>
                                <div className="text-sm text-gray-500">
                                    剩余时间: <span className="font-mono text-red-500">{formatTime(countdown)}</span>
                                </div>
                                {polling && (
                                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-500">
                                        <Spin size="small" />
                                        <span>等待支付中...</span>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-gray-400">加载支付信息...</div>
                    )}
                </div>
            ),
        },
    ];

    return (
        <Modal
            title={
                <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">扫码支付</span>
                    <span className="text-sm font-normal text-gray-500">订单号: {orderId}</span>
                </div>
            }
            open={visible}
            onCancel={handleClose}
            footer={
                <div className="flex justify-between">
                    <Button
                        danger
                        icon={<CloseCircleOutlined />}
                        onClick={handleCancel}
                    >
                        取消订单
                    </Button>
                    <Button onClick={handleClose}>关闭</Button>
                </div>
            }
            width={500}
            centered
        >
            <Tabs
                activeKey={activeTab}
                onChange={handleTabChange}
                items={tabItems}
                centered
            />

            <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-600">
                💡 提示: 扫码后请在手机上完成支付，支付成功后会自动跳转
            </div>
        </Modal>
    );
}
