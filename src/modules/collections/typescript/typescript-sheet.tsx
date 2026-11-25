import { useAtom } from "jotai";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { typescriptSheetAtom } from "@/context/collections-context";
import TypescriptView from "./typescript-view";

function TypescriptSheet() {
  const [sheet, setSheet] = useAtom(typescriptSheetAtom);
  const open = sheet !== null;

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? null : setSheet(null))}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-2xl data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-line pb-4">
          <SheetTitle>TypeScript interfaces</SheetTitle>
          <SheetDescription>
            Generated from {sheet?.title ?? "this request"}. Fields missing from
            some array items are optional, and {"{{variables}}"} are typed as
            unknown.
          </SheetDescription>
        </SheetHeader>
        {sheet ? (
          <Tabs
            key={`${sheet.title}-${sheet.initial}`}
            defaultValue={sheet.initial}
            className="min-h-0 flex-1 gap-3 px-6 pt-4 pb-6"
          >
            {sheet.sources.length > 1 ? (
              <TabsList variant="line">
                {sheet.sources.map((source) => (
                  <TabsTrigger key={source.id} value={source.id}>
                    {source.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            ) : null}
            {sheet.sources.map((source) => (
              <TabsContent
                key={source.id}
                value={source.id}
                className="flex min-h-0 flex-col"
              >
                <TypescriptView
                  key={source.rootName}
                  json={source.json}
                  rootName={source.rootName}
                  label={`${source.label} as TypeScript`}
                  height="100%"
                  className="flex min-h-0 flex-1 flex-col gap-3"
                />
              </TabsContent>
            ))}
          </Tabs>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default TypescriptSheet;
