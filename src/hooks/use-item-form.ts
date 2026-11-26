import { useState } from "react";
import { stableStringify } from "@/lib/workspace-format";

export function useItemForm<T>(saved: T) {
  const [form, setForm] = useState<T>(saved);
  const isDirty = stableStringify(form) !== stableStringify(saved);
  const reset = () => setForm(saved);
  return { form, setForm, isDirty, reset };
}

export function formKey(id: string, saved: unknown) {
  return `${id}:${stableStringify(saved)}`;
}
