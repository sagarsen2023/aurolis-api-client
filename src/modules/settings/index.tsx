import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import type { SettingsSectionId } from "@/constants/settings";
import { AppearanceSection } from "./appearance-section";
import { AssistantsSection } from "./assistants-section";
import { DataSection } from "./data-section";
import { GeneralSection } from "./general-section";
import { SettingsNav } from "./settings-nav";
import { ShortcutsSection } from "./shortcuts-section";

const SECTIONS = {
  appearance: AppearanceSection,
  assistants: AssistantsSection,
  general: GeneralSection,
  shortcuts: ShortcutsSection,
  data: DataSection,
} as const;

function SettingsModule() {
  const [active, setActive] = useState<SettingsSectionId>("appearance");
  const ActiveSection = SECTIONS[active];

  return (
    <div className="mx-auto flex w-full max-w-270 flex-col gap-6 px-8 pt-8 pb-16">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Appearance, AI assistants, storage and workspace defaults."
      />

      <div className="flex flex-col gap-8 md:flex-row md:gap-12">
        <aside className="w-full shrink-0 md:w-56">
          <SettingsNav active={active} onSelect={setActive} />
        </aside>

        <div className="min-w-0 flex-1">
          <ActiveSection key={active} />
        </div>
      </div>
    </div>
  );
}

export default SettingsModule;
