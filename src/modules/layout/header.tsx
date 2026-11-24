import { ThemeSwitch } from "@/components/ui/theme-switch";
import BreadCrumb from "./breadcrumb";

function Header() {
  return (
    <header className="fixed z-10 flex w-[calc(100vw-68px)] items-center justify-between bg-background/30 px-6 py-4 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <BreadCrumb />
      </div>
      <div className="flex items-center gap-4">
        <ThemeSwitch />
      </div>
    </header>
  );
}

export default Header;
