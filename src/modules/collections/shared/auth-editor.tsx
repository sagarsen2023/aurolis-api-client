import { Input } from "@/components/ui/input";
import { AUTH_OPTIONS } from "@/constants/request";
import type {
  RequestAuth,
  RequestAuthType,
} from "@/types/workspace/request.type";
import OptionSelect from "./option-select";

const FIELD = "h-9 bg-input/30 font-mono text-[13px]";

function emptyAuth(type: RequestAuthType): RequestAuth {
  switch (type) {
    case "bearer":
      return { type, token: "" };
    case "basic":
      return { type, username: "", password: "" };
    case "apikey":
      return { type, key: "", value: "", in: "header" };
    default:
      return { type };
  }
}

function AuthFields({
  auth,
  onChange,
}: Readonly<{ auth: RequestAuth; onChange: (auth: RequestAuth) => void }>) {
  switch (auth.type) {
    case "bearer":
      return (
        <Input
          id="auth-token"
          label="Token"
          className={FIELD}
          placeholder="{{token}}"
          spellCheck={false}
          value={auth.token}
          onChange={(event) => onChange({ ...auth, token: event.target.value })}
        />
      );
    case "basic":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            id="auth-username"
            label="Username"
            className={FIELD}
            spellCheck={false}
            value={auth.username}
            onChange={(event) =>
              onChange({ ...auth, username: event.target.value })
            }
          />
          <Input
            id="auth-password"
            label="Password"
            type="password"
            className={FIELD}
            value={auth.password}
            onChange={(event) =>
              onChange({ ...auth, password: event.target.value })
            }
          />
        </div>
      );
    case "apikey":
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_160px]">
          <Input
            id="auth-key"
            label="Key"
            className={FIELD}
            placeholder="X-API-Key"
            spellCheck={false}
            value={auth.key}
            onChange={(event) => onChange({ ...auth, key: event.target.value })}
          />
          <Input
            id="auth-value"
            label="Value"
            className={FIELD}
            placeholder="{{apiKey}}"
            spellCheck={false}
            value={auth.value}
            onChange={(event) =>
              onChange({ ...auth, value: event.target.value })
            }
          />
          <OptionSelect
            label="Add to"
            value={auth.in}
            options={[
              { value: "header", label: "Header" },
              { value: "query", label: "Query params" },
            ]}
            onChange={(where) => onChange({ ...auth, in: where })}
          />
        </div>
      );
    default:
      return null;
  }
}

function describeAuth(auth: RequestAuth, canInherit: boolean) {
  if (auth.type === "inherit") {
    return "Uses the auth of the closest folder or collection that sets one.";
  }
  if (auth.type === "none") {
    return canInherit
      ? "No auth is sent, even if a parent sets one."
      : "Requests that inherit auth send none.";
  }
  return "Values can use {{variables}} from the active environment.";
}

function AuthEditor({
  auth,
  onChange,
  canInherit = true,
}: Readonly<{
  auth: RequestAuth;
  onChange: (auth: RequestAuth) => void;
  canInherit?: boolean;
}>) {
  const options = canInherit
    ? AUTH_OPTIONS
    : AUTH_OPTIONS.filter((option) => option.value !== "inherit");
  const current =
    !canInherit && auth.type === "inherit" ? emptyAuth("none") : auth;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <OptionSelect
          label="Type"
          className="w-60"
          value={current.type}
          options={options}
          onChange={(type) => onChange(emptyAuth(type))}
        />
        <p className="text-[12.5px] text-mute">
          {describeAuth(current, canInherit)}
        </p>
      </div>
      <AuthFields auth={current} onChange={onChange} />
    </div>
  );
}

export default AuthEditor;
