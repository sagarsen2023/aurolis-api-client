import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import RequestBadge from "@/modules/collections/shared/request-badge";
import { useLoadableRequests } from "./use-loadable-requests";

function RequestPicker({
  value,
  disabled,
  error,
  onChange,
}: Readonly<{
  value: string | null;
  disabled?: boolean;
  error?: string;
  onChange: (id: string) => void;
}>) {
  const groups = useLoadableRequests();
  const items = groups.flatMap((group) =>
    group.requests.map((entry) => ({ value: entry.id, label: entry.name })),
  );

  return (
    <Select
      items={items}
      value={value}
      disabled={disabled || items.length === 0}
      onValueChange={(next) => {
        if (typeof next === "string") onChange(next);
      }}
    >
      <SelectTrigger
        id="load-request"
        label="Request"
        error={error}
        className="w-full bg-card"
      >
        <SelectValue
          placeholder={
            items.length === 0
              ? "No HTTP or GraphQL requests"
              : "Choose a request"
          }
        />
      </SelectTrigger>
      <SelectContent>
        {groups.map((group) => (
          <SelectGroup key={group.id}>
            <SelectLabel>{group.name}</SelectLabel>
            {group.requests.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                <span className="flex min-w-0 items-center gap-2">
                  <RequestBadge request={entry.request} />
                  <span className="truncate">{entry.name}</span>
                  {entry.path ? (
                    <span className="truncate text-xs text-dim">
                      {entry.path}
                    </span>
                  ) : null}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

export default RequestPicker;
