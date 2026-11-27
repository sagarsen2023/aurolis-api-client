import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VariableInput } from "@/components/variable-input";
import { useVariableScopeContext } from "@/context/variable-scope-context";
import { AUTH_OPTIONS } from "@/constants/request";
import type {
  RequestAuth,
  RequestAuthType,
} from "@/types/workspace/request.type";
import OptionSelect from "./option-select";

const FIELD = "h-9 bg-input/30 font-mono text-[13px]";

function AuthField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}>) {
  const scope = useVariableScopeContext();
  if (!scope) {
    return (
      <Input
        id={id}
        label={label}
        className={FIELD}
        placeholder={placeholder}
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <div className="w-full">
      <Label className="mb-2" id={`${id}-label`}>
        {label}
      </Label>
      <VariableInput
        ariaLabel={label}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        className="h-9 rounded-4xl border border-input bg-input/30 px-3 text-[13px] leading-9 transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
      />
    </div>
  );
}

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
        <AuthField
          id="auth-token"
          label="Token"
          placeholder="{{token}}"
          value={auth.token}
          onChange={(token) => onChange({ ...auth, token })}
        />
      );
    case "basic":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <AuthField
            id="auth-username"
            label="Username"
            value={auth.username}
            onChange={(username) => onChange({ ...auth, username })}
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
          <AuthField
            id="auth-key"
            label="Key"
            placeholder="X-API-Key"
            value={auth.key}
            onChange={(key) => onChange({ ...auth, key })}
          />
          <AuthField
            id="auth-value"
            label="Value"
            placeholder="{{apiKey}}"
            value={auth.value}
            onChange={(value) => onChange({ ...auth, value })}
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
