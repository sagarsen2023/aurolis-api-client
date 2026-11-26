import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface EditorSection {
  value: string;
  label: string;
  count?: number;
  content: ReactNode;
}

function EditorSectionTabs({
  sections,
  defaultValue,
  label,
}: Readonly<{
  sections: EditorSection[];
  defaultValue: string;
  label: string;
}>) {
  return (
    <Tabs defaultValue={defaultValue} className="min-h-0 flex-1 gap-0">
      <TabsList variant="line" aria-label={label} className="px-5">
        {sections.map((section) => (
          <TabsTrigger key={section.value} value={section.value}>
            {section.label}
            {section.count ? (
              <span className="text-dim">{section.count}</span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {sections.map((section) => (
        <TabsContent
          key={section.value}
          value={section.value}
          className="min-h-0"
        >
          <ScrollArea className="h-full">
            <div className="px-5 pt-3 pb-6">{section.content}</div>
          </ScrollArea>
        </TabsContent>
      ))}
    </Tabs>
  );
}

export default EditorSectionTabs;
