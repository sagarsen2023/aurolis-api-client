import { useState } from "react";
import { useAtomValue } from "jotai";
import { PageHeader } from "@/components/page-header";
import type { SettingsSectionId } from "@/constants/settings";
import { availableUpdateAtom } from "@/context/update-context";
import { AppearanceSection } from "./appearance-section";
import { AssistantsSection } from "./assistants-section";
import { DataSection } from "./data-section";
import { GeneralSection } from "./general-section";
import { SettingsNav } from "./settings-nav";
import { ShortcutsSection } from "./shortcuts-section";
import { UpdatesSection } from "./updates-section";

const SECTIONS = {
  appearance: AppearanceSection,
  assistants: AssistantsSection,
  general: GeneralSection,
  shortcuts: ShortcutsSection,
  data: DataSection,
  updates: UpdatesSection,
} as const;

function SettingsModule() {
  const hasUpdate = useAtomValue(availableUpdateAtom) !== null;
  const [active, setActive] = useState<SettingsSectionId>(
    hasUpdate ? "updates" : "appearance",
  );
  const ActiveSection = SECTIONS[active];

  return (
    <div className="mx-auto flex w-full max-w-270 flex-col gap-6 px-8 pt-8 pb-16">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Appearance, AI assistants, storage, workspace defaults and updates."
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
