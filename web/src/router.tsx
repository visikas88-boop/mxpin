import { createBrowserRouter, Outlet, Navigate } from "react-router-dom";

import { AnalyticsTracker } from "@/components/layout/analytics-tracker";
import { ProtectedRoute } from "@/components/auth/protected-route";
import UserLayout from "@/layouts/user-layout";
import AssetsPage from "@/pages/assets";
import CanvasPage from "@/pages/canvas";
import CanvasProjectPage from "@/pages/canvas/project";
import HomePage from "@/pages/home";
import ImagePage from "@/pages/image";
import LoginPage from "@/pages/login";
import AdminLoginPage from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import TestModelPage from "@/pages/test-models";
import NotFound from "@/pages/not-found";
import PromptsPage from "@/pages/prompts";
import VideoPage from "@/pages/video";
import RechargePage from "@/pages/recharge";
import SocialAccountsPage from "@/pages/social-accounts";
import PublishingHistoryPage from "@/pages/publishing-history";
import OAuthCallbackPage from "@/pages/oauth-callback";

export const router = createBrowserRouter([
    {
        element: (
            <ProtectedRoute>
                <UserLayout>
                    <AnalyticsTracker />
                    <Outlet />
                </UserLayout>
            </ProtectedRoute>
        ),
        children: [
            { path: "/", element: <HomePage /> },
            { path: "/image", element: <ImagePage /> },
            { path: "/video", element: <VideoPage /> },
            { path: "/assets", element: <AssetsPage /> },
            { path: "/prompts", element: <PromptsPage /> },
            { path: "/canvas", element: <CanvasPage /> },
            { path: "/canvas/:id", element: <CanvasProjectPage /> },
            { path: "/config", element: <Navigate to="/admin/dashboard" replace /> },
            { path: "/recharge", element: <RechargePage /> },
            { path: "/social-accounts", element: <SocialAccountsPage /> },
            { path: "/publishing-history", element: <PublishingHistoryPage /> },
        ],
    },
    { path: "/login", element: <LoginPage /> },
    { path: "/oauth/callback", element: <OAuthCallbackPage /> },
    { path: "/admin/login", element: <AdminLoginPage /> },
    { path: "/admin/*", element: <AdminDashboard /> },
    { path: "/test-models", element: <TestModelPage /> },
    { path: "*", element: <NotFound /> },
]);
