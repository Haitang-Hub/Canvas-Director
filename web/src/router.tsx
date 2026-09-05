import { lazy, Suspense } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";

import { AnalyticsTracker } from "@/components/layout/analytics-tracker";
import UserLayout from "@/layouts/user-layout";
import AssetsPage from "@/pages/assets";
import CanvasPage from "@/pages/canvas";
import CanvasProjectPage from "@/pages/canvas/project";
import ConfigPage from "@/pages/config";
import HomePage from "@/pages/home";
import ImagePage from "@/pages/image";
import NotFound from "@/pages/not-found";
import PromptsPage from "@/pages/prompts";
import VideoPage from "@/pages/video";

// 3D 导演台依赖 three.js，体积较大，按需懒加载
const DirectorPage = lazy(() => import("@/pages/director"));
const DirectorEditorPage = lazy(() => import("@/pages/director/editor-page"));

function LazyDirectorPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-full items-center justify-center text-sm text-stone-400">
                    3D 导演台加载中…
                </div>
            }
        >
            <DirectorPage />
        </Suspense>
    );
}

function LazyDirectorEditorPage() {
    return (
        <Suspense fallback={<div className="h-dvh w-full bg-black" />}>
            <DirectorEditorPage />
        </Suspense>
    );
}

export const router = createBrowserRouter([
    {
        element: (
            <UserLayout>
                <AnalyticsTracker />
                <Outlet />
            </UserLayout>
        ),
        children: [
            { path: "/", element: <HomePage /> },
            { path: "/image", element: <ImagePage /> },
            { path: "/video", element: <VideoPage /> },
            { path: "/director", element: <LazyDirectorPage /> },
            { path: "/assets", element: <AssetsPage /> },
            { path: "/prompts", element: <PromptsPage /> },
            { path: "/canvas", element: <CanvasPage /> },
            { path: "/canvas/:id", element: <CanvasProjectPage /> },
            { path: "/config", element: <ConfigPage /> },
        ],
    },
    {
        // 3D 导演台编辑器：全屏独立页，不带顶部导航
        path: "/director/editor",
        element: (
            <>
                <AnalyticsTracker />
                <LazyDirectorEditorPage />
            </>
        ),
    },
    { path: "*", element: <NotFound /> },
]);
