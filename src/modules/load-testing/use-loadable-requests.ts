import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { activeWorkspaceAtom } from "@/context/workspace-context";
import type { CollectionItem } from "@/types/workspace/collection.type";
import type { ApiRequest } from "@/types/workspace/request.type";

export interface LoadableRequest {
  id: string;
  name: string;
  path: string;
  collection: string;
  request: ApiRequest;
}

function collect(
  items: CollectionItem[],
  path: string[],
  collection: string,
  into: LoadableRequest[],
) {
  for (const item of items) {
    if (item.type === "folder") {
      collect(item.items, [...path, item.name], collection, into);
    } else if (item.protocol === "http" || item.protocol === "graphql") {
      into.push({
        id: item.id,
        name: item.name,
        path: path.join(" / "),
        collection,
        request: item,
      });
    }
  }
}

export function useLoadableRequests() {
  const workspace = useAtomValue(activeWorkspaceAtom);
  return useMemo(() => {
    const collections = workspace?.data?.collections ?? [];
    return collections
      .map((collection) => {
        const requests: LoadableRequest[] = [];
        collect(collection.items, [], collection.name, requests);
        return { id: collection.id, name: collection.name, requests };
      })
      .filter((group) => group.requests.length > 0);
  }, [workspace]);
}
