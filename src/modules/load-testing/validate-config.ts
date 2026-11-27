import type { LoadConfig } from "@/context/load-testing-context";

export const LOAD_LIMITS = {
  virtualUsers: 500,
  durationSeconds: 3600,
  requestCount: 1_000_000,
  rampUpSeconds: 3600,
  thinkTimeMs: 60_000,
} as const;

export type LoadConfigErrors = Partial<Record<keyof LoadConfig, string>>;

function inRange(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function loadConfigErrors(config: LoadConfig): LoadConfigErrors {
  const errors: LoadConfigErrors = {};
  if (!config.requestId) errors.requestId = "Choose a request to test.";
  if (!inRange(config.virtualUsers, 1, LOAD_LIMITS.virtualUsers)) {
    errors.virtualUsers = `Use 1 to ${LOAD_LIMITS.virtualUsers} users.`;
  }
  if (
    config.limitKind === "duration" &&
    !inRange(config.durationSeconds, 1, LOAD_LIMITS.durationSeconds)
  ) {
    errors.durationSeconds = "Run for 1 second to 1 hour.";
  }
  if (
    config.limitKind === "requests" &&
    !inRange(config.requestCount, 1, LOAD_LIMITS.requestCount)
  ) {
    errors.requestCount = "Send 1 to 1,000,000 requests.";
  }
  if (!inRange(config.rampUpSeconds, 0, LOAD_LIMITS.rampUpSeconds)) {
    errors.rampUpSeconds = "Use 0 to 3600 seconds.";
  } else if (
    config.limitKind === "duration" &&
    config.rampUpSeconds >= config.durationSeconds &&
    config.rampUpSeconds > 0
  ) {
    errors.rampUpSeconds = "Keep it shorter than the duration.";
  }
  if (!inRange(config.thinkTimeMs, 0, LOAD_LIMITS.thinkTimeMs)) {
    errors.thinkTimeMs = "Use 0 to 60000 ms.";
  }
  return errors;
}
