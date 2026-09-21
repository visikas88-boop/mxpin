import { useState, useEffect } from "react";
import { Modal, message, Spin } from "antd";
import { useTranslation } from "react-i18next";
import { RechargeHeader } from "./RechargeHeader";
import { RechargePackageGroup } from "./RechargePackageGroup";
import { RechargeFooter } from "./RechargeFooter";
import type { RechargePackagesResponse, UserInfo, PackageGroup } from "./types";
import { apiFetch } from "@/utils/api-config";

interface RechargeModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function RechargeModal({ open, onClose, onSuccess }: RechargeModalProps) {
    const { i18n } = useTranslation();
    const isZh = i18n.language === "zh-CN";

    const [loading, setLoading] = useState(true);
    const [buyLoading, setBuyLoading] = useState(false);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [packageGroups, setPackageGroups] = useState<PackageGroup[]>([]);
    const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);

    useEffect(() => {
        if (open) {
            fetchPackages();
        } else {
            // 关闭时重置状态
            setSelectedPackageId(null);
        }
    }, [open]);

    const fetchPackages = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("auth_token");
            const response = await apiFetch("/recharge/packages", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data: RechargePackagesResponse = await response.json();
            if (response.ok && data.success) {
                setUserInfo(data.data.userInfo);
                setPackageGroups(data.data.packageGroups.sort((a, b) => a.sortOrder - b.sortOrder));
            } else {
                message.error(isZh ? "获取套餐列表失败" : "Failed to fetch packages");
            }
        } catch (error) {
            console.error("Fetch packages error:", error);
            message.error(isZh ? "网络错误" : "Network error");
        } finally {
            setLoading(false);
        }
    };

    const handleBuy = async () => {
        if (!selectedPackageId) {
            message.warning(isZh ? "请选择一个套餐" : "Please select a package");
            return;
        }

        setBuyLoading(true);
        try {
            const token = localStorage.getItem("auth_token");
            const response = await apiFetch("/recharge/create-order", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    packageId: selectedPackageId,
                }),
            });

            const data = await response.json();
            if (response.ok && data.success) {
                message.success(data.message || (isZh ? "订单创建成功" : "Order created successfully"));

                // TODO: 这里可以打开支付弹窗显示二维码
                // 或者跳转到支付页面
                console.log("Order created:", data.data);

                // 支付成功后的回调
                onSuccess?.();
                onClose();
            } else {
                message.error(data.message || (isZh ? "订单创建失败" : "Failed to create order"));
            }
        } catch (error) {
            console.error("Create order error:", error);
            message.error(isZh ? "网络错误" : "Network error");
        } finally {
            setBuyLoading(false);
        }
    };

    return (
        <Modal
            title={
                <span className="text-xl font-bold text-stone-900 dark:text-stone-100">
                    {isZh ? "💰 积分充值" : "💰 Points Recharge"}
                </span>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={1000}
            centered
            destroyOnClose
            className="recharge-modal"
            styles={{
                body: { padding: 0, height: "75vh", maxHeight: "650px", display: "flex", flexDirection: "column" },
            }}
        >
            {loading ? (
                <div className="flex h-full items-center justify-center">
                    <Spin size="large" />
                </div>
            ) : (
                <div className="flex h-full flex-col">
                    {/* 头部：用户信息 - 固定高度 */}
                    <div className="flex-shrink-0">
                        <RechargeHeader userInfo={userInfo} loading={loading} />
                    </div>

                    {/* 主体：套餐列表 - 可滚动区域 */}
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        <div className="space-y-6">
                            {packageGroups.map((group) => (
                                <RechargePackageGroup
                                    key={group.groupId}
                                    group={group}
                                    selectedPackageId={selectedPackageId}
                                    onSelectPackage={setSelectedPackageId}
                                />
                            ))}
                        </div>
                    </div>

                    {/* 底部：购买按钮和提示 - 固定高度 */}
                    <div className="flex-shrink-0 border-t border-slate-200 bg-white">
                        <RechargeFooter
                            selectedPackageId={selectedPackageId}
                            onBuy={handleBuy}
                            loading={buyLoading}
                        />
                    </div>
                </div>
            )}
        </Modal>
    );
}
