import { Send } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
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
    <Card className="gap-3 [--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle className="text-xl font-medium tracking-[-0.01em]">
          Requests
        </CardTitle>
        <CardAction>
          <Pill>{requests.length} total</Pill>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {requests.length === 0 ? (
          <p className="text-[13.5px] text-mute">
            No requests in this workspace yet. Requests are saved as{" "}
            <span className="font-mono">collections/**/*.req.json</span> files
            in the repository.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {requests
              .slice(0, VISIBLE_REQUESTS)
              .map(({ request, location }) => (
                <ListRow
                  key={request.id}
                  icon={Send}
                  title={request.name}
                  description={
                    <>
                      <span className="font-mono text-[12.5px] font-medium text-foreground">
                        {request.method}
                      </span>{" "}
                      {request.url || "No URL"}
                    </>
                  }
                  action={
                    <span className="text-[12.5px] text-dim">{location}</span>
                  }
                />
              ))}
          </ul>
        )}
        {requests.length > VISIBLE_REQUESTS ? (
          <p className="text-[13.5px] text-mute">
            And {requests.length - VISIBLE_REQUESTS} more.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default WorkspaceRequests;
