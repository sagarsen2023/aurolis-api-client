import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import Header from "@/modules/layout/header";
import SideBar from "@/modules/layout/sidebar";
import { authService } from "@/services/auth.service";
import { useWorkspaceBootstrap } from "@/hooks/use-workspaces";
import { useEditorStateSync } from "@/hooks/use-editor-state-sync";
import { useRealtimeEventsListener } from "@/hooks/use-realtime";
import { useUpdateCheck } from "@/hooks/use-update-check";

export const Route = createFileRoute("/(authenticated)")({
  component: DashboardLayout,
  beforeLoad: async () => {
    const canEnter = await authService.canEnterApp();
    if (!canEnter) {
      throw redirect({ to: "/sign-in", replace: true });
    }
  },
});

function DashboardLayout() {
  useWorkspaceBootstrap();
  useEditorStateSync();
  useRealtimeEventsListener();
  useUpdateCheck();
  return (
    <div className="relative flex h-full w-full">
      <SideBar />
      <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <Header />

        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
