import {
  FileCode2,
  FileJson2,
  SquareTerminal,
  type LucideIcon,
} from "lucide-react";

export interface TransferFormat {
  name: string;
  detail: string;
  format: string;
}

export interface ImportSample {
  file: string;
  icon: LucideIcon;
}

export const IMPORT_FORMATS: TransferFormat[] = [
  {
    name: "Postman",
    detail: "Collections v2.1 and environments",
    format: ".json",
  },
  {
    name: "Hoppscotch",
    detail: "Collections and environments",
    format: ".json",
  },
  { name: "Insomnia", detail: "Export files", format: ".json" },
  { name: "OpenAPI", detail: "3.x and Swagger 2.0", format: ".yaml" },
  { name: "cURL", detail: "Paste a command, get a request", format: "$ curl" },
];

export const EXPORT_FORMATS: TransferFormat[] = [
  {
    name: "Postman",
    detail: "Any collection, as Collection v2.1",
    format: ".json",
  },
  {
    name: "OpenAPI",
    detail: "Your HTTP requests as a 3.1 document",
    format: ".yaml",
  },
  { name: "cURL", detail: "Copy any request as a command", format: "$ curl" },
];

export const IMPORT_SAMPLES: ImportSample[] = [
  { file: "payments.postman_collection.json", icon: FileJson2 },
  { file: "openapi.yaml", icon: FileCode2 },
  { file: "curl -X POST /refunds", icon: SquareTerminal },
];
