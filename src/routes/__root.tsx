import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import TitleBar from "@/modules/layout/title-bar";

export const Route = createRootRoute({
  component: () => (
    <div className="flex h-screen flex-col">
      <TitleBar />
      <div className="relative min-h-0 flex-1 overflow-auto">
        <Outlet />
      </div>
      <TanStackRouterDevtools />
    </div>
  ),
});
