import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tooltip } from "antd";
import { useState, useEffect } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { UserDropdown } from "@/components/layout/user-dropdown";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { useThemeStore } from "@/stores/use-theme-store";
import { changeAppLocale, type AppLocale } from "@/i18n";

export default function UserLayout({ children }: { children: ReactNode }) {
    const { pathname } = useLocation();
    const { i18n, t } = useTranslation();
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    const hideHeader = /^\/canvas\/[^/]+/.test(pathname);
    const locale = i18n.resolvedLanguage as AppLocale;
    const nextLocale = locale === "zh-CN" ? "en-US" : "zh-CN";
    const languageLabel = t("topNav.switchLanguage", { language: t(nextLocale === "zh-CN" ? "locale.zhCN" : "locale.enUS") });

    // 监听侧边栏宽度变化
    const [sidebarWidth, setSidebarWidth] = useState(176); // 默认44*4=176px (w-44)

    useEffect(() => {
        const updateSidebarWidth = () => {
            const sidebar = document.querySelector("aside");
            if (sidebar) {
                setSidebarWidth(sidebar.offsetWidth);
            }
        };

        updateSidebarWidth();
        const observer = new ResizeObserver(updateSidebarWidth);
        const sidebar = document.querySelector("aside");
        if (sidebar) {
            observer.observe(sidebar);
        }

        return () => observer.disconnect();
    }, [hideHeader]);

    return (
        <div className="flex h-dvh overflow-hidden bg-stone-50 dark:bg-stone-900">
            {/* 左侧边栏 */}
            {!hideHeader && <AppSidebar />}

            {/* 右侧主内容区 */}
            <div
                className="flex min-w-0 flex-1 flex-col overflow-hidden transition-all duration-300"
                style={!hideHeader ? { marginLeft: `${sidebarWidth}px` } : {}}
            >
                {/* 顶部工具栏 */}
                {!hideHeader && (
                    <header className="flex h-16 shrink-0 items-center justify-end gap-3 border-b border-stone-200 bg-white px-6 dark:border-stone-800 dark:bg-stone-950">
                        {/* 语言切换 */}
                        <Tooltip title={languageLabel} mouseEnterDelay={0.2}>
                            <button
                                type="button"
                                className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-sm font-semibold tracking-tight text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-900 dark:hover:text-white"
                                onClick={() => void changeAppLocale(nextLocale)}
                                aria-label={languageLabel}
                            >
                                {locale === "zh-CN" ? "中" : "EN"}
                            </button>
                        </Tooltip>

                        {/* 主题切换 */}
                        <AnimatedThemeToggler
                            theme={theme}
                            onThemeChange={setTheme}
                            className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-900 dark:hover:text-white [&_svg]:size-4"
                            aria-label={t(theme === "dark" ? "topNav.lightTheme" : "topNav.darkTheme")}
                            title={t(theme === "dark" ? "topNav.lightTheme" : "topNav.darkTheme")}
                        />

                        {/* 用户下拉菜单 */}
                        <UserDropdown />
                    </header>
                )}

                {/* 主内容区 */}
                <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            </div>
        </div>
    );
}
