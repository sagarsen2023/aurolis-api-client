import { Send } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import type {
  Collection,
  CollectionItem,
} from "@/types/workspace/collection.type";
import type { ApiRequest } from "@/types/workspace/request.type";
import ListRow from "./list-row";

const VISIBLE_REQUESTS = 6;

type LocatedRequest = { request: ApiRequest; location: string };

function collectRequests(collections: Collection[]): LocatedRequest[] {
  const found: LocatedRequest[] = [];
  const walk = (items: CollectionItem[], location: string) => {
    for (const item of items) {
      if (item.type === "folder")
        walk(item.items, `${location} › ${item.name}`);
      else found.push({ request: item, location });
    }
  };
  for (const collection of collections) walk(collection.items, collection.name);
  return found;
}

function WorkspaceRequests({
  collections,
}: Readonly<{ collections: Collection[] }>) {
  const requests = collectRequests(collections);

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Requests</CardTitle>
        <CardDescription>Saved in this workspace's collections</CardDescription>
        <CardAction>
          <Pill variant="outline" className="h-5 px-2 text-xs">
            {requests.length} total
          </Pill>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No requests in this workspace yet. Requests are saved as{" "}
            <span className="font-mono text-xs">collections/**/*.req.json</span>{" "}
            files in the repository.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {requests
              .slice(0, VISIBLE_REQUESTS)
              .map(({ request, location }) => (
                <ListRow
                  key={request.id}
                  icon={Send}
                  title={request.name}
                  description={
                    <>
                      <span className="font-mono font-medium text-foreground">
                        {request.method}
                      </span>{" "}
                      {request.url || "No URL"}
                    </>
                  }
                  action={
                    <span className="text-xs text-muted-foreground">
                      {location}
                    </span>
                  }
                />
              ))}
          </ul>
        )}
        {requests.length > VISIBLE_REQUESTS ? (
          <p className="text-xs text-muted-foreground">
            And {requests.length - VISIBLE_REQUESTS} more.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default WorkspaceRequests;
