import type { IconType } from "react-icons";
import {
  SiHoppscotch,
  SiInsomnia,
  SiOpenapiinitiative,
  SiPostman,
  SiSwagger,
} from "react-icons/si";
import type {
  ExportFormat,
  ImportNote,
  TransferFormat,
} from "@/types/transfer/transfer.type";

export const TRANSFER_FORMATS: ReadonlyArray<{
  value: TransferFormat;
  label: string;
  icon: IconType;
  iconColor: string;
}> = [
  { value: "postman", label: "Postman", icon: SiPostman, iconColor: "#FF6C37" },
  {
    value: "hoppscotch",
    label: "Hoppscotch",
    icon: SiHoppscotch,
    iconColor: "#31C48D",
  },
];

export const EXPORT_FORMATS: ReadonlyArray<{
  value: ExportFormat;
  label: string;
  icon: IconType;
  iconColor: string;
}> = [
  ...TRANSFER_FORMATS,
  { value: "openapi", label: "Swagger", icon: SiSwagger, iconColor: "#85EA2D" },
];

export const IMPORT_HINTS: Record<
  TransferFormat,
  { accept: string; files: string }
> = {
  postman: {
    accept: ".json,.zip,application/json,application/zip",
    files:
      "Collection v2.1 or v2.0 and environment .json files, or a .zip of them",
  },
  hoppscotch: {
    accept: ".json,.zip,application/json,application/zip",
    files:
      "The workspace export .zip, or collection and environment .json files",
  },
};

export const EXPORT_HINTS: Record<ExportFormat, string> = {
  postman:
    "A Collection v2.1 file per collection and an environment file per environment, zipped together when there's more than one.",
  hoppscotch:
    "A zip laid out like Hoppscotch's workspace export: manifest.json with the workspace's collections.json and environments.json.",
  openapi:
    "One OpenAPI 3.0 file (Swagger docs) with every selected collection: paths, parameters, request bodies, auth and your saved examples as responses. Server URLs come from the active environment.",
};

export const IMPORT_NOTE_MESSAGES: Record<
  ImportNote,
  (count: number) => string
> = {
  scripts: (count) =>
    `${count} pre-request or test ${count === 1 ? "script isn't" : "scripts aren't"} imported. Aurolis doesn't run scripts.`,
  "file-fields": (count) =>
    `${count} file ${count === 1 ? "field" : "fields"} in form bodies ${count === 1 ? "is" : "are"} left out. Aurolis doesn't send files yet.`,
  "unsupported-auth": (count) =>
    `${count} ${count === 1 ? "item uses" : "items use"} an auth type Aurolis doesn't support yet, like OAuth 2.0, and ${count === 1 ? "is" : "are"} set to No auth.`,
  "unsupported-body": (count) =>
    `${count} binary ${count === 1 ? "body is" : "bodies are"} left empty.`,
  "unsupported-method": (count) =>
    `${count} ${count === 1 ? "request uses" : "requests use"} a method Aurolis doesn't support and ${count === 1 ? "is" : "are"} set to GET.`,
  "request-variables": (count) =>
    `${count} ${count === 1 ? "request has" : "requests have"} request variables, which aren't imported.`,
  "folder-variables": (count) =>
    `${count} ${count === 1 ? "folder has" : "folders have"} its own variables, which aren't imported. Move them to the collection or an environment.`,
  "inherited-headers": (count) =>
    `${count} ${count === 1 ? "header" : "headers"} set on collections or folders ${count === 1 ? "is" : "are"} copied to every request under ${count === 1 ? "it" : "them"}.`,
};

export const UPCOMING_FORMATS: ReadonlyArray<{
  label: string;
  icon: IconType;
}> = [
  { label: "Insomnia", icon: SiInsomnia },
  { label: "OpenAPI import", icon: SiOpenapiinitiative },
];
