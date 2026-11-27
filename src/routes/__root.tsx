import { createRootRoute, Outlet } from "@tanstack/react-router";
import ThemeToast from "@/components/ui/theme-toast";
import { useWindowZoom } from "@/hooks/use-zoom";
import TitleBar from "@/modules/layout/title-bar";

function RootLayout() {
  useWindowZoom();

  return (
    <div className="flex h-screen flex-col">
      <ThemeToast />
      <TitleBar />
      <div className="relative min-h-0 flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
