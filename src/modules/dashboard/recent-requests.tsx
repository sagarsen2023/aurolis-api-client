import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RECENT_REQUESTS } from "@/constants/dashboard";
import ListRow from "./list-row";

function RecentRequests() {
  return (
    <Card className="gap-3 [--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle className="text-xl font-medium tracking-[-0.01em]">
          Recent requests
        </CardTitle>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3.5 text-[13.5px]"
          >
            View all
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="divide-y divide-line">
          {RECENT_REQUESTS.map((request) => (
            <ListRow
              key={request.id}
              icon={Send}
              title={request.name}
              description={`${request.method} ${request.url}`}
              action={
                <Button
                  variant="outline"
                  size="xs"
                  className="h-7 px-3 text-[13px]"
                >
                  Open
                </Button>
              }
            />
          ))}
        </ul>
        <p className="text-[13.5px] text-mute">
          Nothing sent yet — open a request and press Send (Ctrl/⌘ + Enter).
        </p>
      </CardContent>
    </Card>
  );
}

export default RecentRequests;
