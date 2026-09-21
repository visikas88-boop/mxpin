import { FileText, ImagePlus, Images, Maximize2, Video } from "lucide-react";

export const navigationTools = [
    {
        slug: "canvas",
        icon: Maximize2,
        color: "text-blue-500",
    },
    {
        slug: "image",
        icon: ImagePlus,
        color: "text-green-500",
    },
    {
        slug: "video",
        icon: Video,
        color: "text-purple-500",
    },
    {
        slug: "prompts",
        icon: FileText,
        color: "text-orange-500",
    },
    {
        slug: "assets",
        icon: Images,
        color: "text-pink-500",
    },
] as const;

export type NavigationToolSlug = (typeof navigationTools)[number]["slug"];
