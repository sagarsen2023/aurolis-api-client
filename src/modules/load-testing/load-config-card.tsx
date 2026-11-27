import { useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Play, Square } from "lucide-react";
import { SegmentedControl } from "@/components/segmented-control";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  loadConfigAtom,
  type LoadConfig,
  type LoadLimitKind,
} from "@/context/load-testing-context";
import { requestTimeoutAtom } from "@/context/settings-atoms";
import { currentEnvironmentAtom } from "@/context/workspace-context";
import { usePromise } from "@/hooks/usePromise";
import { useLoadTest } from "@/hooks/use-load-test";
import RequestPicker from "./request-picker";
import { loadConfigErrors, type LoadConfigErrors } from "./validate-config";

const LIMIT_OPTIONS = [
  { value: "duration", label: "For a time" },
  { value: "requests", label: "For a number of requests" },
] as const satisfies ReadonlyArray<{ value: LoadLimitKind; label: string }>;

type NumberField = Exclude<keyof LoadConfig, "requestId" | "limitKind">;

function NumberInput({
  id,
  label,
  value,
  error,
  disabled,
  suffix,
  onChange,
}: Readonly<{
  id: NumberField;
  label: string;
  value: number;
  error?: string;
  disabled: boolean;
  suffix: string;
  onChange: (field: NumberField, value: number) => void;
}>) {
  return (
    <div className="relative">
      <Input
        id={`load-${id}`}
        type="number"
        inputMode="numeric"
        min={0}
        label={label}
        value={Number.isNaN(value) ? "" : value}
        error={error}
        disabled={disabled}
        className="pr-16 tabular-nums"
        onChange={(event) => onChange(id, event.target.valueAsNumber)}
      />
      <span className="pointer-events-none absolute top-[34px] right-4 text-xs text-dim">
        {suffix}
      </span>
    </div>
  );
}

function LoadConfigCard() {
  const [config, setConfig] = useAtom(loadConfigAtom);
  const environment = useAtomValue(currentEnvironmentAtom);
  const timeoutSeconds = useAtomValue(requestTimeoutAtom);
  const { running, start, stop } = useLoadTest();
  const [errors, setErrors] = useState<LoadConfigErrors>({});

  const update = (patch: Partial<LoadConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
    setErrors({});
  };

  const setNumber = (field: NumberField, value: number) =>
    update({ [field]: value });

  const { loading: starting, runPromise: runStart } = usePromise({
    promise: () => start(config),
  });
  const { loading: stopping, runPromise: runStop } = usePromise({
    promise: stop,
  });

  const onStart = () => {
    const found = loadConfigErrors(config);
    setErrors(found);
    if (Object.keys(found).length === 0) void runStart();
  };

  const locked = running || starting;

  return (
    <Card className="gap-5">
      <CardHeader>
        <CardTitle>Run settings</CardTitle>
        <CardDescription>
          Requests go out from this computer with the{" "}
          <span className="text-foreground">
            {environment ? environment.name : "no"}
          </span>{" "}
          environment and a {timeoutSeconds}-second timeout.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <RequestPicker
          value={config.requestId}
          disabled={locked}
          error={errors.requestId}
          onChange={(requestId) => update({ requestId })}
        />
        <NumberInput
          id="virtualUsers"
          label="Virtual users"
          suffix="users"
          value={config.virtualUsers}
          error={errors.virtualUsers}
          disabled={locked}
          onChange={setNumber}
        />
        <div className="flex flex-col gap-3">
          <SegmentedControl
            label="Run length"
            value={config.limitKind}
            options={LIMIT_OPTIONS}
            onChange={(limitKind) => update({ limitKind })}
          />
          {config.limitKind === "duration" ? (
            <NumberInput
              id="durationSeconds"
              label="Duration"
              suffix="seconds"
              value={config.durationSeconds}
              error={errors.durationSeconds}
              disabled={locked}
              onChange={setNumber}
            />
          ) : (
            <NumberInput
              id="requestCount"
              label="Total requests"
              suffix="requests"
              value={config.requestCount}
              error={errors.requestCount}
              disabled={locked}
              onChange={setNumber}
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            id="rampUpSeconds"
            label="Ramp-up"
            suffix="seconds"
            value={config.rampUpSeconds}
            error={errors.rampUpSeconds}
            disabled={locked}
            onChange={setNumber}
          />
          <NumberInput
            id="thinkTimeMs"
            label="Pause per user"
            suffix="ms"
            value={config.thinkTimeMs}
            error={errors.thinkTimeMs}
            disabled={locked}
            onChange={setNumber}
          />
        </div>
        <p className="text-xs leading-relaxed text-mute">
          Each virtual user sends the request, waits for the response, pauses,
          then sends it again. Ramp-up starts users gradually instead of all at
          once. Only test servers you own or have permission to test.
        </p>
      </CardContent>
      <CardFooter>
        {running ? (
          <Button
            variant="destructive"
            size="lg"
            className="w-full"
            disabled={stopping}
            onClick={() => void runStop()}
          >
            {stopping ? <Spinner /> : <Square className="fill-current" />}
            Stop the run
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full"
            disabled={starting}
            onClick={onStart}
          >
            {starting ? <Spinner /> : <Play className="fill-current" />}
            Start load test
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default LoadConfigCard;
