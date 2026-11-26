import {
  describeChanges,
  type ChangedFileContent,
  type KnownNames,
} from "@/lib/change-items";
import { fromFiles } from "@/lib/workspace-format";
import type { CollectionItem } from "@/types/workspace/collection.type";
import type { SourceControlChanges } from "@/types/workspace/source-control.type";
import { run } from "./invoke";

interface ChangesRaw {
  branch: string | null;
  remoteUrl: string | null;
  unpushedCommits: number;
  fileCount: number;
  files: ChangedFileContent[];
  workspaceFiles: Record<string, string>;
}

const dirOf = (file: string) =>
  file.slice(0, Math.max(file.lastIndexOf("/"), 0));

function folderNames(
  items: CollectionItem[],
  paths: Record<string, string>,
  known: KnownNames,
) {
  for (const item of items) {
    const file = paths[item.id];
    if (!file) continue;
    if (item.type === "request") {
      known.requests[file] = item.name;
      continue;
    }
    known.folders[dirOf(file)] = item.name;
    folderNames(item.items, paths, known);
  }
}

function knownNames(files: Record<string, string>): KnownNames {
  const known: KnownNames = { collections: {}, folders: {}, requests: {} };
  const { workspace, paths } = fromFiles(files);
  for (const collection of workspace.collections) {
    const file = paths[collection.id];
    if (!file) continue;
    known.collections[dirOf(file)] = {
      id: collection.id,
      name: collection.name,
    };
    folderNames(collection.items, paths, known);
  }
  return known;
}

export async function listChanges(
  workspaceId: string,
): Promise<SourceControlChanges> {
  const raw = await run<ChangesRaw>("source_control_changes", {
    id: workspaceId,
  });
  return {
    branch: raw.branch,
    remoteUrl: raw.remoteUrl,
    unpushedCommits: raw.unpushedCommits,
    fileCount: raw.fileCount,
    groups: describeChanges(raw.files, knownNames(raw.workspaceFiles)),
  };
}
