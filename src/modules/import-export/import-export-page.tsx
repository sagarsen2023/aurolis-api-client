import { ArrowDownToLine, ArrowUpFromLine, LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import {
  EXPORT_FORMATS,
  IMPORT_FORMATS,
  type TransferFormat,
} from "@/constants/import-export";
import ImportPreview from "./import-preview";

function ComingSoonHero() {
  return (
    <Card
      displayGradient
      className="relative isolate flex-row items-center gap-10 px-10 py-12"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 -right-20 -z-10 size-96 rounded-full bg-orb-a/30 blur-3xl dark:bg-orb-c/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-36 left-1/3 -z-10 size-80 rounded-full bg-lav/25 blur-3xl dark:bg-lav/10"
      />
      <div className="flex max-w-md min-w-0 flex-1 flex-col gap-4">
        <p className="flex w-fit items-center gap-2 rounded-full border border-line bg-background/60 px-3 py-1 text-[12px] font-medium text-mute">
          <span className="size-1.5 rounded-full bg-vio ring-4 ring-vio/15 motion-safe:animate-pulse" />
          Coming soon
        </p>
        <h2 className="text-[clamp(28px,3vw,40px)] leading-[1.08] font-medium tracking-[-0.035em] text-foreground">
          Bring every request{" "}
          <span className="bg-linear-to-r from-pur to-[#c2335a] bg-clip-text pr-1 font-serif font-normal tracking-normal text-transparent italic dark:from-orb-c dark:to-[#e58ab5]">
            home
          </span>
        </h2>
        <p className="text-[14.5px] leading-relaxed text-mute">
          Import collections from the tools you use today, and export them when
          you need to share outside Aurolis. Imports land as plain files in this
          workspace, so they show up as changes you review and commit like any
          other.
        </p>
      </div>
      <div className="ml-auto hidden xl:block">
        <ImportPreview />
      </div>
    </Card>
  );
}

function FormatCard({
  icon,
  title,
  description,
  formats,
  footer,
}: Readonly<{
  icon: ReactNode;
  title: string;
  description: string;
  formats: TransferFormat[];
  footer?: ReactNode;
}>) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-icon text-ink">
          {icon}
        </span>
        <div>
          <h3 className="text-[15px] text-foreground">{title}</h3>
          <p className="text-[13px] text-mute">{description}</p>
        </div>
      </div>
      <ul className="flex flex-col">
        {formats.map((format) => (
          <li
            key={format.name}
            className="flex items-center gap-3 border-t border-line/70 py-2.5"
          >
            <span className="w-24 shrink-0 text-[13.5px] text-foreground">
              {format.name}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-mute">
              {format.detail}
            </span>
            <span className="shrink-0 rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-dim">
              {format.format}
            </span>
          </li>
        ))}
      </ul>
      {footer}
    </section>
  );
}

function ImportExportPage() {
  return (
    <div className="mx-auto flex w-full max-w-310 flex-col gap-6 px-8 pt-8 pb-12">
      <PageHeader
        title="Import & export"
        description="Bring collections in, or take this workspace with you."
      />
      <ComingSoonHero />
      <div className="grid gap-4 md:grid-cols-2">
        <FormatCard
          icon={<ArrowDownToLine className="size-4.5" strokeWidth={1.8} />}
          title="Import"
          description="Requests, folders, auth and variables, mapped to Aurolis collections."
          formats={IMPORT_FORMATS}
        />
        <FormatCard
          icon={<ArrowUpFromLine className="size-4.5" strokeWidth={1.8} />}
          title="Export"
          description="Share a collection with someone who doesn't use Aurolis yet."
          formats={EXPORT_FORMATS}
          footer={
            <p className="mt-auto flex items-center gap-2 text-[12.5px] text-mute">
              <LockKeyhole className="size-3.5 shrink-0 text-dim" aria-hidden />
              Secret values stay on this computer and are never exported.
            </p>
          }
        />
      </div>
    </div>
  );
}

export default ImportExportPage;
