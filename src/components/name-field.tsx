import { Input } from "@/components/ui/input";
import { MAX_NAME_LENGTH, nameError } from "@/utils/name";

export function NameField({
  name,
  setName,
  touched,
  label,
  placeholder,
}: Readonly<{
  name: string;
  setName: (name: string) => void;
  touched: boolean;
  label: string;
  placeholder: string;
}>) {
  return (
    <Input
      id="name-field"
      label={label}
      autoFocus
      value={name}
      maxLength={MAX_NAME_LENGTH}
      placeholder={placeholder}
      error={touched ? nameError(name) : undefined}
      onChange={(event) => setName(event.target.value)}
    />
  );
}
