import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { useState } from "react";

export function AppSidebar() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const slug = pathname.split("/").filter(Boolean)[0];
    const activeToolSlug = navigationTools.some((tool) => tool.slug === slug) ? (slug as NavigationToolSlug) : undefined;

    return (
        <aside
            className={cn(
                "fixed left-0 top-0 z-30 h-screen border-r border-stone-200 bg-white transition-all duration-300 ease-in-out dark:border-stone-800 dark:bg-stone-950",
                collapsed ? "w-20" : "w-44"
            )}
        >
            {/* Logo区域 */}
            <div className="flex h-16 items-center justify-between border-b border-stone-200 px-4 dark:border-stone-800">
                {/* Logo */}
                <Link
                    to="/"
                    className="flex items-center gap-2.5 text-lg font-semibold text-stone-950 transition-all hover:text-stone-600 dark:text-stone-100 dark:hover:text-stone-300"
                >
                    {/* 艺术化M字母Logo */}
                    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" className="shrink-0 transition-transform hover:scale-105">
                        <path d="M4 28V8L16 20L28 8V28H24V14L16 22L8 14V28H4Z" fill="currentColor" />
                        <circle cx="16" cy="6" r="2" fill="currentColor" />
                    </svg>
                    {!collapsed && (
                        <span className="whitespace-nowrap transition-all duration-300">
                            {t("meta.title")}
                        </span>
                    )}
                </Link>

                {/* 展开/收起按钮 */}
                <button
                    type="button"
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-stone-500 transition-all hover:bg-stone-100 hover:text-stone-950 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-white"
                    aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
                >
                    {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                </button>
            </div>

            {/* 导航菜单 */}
            <nav className="flex flex-col gap-1 p-3">
                {navigationTools.map((tool) => {
                    const Icon = tool.icon;
                    const active = tool.slug === activeToolSlug;
                    return (
                        <Link
                            key={tool.slug}
                            to={`/${tool.slug}`}
                            className={cn(
                                "group relative flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                collapsed ? "flex-col gap-1 px-2 py-3" : "",
                                active
                                    ? "bg-stone-950 text-white shadow-sm dark:bg-white dark:text-stone-950"
                                    : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-900"
                            )}
                        >
                            <Icon className={cn("size-5 shrink-0 transition-transform", active ? "" : tool.color, !active && "group-hover:scale-110")} />
                            <span
                                className={cn(
                                    "transition-all leading-tight",
                                    collapsed ? "text-[10px] text-center whitespace-nowrap" : "text-xs break-words"
                                )}
                            >
                                {t(`navigation.${tool.slug}`)}
                            </span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
