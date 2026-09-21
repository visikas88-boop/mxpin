import { useState, useEffect } from 'react';
import { Card, Button, Tag, message, Spin, Modal } from 'antd';
import { ThunderboltOutlined, FireOutlined, CrownOutlined } from '@ant-design/icons';
import PaymentModal from '@/components/PaymentModal';

interface Package {
    id: number;
    packageName: string;
    price: number;
    originalPrice?: number;
    totalPoints: number;
    basePoints: number;
    giftPoints: number;
    giftPercent: number;
    validType: string;
    validDays?: number;
    description?: string;
    isHot: boolean;
}

interface PackageGroup {
    groupId: string;
    groupName: string;
    groupType: string;
    packages: Package[];
}

export default function RechargePage() {
    const [loading, setLoading] = useState(false);
    const [packageGroups, setPackageGroups] = useState<PackageGroup[]>([]);
    const [userInfo, setUserInfo] = useState<any>(null);
    const [paymentVisible, setPaymentVisible] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<{ orderId: string; amount: number } | null>(null);

    // 获取套餐列表
    const fetchPackages = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers: HeadersInit = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch('http://localhost:3001/api/recharge/packages', {
                headers,
            });

            const data = await response.json();

            if (response.ok) {
                setPackageGroups(data.data.packageGroups);
                setUserInfo(data.data.userInfo);
            } else {
                message.error(data.message || '获取套餐列表失败');
            }
        } catch (error) {
            console.error('获取套餐失败:', error);
            message.error('网络错误');
        } finally {
            setLoading(false);
        }
    };

    // 创建订单并发起支付
    const handleRecharge = async (pkg: Package) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                message.warning('请先登录后再进行充值');
                window.location.href = '/login';
                return;
            }

            // 1. 创建订单
            const orderResponse = await fetch('http://localhost:3001/api/recharge/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    packageId: pkg.id,
                }),
            });

            const orderData = await orderResponse.json();

            if (orderResponse.ok) {
                // 2. 打开支付弹窗
                setSelectedOrder({
                    orderId: orderData.data.orderNumber,
                    amount: orderData.data.amount,
                });
                setPaymentVisible(true);
            } else {
                message.error(orderData.message || '创建订单失败');
            }
        } catch (error) {
            console.error('充值失败:', error);
            message.error('网络错误');
        }
    };

    // 支付成功回调
    const handlePaymentSuccess = () => {
        message.success('充值成功！');
        fetchPackages(); // 刷新用户信息
    };

    useEffect(() => {
        fetchPackages();
    }, []);

    const renderPackageCard = (pkg: Package) => (
        <Card
            key={pkg.id}
            className="relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1"
            bodyStyle={{ padding: '20px' }}
        >
            {/* HOT 标签 */}
            {pkg.isHot && (
                <div className="absolute right-0 top-0">
                    <Tag color="red" icon={<FireOutlined />} className="m-0 rounded-bl-lg rounded-tr-lg border-0 px-3 py-1">
                        HOT
                    </Tag>
                </div>
            )}

            {/* 价格 */}
            <div className="mb-3 text-center">
                <div className="flex items-end justify-center gap-2">
                    <span className="text-3xl font-bold text-orange-500">¥{pkg.price}</span>
                    {pkg.originalPrice && (
                        <span className="mb-1 text-sm text-gray-400 line-through">¥{pkg.originalPrice}</span>
                    )}
                </div>
                <div className="mt-1 text-sm text-gray-500">{pkg.packageName}</div>
            </div>

            {/* 积分信息 */}
            <div className="mb-4 space-y-2 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 p-3">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">基础积分:</span>
                    <span className="font-semibold text-blue-600">{pkg.basePoints}</span>
                </div>

                {pkg.giftPoints > 0 && (
                    <>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">赠送积分:</span>
                            <span className="font-semibold text-orange-500">
                                +{pkg.giftPoints} ({pkg.giftPercent}%)
                            </span>
                        </div>
                        <div className="border-t border-gray-200 pt-2"></div>
                    </>
                )}

                <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">总积分:</span>
                    <span className="text-xl font-bold text-purple-600">{pkg.totalPoints}</span>
                </div>
            </div>

            {/* 有效期 */}
            {pkg.validType === 'timeLimit' && pkg.validDays && (
                <div className="mb-3 text-center text-xs text-gray-500">
                    有效期: {pkg.validDays}天
                </div>
            )}

            {/* 充值按钮 */}
            <Button
                type="primary"
                block
                size="large"
                icon={<ThunderboltOutlined />}
                onClick={() => handleRecharge(pkg)}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            >
                立即充值
            </Button>
        </Card>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
            <div className="mx-auto max-w-7xl">
                {/* 头部 */}
                <div className="mb-8 text-center">
                    <h1 className="mb-2 text-4xl font-bold text-gray-800">
                        <CrownOutlined className="mr-2 text-yellow-500" />
                        积分充值
                    </h1>
                    <p className="text-gray-600">选择适合您的充值套餐，享受更多服务</p>

                    {/* 用户积分信息 */}
                    {userInfo && (
                        <div className="mt-4 inline-block rounded-lg bg-white px-6 py-3 shadow-sm">
                            <span className="text-gray-600">当前积分: </span>
                            <span className="text-2xl font-bold text-blue-600">{userInfo.balancePoints || 0}</span>
                        </div>
                    )}
                </div>

                {/* 套餐列表 */}
                {loading ? (
                    <div className="flex h-64 items-center justify-center">
                        <Spin size="large" tip="加载中..." />
                    </div>
                ) : (
                    <div className="space-y-10">
                        {packageGroups.map((group) => (
                            <div key={group.groupId}>
                                {/* 分组标题 */}
                                <div className="mb-6">
                                    <h2 className="inline-block rounded-lg bg-white px-6 py-2 text-2xl font-bold text-gray-800 shadow-sm">
                                        {group.groupType === 'limited' && <FireOutlined className="mr-2 text-red-500" />}
                                        {group.groupName}
                                    </h2>
                                    {group.groupType === 'limited' && (
                                        <Tag color="red" className="ml-3">
                                            限时特惠
                                        </Tag>
                                    )}
                                </div>

                                {/* 套餐卡片网格 */}
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {group.packages.map(renderPackageCard)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 支付弹窗 */}
                {selectedOrder && (
                    <PaymentModal
                        visible={paymentVisible}
                        onClose={() => {
                            setPaymentVisible(false);
                            setSelectedOrder(null);
                        }}
                        orderId={selectedOrder.orderId}
                        amount={selectedOrder.amount}
                        onSuccess={handlePaymentSuccess}
                    />
                )}
            </div>
        </div>
    );
}
