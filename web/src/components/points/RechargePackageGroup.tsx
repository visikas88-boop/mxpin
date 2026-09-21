import { useTranslation } from "react-i18next";
import { RechargePackageCard } from "./RechargePackageCard";
import type { PackageGroup } from "./types";

interface RechargePackageGroupProps {
    group: PackageGroup;
    selectedPackageId: number | null;
    onSelectPackage: (packageId: number) => void;
}

export function RechargePackageGroup({ group, selectedPackageId, onSelectPackage }: RechargePackageGroupProps) {
    const { i18n } = useTranslation();
    const isZh = i18n.language === "zh-CN";

    return (
        <div className="space-y-3">
            {/* 分组标题 */}
            <div className="space-y-2">
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    {group.groupType === "limited" && "🔥 "}
                    {isZh ? group.groupName : group.groupNameEn}
                </h3>

                {/* 分组描述 */}
                {(group.groupDesc || group.groupDescEn) && (
                    <div className="whitespace-pre-line rounded-lg bg-blue-50 px-3 py-2 text-xs leading-relaxed text-stone-600 dark:bg-blue-950/30 dark:text-stone-400">
                        {isZh ? group.groupDesc : group.groupDescEn}
                    </div>
                )}
            </div>

            {/* 套餐卡片列表 - 每行4个 */}
            <div className="grid grid-cols-4 gap-3">
                {group.packages
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((pkg) => (
                        <RechargePackageCard
                            key={pkg.id}
                            package={pkg}
                            selected={selectedPackageId === pkg.id}
                            onSelect={onSelectPackage}
                        />
                    ))}
            </div>
        </div>
    );
}
