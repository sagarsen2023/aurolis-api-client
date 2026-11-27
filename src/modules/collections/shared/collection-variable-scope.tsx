import type { ReactNode } from "react";
import { VariableScopeContext } from "@/context/variable-scope-context";
import { useCollectionVariableScope } from "@/hooks/use-variable-scope";

function CollectionVariableScope({
  collectionId,
  children,
}: Readonly<{ collectionId: string; children: ReactNode }>) {
  const scope = useCollectionVariableScope(collectionId);
  return (
    <VariableScopeContext.Provider value={scope}>
      {children}
    </VariableScopeContext.Provider>
  );
}

export default CollectionVariableScope;
