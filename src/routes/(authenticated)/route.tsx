import { createFileRoute, Outlet } from "@tanstack/react-router";
import Header from "@/modules/layout/header";
import SideBar from "@/modules/layout/sidebar";

export const Route = createFileRoute("/(authenticated)")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="relative flex min-h-screen w-full">
      <SideBar />
      {/* Main Content */}
      <div className="relative flex w-full min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <Header />

        {/* Page Content */}
        <main className="mt-20 flex-1 overflow-auto px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
