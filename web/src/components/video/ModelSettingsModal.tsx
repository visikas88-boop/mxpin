import { Modal, Radio, Space } from "antd";
import { CheckCircle2 } from "lucide-react";
import { VideoSettingsPanel } from "@/components/video-settings-panel";
import { canvasThemes } from "@/lib/canvas-theme";
import { modelOptionLabel, selectableModelsByCapability, useConfigStore, type AiConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";

interface ModelSettingsModalProps {
    open: boolean;
    onClose: () => void;
    config: AiConfig;
    currentModel: string;
    onModelChange: (model: string) => void;
    onConfigChange: <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
}

export function ModelSettingsModal({ open, onClose, config, currentModel, onModelChange, onConfigChange }: ModelSettingsModalProps) {
    const theme = useThemeStore((state) => state.theme);
    const videoModels = selectableModelsByCapability(config, "video");

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={750}
            centered
            closeIcon={null}
            mask={true}
            maskClosable={true}
            styles={{
                content: {
                    padding: 0,
                    borderRadius: "20px",
                    overflow: "hidden",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                },
                body: {
                    padding: 0,
                },
                mask: {
                    backdropFilter: "blur(4px)",
                    backgroundColor: "rgba(0, 0, 0, 0.3)",
                },
            }}
            className="[&_.ant-modal-content]:shadow-2xl"
        >
            <div className="flex max-h-[560px]">
                {/* 左侧：模型列表 */}
                <div className="w-64 shrink-0 border-r border-stone-200 bg-gradient-to-b from-stone-50 to-stone-100 p-4 dark:border-stone-800 dark:from-stone-900 dark:to-stone-950">
                    <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        选择模型
                    </div>
                    <Radio.Group value={currentModel} onChange={(e) => onModelChange(e.target.value)} className="w-full">
                        <Space direction="vertical" className="w-full" size={6}>
                            {videoModels.map((modelValue) => {
                                const decoded = modelValue.indexOf('::') > -1 ? modelValue.split('::') : null;
                                const channelId = decoded?.[0];
                                const modelName = decoded?.[1] || modelValue;
                                const channel = channelId ? config.channels.find((ch) => ch.id === channelId) : null;
                                const modelData = channel?.models.find((m) => m.name === modelName);

                                return (
                                    <Radio
                                        key={modelValue}
                                        value={modelValue}
                                        className="group m-0 w-full rounded-xl border border-transparent px-3 py-2.5 transition hover:border-blue-300 hover:bg-white/80 dark:hover:border-blue-800 dark:hover:bg-stone-800/80 [&.ant-radio-wrapper-checked]:border-blue-500 [&.ant-radio-wrapper-checked]:bg-white [&.ant-radio-wrapper-checked]:shadow-sm dark:[&.ant-radio-wrapper-checked]:border-blue-600 dark:[&.ant-radio-wrapper-checked]:bg-stone-800"
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                                                    {modelName}
                                                </div>
                                                {modelData?.description ? (
                                                    <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400 line-clamp-2">
                                                        {modelData.description}
                                                    </div>
                                                ) : channel ? (
                                                    <div className="mt-0.5 truncate text-xs text-stone-500 dark:text-stone-400">
                                                        {channel.name}
                                                    </div>
                                                ) : null}
                                            </div>
                                            {currentModel === modelValue && (
                                                <CheckCircle2 className="size-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                                            )}
                                        </div>
                                    </Radio>
                                );
                            })}
                        </Space>
                    </Radio.Group>
                </div>

                {/* 右侧：高级设置 */}
                <div className="flex-1 overflow-y-auto bg-white p-4 dark:bg-stone-950">
                    <div className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        高级设置
                    </div>
                    <div className="space-y-3">
                        <VideoSettingsPanel
                            config={config}
                            onConfigChange={onConfigChange}
                            theme={canvasThemes[theme]}
                            showTitle={false}
                            className="space-y-3 [&_label]:text-xs [&_label]:font-medium [&_.ant-select]:!text-sm [&_.ant-input]:!text-sm"
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
}
