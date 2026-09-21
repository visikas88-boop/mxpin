import { ArrowLeft, ArrowRight, ArrowRight as ArrowRightIcon, BookOpen, CheckSquare, ClipboardPaste, Download, FolderPlus, History, ImagePlus, LoaderCircle, Plus, SlidersHorizontal, Sparkles, Trash2, Upload, VideoIcon, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type DragEvent } from "react";
import { App, Button, Checkbox, Drawer, Empty, Input, Modal, Tabs, Tag, Typography, Progress } from "antd";
import localforage from "localforage";
import { nanoid } from "nanoid";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";

import { AssetPickerModal, type InsertAssetPayload } from "@/components/canvas/asset-picker-modal";
import { PromptSelectDialog } from "@/components/prompts/prompt-select-dialog";
import { ModelSettingsModal } from "@/components/video/ModelSettingsModal";
import { VideoSettingsPanel, normalizeVideoResolutionValue, normalizeVideoSizeValue, videoModeLabel, videoSizeLabel } from "@/components/video-settings-panel";
import { PublishingModal } from "@/components/publishing/PublishingModal";
import { canvasThemes } from "@/lib/canvas-theme";
import { clampVideoSeconds } from "@/lib/media-size";
import { formatBytes, formatDuration } from "@/lib/image-utils";
import { compressImages, formatFileSize } from "@/lib/image-compress";
import { deleteStoredMedia, resolveMediaUrl } from "@/services/file-storage";
import { resolveImageUrl, ensureImagePreview, getImagePreviewRevision, previewUrlFor, subscribeImagePreviews, uploadImage } from "@/services/image-storage";
import { createVideoGenerationTask, pollVideoGenerationTask, storeGeneratedVideo, type VideoGenerationTask } from "@/services/api/video";
import { useAssetStore } from "@/stores/use-asset-store";
import { useWorkbenchAgentStore } from "@/stores/use-workbench-agent-store";
import { boolConfig, modelOptionLabel, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import type { ReferenceImage } from "@/types/image";
import i18n from "@/i18n";

type GeneratedVideo = {
    id: string;
    url: string;
    storageKey: string;
    durationMs: number;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
};

type GenerationResult = {
    id: string;
    status: "pending" | "success" | "failed";
    video?: GeneratedVideo;
    error?: string;
};

type GenerationLog = {
    id: string;
    createdAt: number;
    title: string;
    prompt: string;
    time: string;
    model: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
    durationMs: number;
    size: string;
    resolution: string;
    seconds: string;
    status: "pending" | "success" | "failed";
    task?: VideoGenerationTask;
    video?: GeneratedVideo;
    error?: string;
};

type GenerationLogConfig = Pick<AiConfig, "model" | "videoModel" | "size" | "vquality" | "videoSeconds" | "videoGenerateAudio" | "videoWatermark" | "videoMode">;

type UpdateAiConfig = <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;

const LOG_STORE_KEY = "infinite-canvas:video_generation_logs";
const logStore = localforage.createInstance({ name: "infinite-canvas", storeName: "video_generation_logs" });

export default function VideoPage() {
    const { message } = App.useApp();
    const { t } = useTranslation();
    useSyncExternalStore(subscribeImagePreviews, getImagePreviewRevision);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragDepthRef = useRef(0);
    const activeLogIdsRef = useRef<Set<string>>(new Set());
    const config = useConfigStore((state) => state.config);
    const effectiveConfig = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const addAsset = useAssetStore((state) => state.addAsset);
    const [prompt, setPrompt] = useState("");
    const [promptLength, setPromptLength] = useState(0);
    const [references, setReferences] = useState<ReferenceImage[]>([]);
    const [results, setResults] = useState<GenerationResult[]>([]);
    const [logs, setLogs] = useState<GenerationLog[]>([]);
    const [running, setRunning] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
    const [textareaExpanded, setTextareaExpanded] = useState(false);
    const [promptDialogOpen, setPromptDialogOpen] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [startedAt, setStartedAt] = useState(0);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
    const [previewLog, setPreviewLog] = useState<GenerationLog | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [referenceDragTarget, setReferenceDragTarget] = useState(false);
    const [autoRunToken, setAutoRunToken] = useState(0);
    const [activeTab, setActiveTab] = useState("logs");
    const [compressing, setCompressing] = useState(false);
    const [compressProgress, setCompressProgress] = useState(0);
    const [publishingModalOpen, setPublishingModalOpen] = useState(false);
    const [videoToPublish, setVideoToPublish] = useState<GeneratedVideo | null>(null);
    const videoCommand = useWorkbenchAgentStore((state) => state.videoCommand);
    const clearVideoCommand = useWorkbenchAgentStore((state) => state.clearVideoCommand);
    const updateAgentTask = useWorkbenchAgentStore((state) => state.updateTask);
    const processedCommandRef = useRef(0);
    const agentTaskIdRef = useRef<string | undefined>(undefined);

    const model = effectiveConfig.videoModel || effectiveConfig.model;
    const [calculatedPoints, setCalculatedPoints] = useState<number | null>(null);
    const canGenerate = Boolean(prompt.trim());

    // 计算积分消耗
    useEffect(() => {
        const calculatePoints = () => {
            if (!model) {
                setCalculatedPoints(null);
                return;
            }

            const decoded = model.indexOf('::') > -1 ? model.split('::') : null;
            if (!decoded) {
                setCalculatedPoints(null);
                return;
            }

            const channelId = decoded[0];
            const modelName = decoded[1];
            const channel = config.channels.find((ch) => ch.id === channelId);
            const modelData = channel?.models.find((m) => m.name === modelName);

            if (!modelData || !modelData.pointsCost) {
                setCalculatedPoints(null);
                return;
            }

            if (modelData.billingType === 'per_request') {
                setCalculatedPoints(modelData.pointsCost);
            } else if (modelData.billingType === 'per_second') {
                const seconds = Number(clampVideoSeconds(config.videoSeconds || "15"));
                setCalculatedPoints(modelData.pointsCost * seconds);
            } else {
                setCalculatedPoints(null);
            }
        };

        calculatePoints();
    }, [model, config.videoSeconds, config.channels]);

    useEffect(() => {
        setPromptLength(prompt.length);
    }, [prompt]);

    useEffect(() => {
        if (!running || !startedAt) return;
        const timer = window.setInterval(() => setElapsedMs(performance.now() - startedAt), 1000);
        return () => window.clearInterval(timer);
    }, [running, startedAt]);

    useEffect(() => {
        void refreshLogs();
    }, []);

    const addReferences = async (files?: FileList | null) => {
        const selectedFiles = Array.from(files || []);
        const unsupported = selectedFiles.filter((file) => !file.type.startsWith("image/"));
        if (unsupported.length) message.warning(t("videoWorkbench.unsupportedFiles"));

        const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/")).slice(0, 9 - references.length);

        if (imageFiles.length === 0) return;

        try {
            setCompressing(true);
            setCompressProgress(0);

            // 压缩图片
            const compressResults = await compressImages(imageFiles, {
                maxWidth: 2000,
                maxHeight: 2000,
                minWidth: 300,
                minHeight: 300,
                quality: 0.85,
                outputFormat: 'webp',
                onProgress: (progress) => {
                    setCompressProgress(Math.round(progress));
                },
            });

            // 显示压缩信息
            const totalOriginalSize = compressResults.reduce((sum, r) => sum + r.originalSize, 0);
            const totalCompressedSize = compressResults.reduce((sum, r) => sum + r.compressedSize, 0);
            const savedSize = totalOriginalSize - totalCompressedSize;
            const savedPercent = Math.round((savedSize / totalOriginalSize) * 100);

            message.success(
                `已压缩 ${compressResults.length} 张图片，节省 ${formatFileSize(savedSize)} (${savedPercent}%)`
            );

            // 上传压缩后的图片
            const nextReferences = await Promise.all(
                compressResults.map(async (result) => {
                    const image = await uploadImage(result.file);
                    return {
                        id: nanoid(),
                        name: result.file.name,
                        type: image.mimeType,
                        dataUrl: image.url,
                        storageKey: image.storageKey
                    };
                }),
            );

            setReferences((value) => [...value, ...nextReferences].slice(0, 9));
        } catch (error) {
            console.error('图片压缩失败:', error);
            message.error(error instanceof Error ? error.message : '图片压缩失败');
        } finally {
            setCompressing(false);
            setCompressProgress(0);
        }
    };

    const handleReferenceDragEnter = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        dragDepthRef.current += 1;
        if (event.dataTransfer.types.includes("Files")) setReferenceDragTarget(true);
    };

    const handleReferenceDragLeave = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (!dragDepthRef.current) setReferenceDragTarget(false);
    };

    const handleReferenceDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        dragDepthRef.current = 0;
        setReferenceDragTarget(false);
        void addReferences(event.dataTransfer.files);
    };

    const addReferencesFromClipboard = async () => {
        try {
            const items = await navigator.clipboard.read();
            const blobs = await Promise.all(items.flatMap((item) => item.types.filter((type) => type.startsWith("image/")).map((type) => item.getType(type))));
            if (!blobs.length) {
                message.error(t("videoWorkbench.clipboardEmpty"));
                return;
            }
            const nextReferences = await Promise.all(
                blobs.slice(0, 9 - references.length).map(async (blob, index) => {
                    const image = await uploadImage(blob);
                    return { id: nanoid(), name: `clipboard-${index + 1}.png`, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
                }),
            );
            setReferences((value) => [...value, ...nextReferences].slice(0, 9));
            message.success(t("videoWorkbench.clipboardAdded", { count: nextReferences.length }));
        } catch {
            message.error(t("videoWorkbench.clipboardEmpty"));
        }
    };

    const generate = async () => {
        const agentTaskId = agentTaskIdRef.current;
        agentTaskIdRef.current = undefined;
        const snapshot = buildRequestSnapshot();
        if (!snapshot) {
            if (agentTaskId) updateAgentTask(agentTaskId, { status: "failed", error: t("videoWorkbench.invalidParams") });
            return;
        }
        setElapsedMs(0);
        setRunning(true);
        if (agentTaskId) updateAgentTask(agentTaskId, { status: "running", error: undefined });
        setPreviewLog(null);
        setResults([{ id: nanoid(), status: "pending" }]);
        setActiveTab("results");
        const batchStartedAt = performance.now();
        setStartedAt(batchStartedAt);
        try {
            const task = await createVideoGenerationTask(snapshot.config, snapshot.text, snapshot.references);
            const log = buildLog({ prompt: snapshot.text, model, config: snapshot.config, references: snapshot.references, durationMs: 0, status: "pending", task });
            await saveLog(log, false);
            void pollGenerationLog(log, snapshot.config, agentTaskId);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t("workbench.generationFailed");
            setResults([{ id: nanoid(), status: "failed", error: errorMessage }]);
            if (agentTaskId) updateAgentTask(agentTaskId, { status: "failed", successCount: 0, failCount: 1, error: errorMessage });
            await saveLog(buildLog({ prompt: snapshot.text, model, config: snapshot.config, references: snapshot.references, durationMs: performance.now() - batchStartedAt, status: "failed", error: errorMessage }));
            message.error(errorMessage);
            setRunning(false);
        }
    };

    useEffect(() => {
        if (!videoCommand || videoCommand.nonce === processedCommandRef.current) return;
        processedCommandRef.current = videoCommand.nonce;
        clearVideoCommand();
        if (typeof videoCommand.prompt === "string") setPrompt(videoCommand.prompt);
        if (videoCommand.run && running) {
            if (videoCommand.taskId) updateAgentTask(videoCommand.taskId, { status: "failed", error: t("videoWorkbench.busy") });
            return;
        }
        if (videoCommand.run) {
            agentTaskIdRef.current = videoCommand.taskId;
            setAutoRunToken((value) => value + 1);
        }
    }, [videoCommand, clearVideoCommand, running, updateAgentTask]);

    useEffect(() => {
        if (!autoRunToken) return;
        void generate();
    }, [autoRunToken]);

    const buildRequestSnapshot = () => {
        const text = prompt.trim();
        if (!text) {
            message.error(t("videoWorkbench.promptRequired"));
            return null;
        }
        if (!isAiConfigReady(effectiveConfig, model)) {
            message.warning(t("workbench.configFirst"));
            openConfigDialog(true);
            return null;
        }
        return { text, config: buildVideoConfig(effectiveConfig, model), references: [...references] };
    };

    const retryResult = () => {
        void generate();
    };

    const downloadVideo = (video: GeneratedVideo) => {
        saveAs(video.url, "video.mp4");
    };

    const saveResultToAssets = (video: GeneratedVideo) => {
        addAsset({
            kind: "video",
            title: t("videoWorkbench.resultTitle"),
            coverUrl: "",
            tags: [],
            source: t("videoWorkbench.source"),
            data: { url: video.url, storageKey: video.storageKey, width: video.width, height: video.height, bytes: video.bytes, mimeType: video.mimeType },
            metadata: { source: "video-page", prompt },
        });
        message.success(t("common.addedToAssets"));
    };

    const handlePublishVideo = (video: GeneratedVideo) => {
        setVideoToPublish(video);
        setPublishingModalOpen(true);
    };

    const handlePublishSuccess = () => {
        message.success('视频发布任务已提交');
        setPublishingModalOpen(false);
        setVideoToPublish(null);
    };

    const insertPickedAsset = async (payload: InsertAssetPayload) => {
        if (payload.kind === "text") {
            setPrompt(payload.content);
        } else if (payload.kind === "image") {
            const stored = await uploadImage(payload.dataUrl);
            setReferences((value) => [...value, { id: nanoid(), name: payload.title, type: stored.mimeType, dataUrl: stored.url, storageKey: stored.storageKey }].slice(0, 9));
        }
        setAssetPickerOpen(false);
    };

    const createSession = () => {
        setPrompt("");
        setReferences([]);
        setResults([]);
        setElapsedMs(0);
        setStartedAt(0);
        setSelectedLogIds([]);
        setPreviewLog(null);
    };

    const deleteSelectedLogs = () => {
        const mediaKeys = logs
            .filter((log) => selectedLogIds.includes(log.id))
            .map((log) => log.video?.storageKey)
            .filter((key): key is string => Boolean(key));
        void Promise.all([deleteStoredMedia(mediaKeys), ...selectedLogIds.map((id) => logStore.removeItem(id))]).then(() => refreshLogs());
        if (previewLog && selectedLogIds.includes(previewLog.id)) {
            setPreviewLog(null);
            setResults([]);
        }
        setSelectedLogIds([]);
        setDeleteConfirmOpen(false);
    };

    const saveLog = async (log: GenerationLog, resumePending = true) => {
        await logStore.setItem(log.id, serializeLog(log));
        await refreshLogs(resumePending);
    };

    const refreshLogs = async (resumePending = true) => {
        const nextLogs = await readStoredLogs();
        setLogs(nextLogs);
        if (resumePending) resumePendingLogs(nextLogs);
        return nextLogs;
    };

    const resumePendingLogs = (items: GenerationLog[]) => {
        for (const log of items) {
            if (log.status === "pending" && log.task) void pollGenerationLog(log);
        }
    };

    const pollGenerationLog = async (log: GenerationLog, configOverride?: AiConfig, agentTaskId?: string) => {
        if (!log.task || activeLogIdsRef.current.has(log.id)) return;
        activeLogIdsRef.current.add(log.id);
        setRunning(true);
        setStartedAt((value) => value || performance.now());
        setResults((value) => (value.length ? value : [{ id: log.id, status: "pending" }]));
        const taskConfig = buildVideoConfig({ ...effectiveConfig, ...log.config }, log.task.model || log.model);
        try {
            for (let attempt = 0; attempt < 120; attempt += 1) {
                const state = await pollVideoGenerationTask(configOverride || taskConfig, log.task);
                if (state.status === "completed") {
                    const stored = await storeGeneratedVideo(state.result);
                    const nextVideo: GeneratedVideo = {
                        id: nanoid(),
                        url: stored.url,
                        storageKey: stored.storageKey,
                        durationMs: Date.now() - log.createdAt,
                        width: stored.width || 1280,
                        height: stored.height || 720,
                        bytes: stored.bytes,
                        mimeType: stored.mimeType,
                    };
                    setResults([{ id: nextVideo.id, status: "success", video: nextVideo }]);
                    if (agentTaskId) updateAgentTask(agentTaskId, { status: "succeeded", successCount: 1, failCount: 0, error: undefined });
                    await saveLog({ ...log, status: "success", durationMs: nextVideo.durationMs, video: nextVideo, error: undefined });
                    message.success(t("videoWorkbench.generated"));
                    return;
                }
                if (state.status === "failed") throw new Error(state.error);
                if (attempt === 119) throw new Error(t("videoWorkbench.timeout"));
                await delay(2500);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t("workbench.generationFailed");
            setResults([{ id: log.id, status: "failed", error: errorMessage }]);
            if (agentTaskId) updateAgentTask(agentTaskId, { status: "failed", successCount: 0, failCount: 1, error: errorMessage });
            await saveLog({ ...log, status: "failed", durationMs: Date.now() - log.createdAt, error: errorMessage });
            message.error(errorMessage);
        } finally {
            activeLogIdsRef.current.delete(log.id);
            if (!activeLogIdsRef.current.size) {
                setRunning(false);
                setStartedAt(0);
            }
        }
    };

    const previewGenerationLog = (log: GenerationLog) => {
        setPreviewLog(log);
        setActiveTab("results");
        setPrompt(log.prompt);
        setReferences(log.references || []);
        if (log.config.videoModel || log.model) updateConfig("videoModel", log.config.videoModel || log.model);
        if (log.config.size) updateConfig("size", log.config.size);
        if (log.config.vquality) updateConfig("vquality", log.config.vquality);
        if (log.config.videoSeconds) updateConfig("videoSeconds", log.config.videoSeconds);
        if (log.config.videoGenerateAudio) updateConfig("videoGenerateAudio", log.config.videoGenerateAudio);
        if (log.config.videoWatermark) updateConfig("videoWatermark", log.config.videoWatermark);
        if (log.config.videoMode) updateConfig("videoMode", log.config.videoMode);
        setResults(log.status === "pending" ? [{ id: log.id, status: "pending" }] : log.video ? [{ id: log.video.id, status: "success", video: log.video }] : [{ id: log.id, status: "failed", error: log.error || t("workbench.generationFailed") }]);
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
            <main className="thin-scrollbar flex-1 overflow-y-auto p-6">
                <div className="mx-auto max-w-6xl space-y-6">
                    {/* AI视频生成助手 - 无边框独立标题 */}
                    <div className="mb-6 text-center">
                        <h1 className="text-3xl font-bold text-stone-950 dark:text-stone-100">{t("videoWorkbench.title")}</h1>
                        <p className="mt-2 text-base text-blue-600 dark:text-blue-400">{t("videoWorkbench.subtitle")}</p>
                    </div>

                    {/* 主输入区卡片 */}
                    <div className="relative rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-950">
                        {/* 提示词库和我的资产 - 放在边框外右上角 */}
                        <div className="absolute -top-14 right-0 z-10 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPromptDialogOpen(true)}
                                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
                            >
                                <BookOpen className="size-4" />
                                <span>{t("videoWorkbench.promptLibrary")}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setAssetPickerOpen(true)}
                                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
                            >
                                <FolderPlus className="size-4" />
                                <span>{t("videoWorkbench.myAssets")}</span>
                            </button>
                        </div>

                        <div className="p-8">
                            {/* 文本输入框 */}
                            <div className="relative">
                                <Input.TextArea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="上传商品图，详细描述你要创作的视频商品信息和生成要求。"
                                    className={`!resize-none !rounded-xl !border-stone-200 !px-4 !pb-10 !pt-4 !text-base dark:!border-stone-800 transition-all duration-300 ${textareaExpanded ? "!min-h-[600px]" : "!min-h-[300px]"}`}
                                    maxLength={4000}
                                />

                                {/* 右下角：字数统计 + 展开按钮 */}
                                <div className="absolute bottom-3 right-3 flex items-center gap-3">
                                    <span className="text-sm text-stone-400">{promptLength} / 4000</span>
                                    <button
                                        type="button"
                                        onClick={() => setTextareaExpanded(!textareaExpanded)}
                                        className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-stone-600 transition hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
                                    >
                                        {textareaExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                        <span>{textareaExpanded ? t("videoWorkbench.collapse") : t("videoWorkbench.expand")}</span>
                                    </button>
                                </div>
                            </div>

                            {/* 参考图预览区 */}
                            {references.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {references.map((item, index) => (
                                        <div key={item.id} className="group relative size-16 shrink-0 overflow-hidden rounded-lg border border-stone-200 dark:border-stone-800">
                                            <img src={previewUrlFor(item.storageKey) || item.dataUrl} alt={item.name} className="size-full object-cover" />
                                            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{index + 1}</span>
                                            <button
                                                type="button"
                                                className="absolute right-1 top-1 hidden size-5 items-center justify-center rounded bg-black/60 text-white group-hover:flex"
                                                onClick={() => setReferences((value) => value.filter((ref) => ref.id !== item.id))}
                                            >
                                                <Trash2 className="size-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 图片压缩进度 */}
                            {compressing && (
                                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/50">
                                    <div className="mb-2 flex items-center justify-between text-sm">
                                        <span className="font-medium text-blue-900 dark:text-blue-100">正在压缩图片...</span>
                                        <span className="text-blue-700 dark:text-blue-300">{compressProgress}%</span>
                                    </div>
                                    <Progress
                                        percent={compressProgress}
                                        showInfo={false}
                                        strokeColor="#3b82f6"
                                        trailColor="#dbeafe"
                                    />
                                </div>
                            )}

                            {/* 底部控制栏 */}
                            <div className="mt-6 flex items-center justify-between gap-4">
                                {/* 左侧：加图按钮 */}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex size-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-400 dark:hover:bg-blue-900/50"
                                >
                                    <Plus className="size-5" />
                                </button>

                                {/* 中间：选择模型按钮 */}
                                <button
                                    type="button"
                                    onClick={() => setModelSettingsOpen(true)}
                                    className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-stone-600 dark:hover:bg-stone-800"
                                >
                                    <SlidersHorizontal className="size-4" />
                                    <span>{model ? modelOptionLabel(config, model) : "选择模型"}</span>
                                    <ChevronDown className="size-4 text-stone-400" />
                                </button>

                                {/* 右侧：积分 + 生成按钮 */}
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-medium text-stone-600 dark:text-stone-400">
                                        积分: {calculatedPoints !== null ? (
                                            <span className="text-orange-600">{calculatedPoints} 积分</span>
                                        ) : (
                                            <span className="text-stone-400">-</span>
                                        )}
                                    </span>
                                    <Button
                                        type="primary"
                                        size="large"
                                        shape="circle"
                                        icon={<ArrowRightIcon className="size-5" />}
                                        loading={running}
                                        disabled={!canGenerate || running}
                                        onClick={() => void generate()}
                                        className="!flex !size-12 !items-center !justify-center !bg-pink-500 !p-0 hover:!bg-pink-600"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tab切换区域 */}
                    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-950">
                        <Tabs
                            activeKey={activeTab}
                            onChange={setActiveTab}
                            className="[&_.ant-tabs-nav]:!mb-0 [&_.ant-tabs-nav]:border-b [&_.ant-tabs-nav]:border-stone-200 [&_.ant-tabs-nav]:px-6 dark:[&_.ant-tabs-nav]:border-stone-800"
                            items={[
                                {
                                    key: "logs",
                                    label: t("videoWorkbench.generationRecord"),
                                    children: (
                                        <div className="p-6">
                                            <LogPanel
                                                logs={logs}
                                                selectedLogIds={selectedLogIds}
                                                activeLogId={previewLog?.id}
                                                onSelectedLogIdsChange={setSelectedLogIds}
                                                onCreateSession={createSession}
                                                onDeleteSelected={() => setDeleteConfirmOpen(true)}
                                                onPreviewLog={previewGenerationLog}
                                            />
                                        </div>
                                    ),
                                },
                                {
                                    key: "results",
                                    label: t("videoWorkbench.generationResult"),
                                    children: (
                                        <div className="p-6">
                                            <div className="mb-4 flex items-center justify-between">
                                                <h2 className="text-xl font-semibold">{t("workbench.results")}</h2>
                                                {running ? <Tag className="m-0 px-2 py-1">{t("workbench.waiting", { time: formatDuration(elapsedMs) })}</Tag> : null}
                                            </div>
                                            {results.length ? (
                                                <div className="grid gap-4">
                                                    {results.map((result) =>
                                                        result.status === "success" && result.video ? (
                                                            <ResultVideoCard key={result.id} video={result.video} onDownload={downloadVideo} onSaveAsset={saveResultToAssets} onPublish={handlePublishVideo} />
                                                        ) : result.status === "failed" ? (
                                                            <FailedVideoCard key={result.id} error={result.error || t("workbench.generationFailed")} onRetry={retryResult} />
                                                        ) : (
                                                            <PendingVideoCard key={result.id} />
                                                        )
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 text-center dark:border-stone-700">
                                                    <VideoIcon className="mb-4 size-11 text-stone-400" />
                                                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("videoWorkbench.empty")} />
                                                </div>
                                            )}
                                        </div>
                                    ),
                                },
                            ]}
                        />
                    </div>
                </div>
            </main>

            {/* 隐藏的文件输入 */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                    void addReferences(event.target.files);
                    event.target.value = "";
                }}
            />

            {/* 模型设置弹窗 */}
            <ModelSettingsModal
                open={modelSettingsOpen}
                onClose={() => setModelSettingsOpen(false)}
                config={effectiveConfig}
                currentModel={model}
                onModelChange={(value) => updateConfig("videoModel", value)}
                onConfigChange={(key, value) => updateConfig(key, value)}
            />

            {/* 高级设置抽屉（保留但不使用） */}
            <Drawer title="高级参数设置" placement="right" width={480} open={settingsOpen} onClose={() => setSettingsOpen(false)}>
                <div className="space-y-6">
                    <VideoSettingsPanel config={effectiveConfig} onConfigChange={(key, value) => updateConfig(key, value)} theme={canvasThemes[useThemeStore.getState().theme]} showTitle={false} className="space-y-4" />
                </div>
            </Drawer>

            {/* 提示词选择对话框 */}
            <PromptSelectDialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen} onSelect={setPrompt} />

            {/* 资产选择器 */}
            <AssetPickerModal open={assetPickerOpen} defaultTab="my-assets" onInsert={(payload) => void insertPickedAsset(payload)} onClose={() => setAssetPickerOpen(false)} />

            {/* 删除确认对话框 */}
            <Modal title={t("workbench.deleteLogs")} open={deleteConfirmOpen} onCancel={() => setDeleteConfirmOpen(false)} onOk={deleteSelectedLogs} okText={t("common.delete")} okButtonProps={{ danger: true }} cancelText={t("common.cancel")}>
                {t("workbench.deleteLogsConfirm", { count: selectedLogIds.length })}
            </Modal>

            {/* 视频发布弹窗 */}
            {videoToPublish && (
                <PublishingModal
                    open={publishingModalOpen}
                    onClose={() => {
                        setPublishingModalOpen(false);
                        setVideoToPublish(null);
                    }}
                    onSuccess={handlePublishSuccess}
                    defaultVideoUrl={videoToPublish.url}
                />
            )}
        </div>
    );
}

// 组件保持不变
function ResultVideoCard({ video, onDownload, onSaveAsset, onPublish }: { video: GeneratedVideo; onDownload: (video: GeneratedVideo) => void; onSaveAsset: (video: GeneratedVideo) => void; onPublish?: (video: GeneratedVideo) => void }) {
    const { t } = useTranslation();
    return (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-background dark:border-stone-800">
            <video src={video.url} controls className="aspect-video w-full bg-black object-contain" />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-stone-200 px-3 py-2.5 dark:border-stone-800">
                <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                    <span>
                        {video.width}x{video.height}
                    </span>
                    <span>{formatBytes(video.bytes)}</span>
                    <span>{formatDuration(video.durationMs)}</span>
                </div>
                <div className="flex shrink-0 gap-1">
                    <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => onSaveAsset(video)}>
                        {t("common.addToAssets")}
                    </Button>
                    <Button size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(video)}>
                        {t("common.download")}
                    </Button>
                    {onPublish && (
                        <Button size="small" type="primary" icon={<Upload className="size-3.5" />} onClick={() => onPublish(video)}>
                            发布
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

function PendingVideoCard() {
    const { t } = useTranslation();
    return (
        <div className="relative aspect-video overflow-hidden rounded-lg border border-dashed border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-900">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-stone-500 dark:text-stone-400">
                <LoaderCircle className="size-6 animate-spin" />
                <span>{t("workbench.generating")}</span>
            </div>
        </div>
    );
}

function FailedVideoCard({ error, onRetry }: { error: string; onRetry: () => void }) {
    const { t } = useTranslation();
    return (
        <div className="overflow-hidden rounded-lg border border-red-200 bg-red-50 dark:border-red-950 dark:bg-red-950/20">
            <div className="flex aspect-video flex-col items-center justify-center gap-3 p-5 text-center">
                <div className="text-sm font-medium text-red-600 dark:text-red-300">{t("workbench.failed")}</div>
                <Typography.Paragraph ellipsis={{ rows: 4 }} className="!mb-0 !text-xs !text-red-500 dark:!text-red-300">
                    {error}
                </Typography.Paragraph>
            </div>
            <div className="flex justify-end border-t border-red-200 p-3 dark:border-red-950">
                <Button size="small" danger onClick={onRetry}>
                    {t("workbench.retry")}
                </Button>
            </div>
        </div>
    );
}

function LogPanel({
    logs,
    selectedLogIds,
    activeLogId,
    onSelectedLogIdsChange,
    onCreateSession,
    onDeleteSelected,
    onPreviewLog,
}: {
    logs: GenerationLog[];
    selectedLogIds: string[];
    activeLogId?: string;
    onSelectedLogIdsChange: (ids: string[]) => void;
    onCreateSession: () => void;
    onDeleteSelected: () => void;
    onPreviewLog: (log: GenerationLog) => void;
}) {
    const { t } = useTranslation();
    const allSelected = Boolean(logs.length) && selectedLogIds.length === logs.length;
    const toggleAll = () => onSelectedLogIdsChange(allSelected ? [] : logs.map((log) => log.id));

    return (
        <>
            <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold">{t("videoWorkbench.historyRecord")}</h3>
                <div className="flex gap-2">
                    <Button size="small" icon={<Plus className="size-3.5" />} onClick={onCreateSession}>
                        {t("workbench.new")}
                    </Button>
                    <Button size="small" icon={<CheckSquare className="size-3.5" />} disabled={!logs.length} onClick={toggleAll}>
                        {allSelected ? t("common.cancel") : t("workbench.selectAll")}
                    </Button>
                    <Button size="small" danger icon={<Trash2 className="size-3.5" />} disabled={!selectedLogIds.length} onClick={onDeleteSelected}>
                        {t("common.delete")}
                    </Button>
                </div>
            </div>
            <div className="space-y-3">
                {logs.map((log) => (
                    <LogCard key={log.id} log={log} selected={selectedLogIds.includes(log.id)} active={activeLogId === log.id} onSelectedChange={(checked) => onSelectedLogIdsChange(checked ? [...selectedLogIds, log.id] : selectedLogIds.filter((id) => id !== log.id))} onClick={() => onPreviewLog(log)} />
                ))}
                {!logs.length ? <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-stone-300 text-center text-sm text-stone-500 dark:border-stone-700">{t("workbench.noLogs")}</div> : null}
            </div>
        </>
    );
}

function LogCard({ log, selected, active, onSelectedChange, onClick }: { log: GenerationLog; selected: boolean; active: boolean; onSelectedChange: (checked: boolean) => void; onClick: () => void }) {
    const { t } = useTranslation();
    const config = useConfigStore((state) => state.config);
    return (
        <button type="button" className={`block w-full rounded-lg border p-3 text-left transition ${active ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-stone-200 bg-background hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"}`} onClick={onClick}>
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                <Checkbox className="mt-0.5" checked={selected} onClick={(event) => event.stopPropagation()} onChange={(event) => onSelectedChange(event.target.checked)} />
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold leading-5">{log.title}</div>
                    <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                        {log.model ? modelOptionLabel(config, log.model) : "未知模型"}
                    </div>
                </div>
                <div className="grid justify-items-end gap-2">
                    <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color={log.status === "success" ? "blue" : log.status === "pending" ? "processing" : "red"}>
                        {t(`workbench.${log.status === "success" ? "success" : log.status === "pending" ? "generating" : "failed"}`)}
                    </Tag>
                    <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color="green">
                        {formatDuration(log.durationMs)}
                    </Tag>
                </div>
            </div>
        </button>
    );
}

// 辅助函数保持不变
async function readStoredLogs() {
    if (typeof window === "undefined") return [];
    try {
        const logs: GenerationLog[] = [];
        await logStore.iterate<GenerationLog, void>((value) => {
            logs.push(value);
        });
        return (await Promise.all(logs.map(normalizeLog))).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch {
        return [];
    }
}

async function normalizeLog(log: Partial<GenerationLog>): Promise<GenerationLog> {
    const video = log.video?.storageKey ? { ...log.video, url: await resolveMediaUrl(log.video.storageKey, log.video.url) } : log.video;
    const references = await Promise.all(
        (log.references || []).map(async (item) => {
            void ensureImagePreview(item.storageKey);
            return { ...item, dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl) };
        }),
    );
    const config = normalizeLogConfig(log);
    return {
        id: log.id || nanoid(),
        createdAt: log.createdAt || Date.now(),
        title: log.title || log.model || i18n.t("workbench.untitled"),
        prompt: log.prompt || "",
        time: log.time || new Date().toLocaleString(i18n.resolvedLanguage, { hour12: false }),
        model: log.model || config.videoModel || "",
        config,
        references,
        durationMs: log.durationMs || 0,
        size: log.size || config.size || "",
        resolution: normalizeResolution(log.resolution || config.vquality || ""),
        seconds: log.seconds || config.videoSeconds || "",
        status: log.status || "success",
        task: log.task,
        video,
        error: log.error,
    };
}

function serializeLog(log: GenerationLog): GenerationLog {
    return {
        ...log,
        references: log.references.map((item) => ({ ...item, dataUrl: item.storageKey ? "" : item.dataUrl })),
        video: log.video?.storageKey ? { ...log.video, url: "" } : log.video,
    };
}

function normalizeLogConfig(log: Partial<GenerationLog>): GenerationLogConfig {
    return {
        model: log.config?.model || log.model || "",
        videoModel: log.config?.videoModel || log.model || "",
        size: log.config?.size || log.size || "",
        vquality: normalizeResolution(log.config?.vquality || log.resolution || ""),
        videoSeconds: log.config?.videoSeconds || log.seconds || "",
        videoGenerateAudio: log.config?.videoGenerateAudio || "true",
        videoWatermark: log.config?.videoWatermark || "false",
        videoMode: log.config?.videoMode === "reference" ? "reference" : "frames",
    };
}

function buildLog({ prompt, model, config, references, durationMs, status, task, video, error }: { prompt: string; model: string; config: AiConfig; references: ReferenceImage[]; durationMs: number; status: GenerationLog["status"]; task?: VideoGenerationTask; video?: GeneratedVideo; error?: string }): GenerationLog {
    const logConfig = {
        model: config.model,
        videoModel: config.videoModel,
        size: config.size,
        vquality: normalizeResolution(config.vquality),
        videoSeconds: config.videoSeconds,
        videoGenerateAudio: config.videoGenerateAudio,
        videoWatermark: config.videoWatermark,
        videoMode: config.videoMode === "reference" ? "reference" : "frames",
    };
    return {
        id: nanoid(),
        createdAt: Date.now(),
        title: prompt.slice(0, 12) || i18n.t("workbench.untitled"),
        prompt,
        time: new Date().toLocaleString(i18n.resolvedLanguage, { hour12: false }),
        model,
        config: logConfig,
        references,
        durationMs,
        size: logConfig.size,
        resolution: logConfig.vquality,
        seconds: logConfig.videoSeconds,
        status,
        task,
        video,
        error,
    };
}

function buildVideoConfig(config: AiConfig, model: string): AiConfig {
    return {
        ...config,
        model,
        videoModel: model,
        size: normalizeVideoSize(config.size),
        videoSeconds: normalizeVideoSeconds(config.videoSeconds),
        vquality: normalizeResolution(config.vquality),
        videoGenerateAudio: String(boolConfig(config.videoGenerateAudio, true)),
        videoWatermark: String(boolConfig(config.videoWatermark, false)),
        videoMode: config.videoMode === "reference" ? "reference" : "frames",
    };
}

function normalizeVideoSeconds(value: string) {
    if (String(value).trim() === "-1") return "-1";
    return clampVideoSeconds(value);
}

function normalizeVideoSize(value: string) {
    return normalizeVideoSizeValue(value);
}

function normalizeResolution(value: string) {
    return normalizeVideoResolutionValue(value);
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
