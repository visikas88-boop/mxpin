import { useState, useEffect } from "react";
import { Button, Card, Tag, Timeline, message, Spin } from "antd";
import { CheckCircleOutlined, SyncOutlined, CloudDownloadOutlined } from "@ant-design/icons";
import { APP_VERSION } from "@/constant/env";

// VideoFlow Pro 独立版本管理
// TODO: 部署后替换为你们自己的仓库地址
const latestVersionUrl = "https://raw.githubusercontent.com/YOUR_ORG/videoflow-pro/main/VERSION";
const latestChangelogUrl = "https://raw.githubusercontent.com/YOUR_ORG/videoflow-pro/main/CHANGELOG.md";

// 开发环境可以禁用远程检查
const ENABLE_REMOTE_CHECK = false; // 部署后改为 true

interface ReleaseItem {
    type: string;
    content: string;
}

interface ReleaseInfo {
    version: string;
    date: string;
    items: ReleaseItem[];
}

function getTagColor(type: string) {
    if (type === "新增" || type === "Added") return "green";
    if (type === "修复" || type === "Fixed") return "red";
    if (type === "调整" || type === "Changed") return "blue";
    if (type === "文档" || type === "Docs") return "purple";
    return "default";
}

function parseChangelog(changelog: string): ReleaseInfo[] {
    const lines = changelog.split("\n");
    const releases: ReleaseInfo[] = [];
    let currentRelease: ReleaseInfo | null = null;

    for (const line of lines) {
        const versionMatch = line.match(/^## \[(.+?)\] - (.+)$/);
        if (versionMatch) {
            if (currentRelease) releases.push(currentRelease);
            currentRelease = {
                version: versionMatch[1],
                date: versionMatch[2],
                items: [],
            };
            continue;
        }

        const itemMatch = line.match(/^- \*\*(.+?)\*\*[：:]\s*(.+)$/);
        if (itemMatch && currentRelease) {
            currentRelease.items.push({
                type: itemMatch[1],
                content: itemMatch[2],
            });
        }
    }

    if (currentRelease) releases.push(currentRelease);
    return releases;
}

function toVersionParts(version: string) {
    const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
    return match ? match.slice(1).map(Number) : null;
}

function isNewerVersion(latestVersion: string, currentVersion: string) {
    const latest = toVersionParts(latestVersion);
    const current = toVersionParts(currentVersion);
    if (!latest || !current) return false;
    return latest.some((value, index) => value > current[index] && latest.slice(0, index).every((part, prevIndex) => part === current[prevIndex]));
}

export function SystemUpdatePanel() {
    const [latestVersion, setLatestVersion] = useState(APP_VERSION);
    const [releases, setReleases] = useState<ReleaseInfo[]>([]);
    const [checking, setChecking] = useState(false);
    const [loading, setLoading] = useState(true);
    const hasNewVersion = isNewerVersion(latestVersion, APP_VERSION);

    const checkLatestRelease = async (showMessage = false) => {
        if (!ENABLE_REMOTE_CHECK) {
            // 开发环境：使用本地版本信息
            setLatestVersion(APP_VERSION);
            setReleases([
                {
                    version: APP_VERSION,
                    date: new Date().toISOString().split('T')[0],
                    items: [
                        { type: "说明", content: "系统更新检查已禁用（开发环境）" },
                        { type: "提示", content: "部署后请修改 ENABLE_REMOTE_CHECK 为 true 并配置仓库地址" },
                    ],
                },
            ]);
            setLoading(false);
            if (showMessage) message.info("开发环境：远程版本检查已禁用");
            return false;
        }

        setChecking(true);
        try {
            const [versionResponse, changelogResponse] = await Promise.all([
                fetch(latestVersionUrl),
                fetch(latestChangelogUrl),
            ]);

            if (!versionResponse.ok) throw new Error("版本读取失败");
            if (!changelogResponse.ok) throw new Error("更新日志读取失败");

            const [version, changelog] = await Promise.all([
                versionResponse.text(),
                changelogResponse.text(),
            ]);

            setLatestVersion(version.trim() || APP_VERSION);
            if (changelog.trim()) setReleases(parseChangelog(changelog));
            if (showMessage) message.success("已获取最新版本信息");
            return true;
        } catch (error) {
            setLatestVersion(APP_VERSION);
            if (showMessage) message.error("获取最新版本信息失败");
            return false;
        } finally {
            setChecking(false);
            setLoading(false);
        }
    };

    useEffect(() => {
        void checkLatestRelease();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Spin size="large" tip="正在检查版本..." />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 版本信息卡片 */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="shadow-sm">
                    <div className="text-sm text-slate-500 mb-2">当前版本</div>
                    <div className="text-2xl font-bold text-slate-900 mb-1">{APP_VERSION}</div>
                    <Tag icon={<CheckCircleOutlined />} color="blue">
                        运行中
                    </Tag>
                </Card>

                <Card className="shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-slate-500">最新版本</div>
                        <Button
                            size="small"
                            icon={<SyncOutlined />}
                            loading={checking}
                            onClick={() => void checkLatestRelease(true)}
                        >
                            {checking ? "检查中..." : "检查更新"}
                        </Button>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mb-1">{latestVersion}</div>
                    {hasNewVersion ? (
                        <Tag icon={<CloudDownloadOutlined />} color="green">
                            有新版本可用
                        </Tag>
                    ) : (
                        <Tag icon={<CheckCircleOutlined />} color="success">
                            已是最新版本
                        </Tag>
                    )}
                </Card>
            </div>

            {/* 更新提示 */}
            {hasNewVersion && (
                <Card className="border-green-200 bg-green-50 shadow-sm">
                    <div className="flex items-start gap-3">
                        <CloudDownloadOutlined className="text-green-600 text-xl mt-1" />
                        <div>
                            <div className="font-semibold text-green-800 mb-1">
                                发现新版本 {latestVersion}
                            </div>
                            <div className="text-sm text-green-700">
                                建议更新到最新版本以获得最新功能和修复。请访问项目仓库下载最新版本。
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* 版本历史 */}
            <Card title="版本历史" className="shadow-sm">
                <div className="max-h-[500px] overflow-y-auto pr-2">
                    {releases.length === 0 ? (
                        <div className="text-center text-slate-500 py-8">暂无版本历史记录</div>
                    ) : (
                        <Timeline
                            items={releases.map((release) => ({
                                content: (
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="text-base font-semibold text-slate-900">
                                                {release.version === "Unreleased"
                                                    ? "未发布"
                                                    : release.version}
                                            </span>
                                            <span className="text-xs text-slate-500">{release.date}</span>
                                            <div className="flex items-center gap-1.5">
                                                {release.version === latestVersion && (
                                                    <Tag color="green" className="m-0">
                                                        最新
                                                    </Tag>
                                                )}
                                                {release.version === APP_VERSION && (
                                                    <Tag className="m-0">当前</Tag>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {release.items.map((item, index) => (
                                                <div
                                                    key={`${release.version}-${index}`}
                                                    className="flex items-start gap-2 text-sm"
                                                >
                                                    <Tag
                                                        color={getTagColor(item.type)}
                                                        className="m-0 mt-0.5 shrink-0"
                                                    >
                                                        {item.type}
                                                    </Tag>
                                                    <span className="text-slate-700">{item.content}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ),
                            }))}
                        />
                    )}
                </div>
            </Card>
        </div>
    );
}
