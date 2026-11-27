import { createContext, useContext } from "react";
import type { VariableInfo } from "@/types/workspace/variable.type";

export const VariableScopeContext = createContext<
  readonly VariableInfo[] | null
>(null);

export function useVariableScopeContext() {
  return useContext(VariableScopeContext);
}
