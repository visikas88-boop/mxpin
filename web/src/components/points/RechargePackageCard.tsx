import { useTranslation } from "react-i18next";
import { CheckCircleFilled, FireOutlined } from "@ant-design/icons";
import type { RechargePackage } from "./types";

interface RechargePackageCardProps {
    package: RechargePackage;
    selected: boolean;
    onSelect: (packageId: number) => void;
}

export function RechargePackageCard({ package: pkg, selected, onSelect }: RechargePackageCardProps) {
    const { i18n } = useTranslation();
    const isZh = i18n.language === "zh-CN";

    const hasGift = pkg.giftPoints > 0;
    const hasOriginalPrice = pkg.originalPrice && pkg.originalPrice > pkg.price;

    return (
        <div
            onClick={() => onSelect(pkg.id)}
            className={`
                relative cursor-pointer rounded-lg border-2 p-3 transition-all duration-200
                hover:shadow-lg
                ${
                    selected
                        ? "border-purple-600 bg-purple-50 shadow-md dark:border-purple-400 dark:bg-purple-950/50"
                        : "border-stone-200 bg-white hover:border-purple-300 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-purple-600"
                }
            `}
        >
            {/* 选中标记 */}
            {selected && (
                <div className="absolute right-2 top-2">
                    <CheckCircleFilled className="text-lg text-purple-600 dark:text-purple-400" />
                </div>
            )}

            {/* 热门标签 */}
            {pkg.isHot && (
                <div className="absolute left-2 top-2 rounded bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">
                    {isZh ? "热门" : "HOT"}
                </div>
            )}

            <div className="space-y-2 pt-6">
                {/* 积分数字 */}
                <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {pkg.totalPoints.toLocaleString()}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                        {isZh ? "积分" : "Points"}
                    </div>
                    {hasGift && (
                        <div className="mt-0.5 text-xs text-purple-600 dark:text-purple-400">
                            {isZh ? "赠" : "+"} {pkg.giftPoints.toLocaleString()}
                        </div>
                    )}
                </div>

                {/* 价格 */}
                <div className="text-center">
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        ¥{pkg.price.toFixed(2)}
                    </div>
                    {hasOriginalPrice && (
                        <div className="text-xs text-stone-400 line-through dark:text-stone-500">
                            ¥{pkg.originalPrice!.toFixed(2)}
                        </div>
                    )}
                </div>

                {/* 有效期 */}
                <div className="rounded bg-stone-50 px-2 py-1 text-center text-xs text-stone-600 dark:bg-stone-900 dark:text-stone-400">
                    {pkg.validType === "permanent"
                        ? isZh ? "永久有效" : "Permanent"
                        : isZh ? `${pkg.validDays}天有效` : `${pkg.validDays} days`}
                </div>
            </div>
        </div>
    );
}
