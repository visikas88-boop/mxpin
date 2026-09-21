import { useTranslation } from "react-i18next";
import { UserOutlined, CrownOutlined, WalletOutlined } from "@ant-design/icons";
import type { UserInfo } from "./types";

interface RechargeHeaderProps {
    userInfo: UserInfo | null;
    loading: boolean;
}

export function RechargeHeader({ userInfo, loading }: RechargeHeaderProps) {
    const { t, i18n } = useTranslation();
    const isZh = i18n.language === "zh-CN";

    if (loading) {
        return (
            <div className="animate-pulse space-y-3 border-b border-stone-200 p-6 dark:border-stone-700">
                <div className="h-5 w-32 rounded bg-stone-200 dark:bg-stone-700"></div>
                <div className="h-4 w-48 rounded bg-stone-200 dark:bg-stone-700"></div>
                <div className="h-6 w-40 rounded bg-stone-200 dark:bg-stone-700"></div>
            </div>
        );
    }

    if (!userInfo) {
        return null;
    }

    return (
        <div className="space-y-3 border-b border-stone-200 bg-gradient-to-r from-purple-50 to-blue-50 p-6 dark:border-stone-700 dark:from-purple-950/30 dark:to-blue-950/30">
            {/* 用户名 */}
            <div className="flex items-center gap-2">
                <UserOutlined className="text-lg text-purple-600 dark:text-purple-400" />
                <span className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                    {userInfo.username}
                </span>
            </div>

            {/* 会员等级（如果有） */}
            {userInfo.memberLevel && (
                <div className="flex items-center gap-2">
                    <CrownOutlined className="text-yellow-600 dark:text-yellow-400" />
                    <span className="text-sm text-stone-700 dark:text-stone-300">
                        {userInfo.memberLevel}
                        {userInfo.memberExpireAt && (
                            <span className="ml-2 text-stone-500 dark:text-stone-400">
                                ({isZh ? "到期时间" : "Expires"}: {userInfo.memberExpireAt})
                            </span>
                        )}
                    </span>
                </div>
            )}

            {/* 剩余积分 */}
            <div className="flex items-center gap-2">
                <WalletOutlined className="text-lg text-orange-600 dark:text-orange-400" />
                <span className="text-sm text-stone-600 dark:text-stone-400">
                    {isZh ? "剩余积分" : "Remaining Points"}:
                </span>
                <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {userInfo.balancePoints.toLocaleString()}
                </span>
            </div>
        </div>
    );
}
