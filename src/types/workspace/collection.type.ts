import type { ApiRequest, KeyValue, RequestAuth } from "./request.type.ts";

export interface Folder {
  type: "folder";
  id: string;
  name: string;
  seq: number;
  auth: RequestAuth;
  items: CollectionItem[];
}

export type CollectionItem = Folder | ApiRequest;

export interface Collection {
  id: string;
  name: string;
  seq: number;
  description: string;
  auth: RequestAuth;
  variables: KeyValue[];
  items: CollectionItem[];
}
