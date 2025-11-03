import { Suspense, type ComponentType } from "react";
import { Routes, Route } from "react-router-dom";
import { FullScreenLoader } from "@/components/layout/FullScreenLoader";
import { lazyWithPreload, type LazyWithPreload } from "@/lib/lazyWithPreload";
import { RoleGuard } from "./guards/RoleGuard";
import type { AppUserRole } from "@/modules/auth";

const IndexPage = lazyWithPreload(() => import("@/modules/client/landing/ClientLandingPage"));
const AdminConsolePage = lazyWithPreload(() => import("@/modules/admin/console/AdminConsolePage"));
const AdminQrToolsPage = lazyWithPreload(() => import("@/modules/admin/qr-tools/AdminQrToolsPage"));
const MerchantPortalPage = lazyWithPreload(() => import("@/modules/merchant/portal/MerchantPortalPage"));
const MerchantReceiptsPage = lazyWithPreload(() => import("@/modules/merchant/receipts/MerchantReceiptsPage"));
const NotFoundPage = lazyWithPreload(() => import("@/modules/common/not-found/NotFoundPage"));

type RouteEntry = {
  path: string;
  Component: LazyWithPreload<ComponentType<object>>;
  roles?: AppUserRole[];
};

const routeConfig: RouteEntry[] = [
  { path: "/", Component: IndexPage },
  { path: "/admin", Component: AdminConsolePage, roles: ["admin"] },
  { path: "/admin/tools/qr", Component: AdminQrToolsPage, roles: ["admin"] },
  { path: "/merchant", Component: MerchantPortalPage, roles: ["merchant", "admin"] },
  { path: "/merchant/receipts", Component: MerchantReceiptsPage, roles: ["merchant", "admin"] },
  { path: "*", Component: NotFoundPage },
];

const routePrefetchers = new Map<string, () => Promise<void>>();
routeConfig.forEach(({ path, Component }) => {
  routePrefetchers.set(path, async () => {
    if (typeof Component.preload === "function") {
      await Component.preload();
    }
  });
});

export const prefetchRoute = async (path: string) => {
  const prefetch = routePrefetchers.get(path);
  await prefetch?.();
};

export const AppRouter = () => (
  <Suspense fallback={<FullScreenLoader />}>
    <Routes>
      {routeConfig.map(({ path, Component, roles }) => (
        <Route
          key={path}
          path={path}
          element={
            <RoleGuard allowedRoles={roles}>
              <Component />
            </RoleGuard>
          }
        />
      ))}
    </Routes>
  </Suspense>
);
