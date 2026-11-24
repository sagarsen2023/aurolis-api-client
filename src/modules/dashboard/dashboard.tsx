import { useAtomValue } from "jotai";
import { Bookmark, Globe, Loader, Plus, Send, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { currentEnvironmentAtom } from "@/context/workspace-context";
import { DASHBOARD_STATS, DASHBOARD_USER } from "@/constants/dashboard";
import RecentRequests from "./recent-requests";
import ResponseHealth from "./response-health";
import StatCard from "./stat-card";

function Dashboard() {
  const environment = useAtomValue(currentEnvironmentAtom);
  const stats = DASHBOARD_STATS;

  return (
    <div className="mx-auto flex w-full max-w-310 flex-col gap-4 px-8 pt-8 pb-12">
      <PageHeader
        className="mb-4"
        size="display"
        title={
          <>
            Welcome back{" "}
            <span className="text-mute">@{DASHBOARD_USER.handle}</span>
          </>
        }
        description="Here’s an overview of your workspace."
        actions={
          <>
            <Button
              variant="outline"
              size="lg"
              className="h-10 gap-2 px-5 text-[15px]"
            >
              <Upload strokeWidth={1.8} />
              Import
            </Button>
            <Button
              size="lg"
              className="h-10 gap-2 px-5 text-[15px] hover:bg-lav-hover"
            >
              <Plus strokeWidth={1.8} />
              New request
            </Button>
          </>
        }
      />

      <section
        aria-label="Workspace summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          title="Requests"
          badge={`${stats.collections} collections`}
          icon={Send}
          value={stats.requests}
        />
        <StatCard
          title="Saved examples"
          badge="Kept responses"
          icon={Loader}
          value={stats.savedExamples}
        />
        <StatCard
          title="Environments"
          badge={`Active: ${environment.name}`}
          icon={Globe}
          value={stats.environments}
        />
        <StatCard
          title="Unsaved changes"
          badge={
            stats.unsavedChanges === 0
              ? "All saved"
              : `${stats.unsavedChanges} unsaved`
          }
          icon={Bookmark}
          value={stats.unsavedChanges}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.08fr_1fr]">
        <RecentRequests />
        <ResponseHealth />
      </div>
    </div>
  );
}

export default Dashboard;
