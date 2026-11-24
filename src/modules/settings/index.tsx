import { useEffect, useState } from "react";
import {
  SETTINGS_SECTION_IDS,
  type SettingsSectionId,
} from "@/constants/settings";
import { AppearanceSection } from "./appearance-section";
import { AssistantsSection } from "./assistants-section";
import { DataSection } from "./data-section";
import { GeneralSection } from "./general-section";
import { SettingsNav } from "./settings-nav";
import { ShortcutsSection } from "./shortcuts-section";

function SettingsModule() {
  const [active, setActive] = useState<SettingsSectionId>("appearance");

  useEffect(() => {
    const sections = SETTINGS_SECTION_IDS.map((id) =>
      document.getElementById(id),
    ).filter((node): node is HTMLElement => node !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target.id;
        if (id && SETTINGS_SECTION_IDS.includes(id as SettingsSectionId)) {
          setActive(id as SettingsSectionId);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.2, 0.6] },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const select = (id: SettingsSectionId) => {
    setActive(id);
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1080px] gap-10 px-8 pt-8 pb-16">
      <aside className="sticky top-6 hidden w-52 shrink-0 self-start md:block">
        <p className="text-[13px] text-dim">Preferences</p>
        <h1 className="mt-1 text-[32px] leading-none font-medium tracking-[-0.04em] text-foreground">
          Settings
        </h1>
        <p className="mt-2 mb-5 text-[13px] leading-snug text-mute">
          Appearance, AI assistants and workspace defaults.
        </p>
        <SettingsNav active={active} onSelect={select} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-10">
        <div className="md:hidden">
          <p className="text-[13px] text-dim">Preferences</p>
          <h1 className="mt-1 text-[32px] leading-none font-medium tracking-[-0.04em]">
            Settings
          </h1>
          <p className="mt-2 text-[13px] text-mute">
            Appearance, AI assistants and workspace defaults.
          </p>
          <div className="mt-4">
            <SettingsNav active={active} onSelect={select} />
          </div>
        </div>
        <AppearanceSection />
        <AssistantsSection />
        <GeneralSection />
        <ShortcutsSection />
        <DataSection />
      </div>
    </div>
  );
}

export default SettingsModule;
