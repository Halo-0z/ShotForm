import { createRouter, createWebHistory } from "vue-router"
import type { RouteRecordRaw } from "vue-router"

const routes: RouteRecordRaw[] = [
    {
        path: "/",
        name: "Home",
        component: () => import("@/views/Home.vue"),
        meta: { title: "首页" },
    },
    {
        path: "/upload",
        name: "Upload",
        component: () => import("@/views/Upload.vue"),
        meta: { title: "上传分析", workbenchPage: true },
    },
    {
        path: "/analysis",
        name: "Analysis",
        component: () => import("@/views/Analysis.vue"),
        meta: { title: "姿势分析" },
    },
    {
        path: "/compare",
        name: "Compare",
        component: () => import("@/views/Compare.vue"),
        meta: { title: "球星对比" },
    },
    {
        path: "/templates",
        name: "Templates",
        component: () => import("@/views/Templates.vue"),
        meta: { title: "球星模板管理" },
    },
    {
        path: "/history",
        name: "History",
        component: () => import("@/views/History.vue"),
        meta: { title: "历史记录" },
    },
    {
        path: "/tray-menu",
        name: "TrayMenu",
        component: () => import("@/views/TrayMenu.vue"),
        meta: { title: "ShotForm", trayPanel: true },
    },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

router.beforeEach((to, _from, next) => {
    document.title = `${to.meta.title || "投篮分析"} - ShotForm 篮球投篮姿势分析`
    next()
})

export default router
