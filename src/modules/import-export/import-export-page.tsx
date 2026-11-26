import { PageHeader } from "@/components/page-header";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { UPCOMING_FORMATS } from "@/constants/import-export";
import WorkspaceGate from "@/modules/workspace/workspace-gate";
import ExportPanel from "./export-panel";
import ImportPanel from "./import-panel";

const LAYOUT = "grid items-start gap-4 lg:grid-cols-2";

function ImportExportPage() {
  return (
    <div className="mx-auto flex w-full max-w-310 flex-col gap-6 px-8 pt-8 pb-12">
      <PageHeader
        eyebrow="Move freely"
        size="display"
        title={
          <>
            Import{" "}
            <span className="font-serif font-normal tracking-normal italic">
              &amp;
            </span>{" "}
            export
          </>
        }
        description="Bring collections and environments in from Postman or Hoppscotch, and take them out again in the same formats."
      />
      <WorkspaceGate
        loading={
          <div aria-busy className={LAYOUT}>
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        }
      >
        {(workspace) => (
          <div className={LAYOUT}>
            <ImportPanel />
            <ExportPanel workspace={workspace} />
          </div>
        )}
      </WorkspaceGate>
      <p className="flex flex-wrap items-center gap-2 text-[13px] text-mute">
        Coming next:
        {UPCOMING_FORMATS.map((format) => (
          <Pill key={format.label} variant="outline">
            <format.icon aria-hidden />
            {format.label}
          </Pill>
        ))}
      </p>
    </div>
  );
}

export default ImportExportPage;
