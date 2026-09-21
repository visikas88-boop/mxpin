import { useState } from "react";
import { Tabs } from "antd";
import { SettingOutlined, CloudSyncOutlined } from "@ant-design/icons";
import { AppConfigPanel } from "@/components/layout/app-config-modal";
import { SystemUpdatePanel } from "@/components/admin/SystemUpdatePanel";

type TabKey = "config" | "update";

export default function AdminSettingsPage() {
    const [activeTab, setActiveTab] = useState<TabKey>("config");

    const tabItems = [
        {
            key: "config",
            label: (
                <span className="flex items-center gap-2">
                    <SettingOutlined />
                    系统配置
                </span>
            ),
            children: <AppConfigPanel />,
        },
        {
            key: "update",
            label: (
                <span className="flex items-center gap-2">
                    <CloudSyncOutlined />
                    系统更新
                </span>
            ),
            children: <SystemUpdatePanel />,
        },
    ];

    return (
        <div className="min-h-full bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 p-8 pb-24">
            <div className="mx-auto max-w-7xl">
                <div className="mb-6 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">系统管理</h2>
                    <p className="text-gray-600">
                        管理AI模型渠道、本地代理、偏好设置、WebDAV云同步及系统版本更新
                    </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
                    <Tabs
                        activeKey={activeTab}
                        onChange={(key) => setActiveTab(key as TabKey)}
                        items={tabItems}
                        size="large"
                    />
                </div>
            </div>
        </div>
    );
}
