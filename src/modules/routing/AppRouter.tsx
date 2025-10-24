import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { Routes, Route } from "react-router-dom";
import { Suspense } from "react";
import { FullScreenLoader } from "@/components/layout/FullScreenLoader";

const IndexPage = lazy(() => import("@/modules/client/landing/ClientLandingPage"));
const AdminConsolePage = lazy(() => import("@/modules/admin/console/AdminConsolePage"));
const AdminQrToolsPage = lazy(() => import("@/modules/admin/qr-tools/AdminQrToolsPage"));
const MerchantPortalPage = lazy(() => import("@/modules/merchant/portal/MerchantPortalPage"));
const MerchantReceiptsPage = lazy(() => import("@/modules/merchant/receipts/MerchantReceiptsPage"));
const NotFoundPage = lazy(() => import("@/modules/common/not-found/NotFoundPage"));

type RouteEntry = {
  path: string;
  Component: LazyExoticComponent<ComponentType<object>>;
};

const routeConfig: RouteEntry[] = [
  { path: "/", Component: IndexPage },
  { path: "/admin", Component: AdminConsolePage },
  { path: "/admin/tools/qr", Component: AdminQrToolsPage },
  { path: "/merchant", Component: MerchantPortalPage },
  { path: "/merchant/receipts", Component: MerchantReceiptsPage },
  { path: "*", Component: NotFoundPage },
];

export const AppRouter = () => (
  <Suspense fallback={<FullScreenLoader />}>
    <Routes>
      {routeConfig.map(({ path, Component }) => (
        <Route key={path} path={path} element={<Component />} />
      ))}
    </Routes>
  </Suspense>
);
