import { useTranslation } from "react-i18next";
import { Button } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";

interface RechargeFooterProps {
    selectedPackageId: number | null;
    onBuy: () => void;
    loading?: boolean;
}

export function RechargeFooter({ selectedPackageId, onBuy, loading }: RechargeFooterProps) {
    const { i18n } = useTranslation();
    const isZh = i18n.language === "zh-CN";

    const noticeTextZh = `积分不可兑换会员，不可转赠，也不可提现；积分充值有效期以所购套餐为准，不支持退款或反向兑换为人民币。`;
    const noticeTextEn = `Points cannot be exchanged for membership, transferred or withdrawn. The validity of points follows your purchased package, no refund or cash conversion allowed.`;

    return (
        <div className="space-y-4 border-t border-stone-200 bg-stone-50 p-6 dark:border-stone-700 dark:bg-stone-900/50">
            {/* 立即购买按钮 */}
            <Button
                type="primary"
                size="large"
                block
                disabled={!selectedPackageId}
                loading={loading}
                onClick={onBuy}
                className={`
                    !h-12 !text-base !font-semibold
                    ${
                        selectedPackageId
                            ? "!bg-gradient-to-r !from-purple-600 !to-blue-600 hover:!from-purple-700 hover:!to-blue-700 dark:!from-purple-500 dark:!to-blue-500"
                            : "!bg-stone-300 dark:!bg-stone-700"
                    }
                `}
            >
                {isZh ? "立即购买" : "Buy Now"}
            </Button>

            {/* 温馨提示 */}
            <div className="flex gap-2 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950/30">
                <ExclamationCircleOutlined className="mt-0.5 shrink-0 text-yellow-600 dark:text-yellow-500" />
                <div className="space-y-1">
                    <div className="text-xs font-semibold text-yellow-800 dark:text-yellow-400">
                        {isZh ? "⚠️ 温馨提示" : "⚠️ Notice"}
                    </div>
                    <div className="text-xs leading-relaxed text-yellow-700 dark:text-yellow-500">
                        {isZh ? noticeTextZh : noticeTextEn}
                    </div>
                </div>
            </div>
        </div>
    );
}
