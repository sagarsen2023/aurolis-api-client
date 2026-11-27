import { ThemeSwitch } from "@/components/ui/theme-switch";
import AddWorkspaceSheet from "@/modules/workspace/add-workspace-sheet";
import PublishSheet from "@/modules/workspace/publish-sheet";
import WorkspaceSettingsDialog from "@/modules/workspace/workspace-settings-dialog";
import CommitDialog from "@/modules/source-control/commit-dialog";
import UpdateDialog from "@/modules/updates/update-dialog";
import BranchSwitcher from "./branch-switcher";
import BreadCrumb from "./breadcrumb";
import EnvironmentSelect from "./environment-select";
import PullButton from "./pull-button";
import SavePill from "./save-pill";
import WorkspaceSwitcher from "./workspace-switcher";

function Header() {
  return (
    <header className="flex h-15 shrink-0 items-center justify-between gap-4 border-b border-line bg-background px-5">
      <div className="flex min-w-0 items-center gap-3">
        <WorkspaceSwitcher />
        <BreadCrumb />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <EnvironmentSelect />
        <BranchSwitcher />
        <PullButton />
        <ThemeSwitch />
        <SavePill />
      </div>
      <AddWorkspaceSheet />
      <PublishSheet />
      <WorkspaceSettingsDialog />
      <CommitDialog />
      <UpdateDialog />
    </header>
  );
}

export default Header;
