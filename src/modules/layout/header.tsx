import { ThemeSwitch } from "@/components/ui/theme-switch";
import AddWorkspaceSheet from "@/modules/workspace/add-workspace-sheet";
import PublishSheet from "@/modules/workspace/publish-sheet";
import BreadCrumb from "./breadcrumb";
import EnvironmentSelect from "./environment-select";
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
        <ThemeSwitch />
        <SavePill />
      </div>
      <AddWorkspaceSheet />
      <PublishSheet />
    </header>
  );
}

export default Header;
