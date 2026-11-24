import { createRootRoute, Outlet } from "@tanstack/react-router";
import ThemeToast from "@/components/ui/theme-toast";
import TitleBar from "@/modules/layout/title-bar";

export const Route = createRootRoute({
  component: () => (
    <div className="flex h-screen flex-col">
      <ThemeToast />
      <TitleBar />
      <div className="relative min-h-0 flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  ),
});
