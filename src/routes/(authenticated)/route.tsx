import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import Header from "@/modules/layout/header";
import SideBar from "@/modules/layout/sidebar";
import { getGithubToken } from "@/utils/local-storage";

export const Route = createFileRoute("/(authenticated)")({
  component: DashboardLayout,
  beforeLoad: () => {
    const token = getGithubToken();
    if (!token) {
      throw redirect({ to: "/sign-in", replace: true, });
    }
  },
});

function DashboardLayout() {
  return (
    <div className="relative flex h-full w-full">
      <SideBar />
      {/* Main Content */}
      <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <Header />

        {/* Page Content */}
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
