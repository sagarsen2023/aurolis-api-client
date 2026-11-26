import { app } from "electron";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const userData = () => app.getPath("userData");

export const stateDir = (workspaceId: string) =>
  path.join(userData(), "workspaces", workspaceId);

export const stateFile = (workspaceId: string, name: string) =>
  path.join(stateDir(workspaceId), "state", name);

export async function writeAtomic(file: string, content: string) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, content, "utf8");
  await rename(temp, file);
}
