import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormDialog } from "@/components/form-dialog";
import { NameField } from "@/components/name-field";
import { useCollectionActions } from "@/hooks/use-collection-actions";
import { usePromise } from "@/hooks/usePromise";
import { nameError } from "@/utils/name";
import type { Environment } from "@/types/workspace/environment.type";

export function NewEnvironmentDialog({
  onCreated,
  onClose,
}: Readonly<{ onCreated: (id: string) => void; onClose: () => void }>) {
  const [name, setName] = useState("");
  const { apply } = useCollectionActions();
  const { loading, runPromise } = usePromise({
    promise: () => apply({ op: "create-environment", name: name.trim() }),
    onSuccess: (createdId) => {
      toast.success("Environment created");
      if (createdId) onCreated(createdId);
      onClose();
    },
  });
  return (
    <FormDialog
      title="New environment"
      description="An environment holds the variables for one place you send requests to. It's saved under environments/, with secret values kept out of the file."
      submitLabel="Create environment"
      busy={loading}
      canSubmit={!nameError(name)}
      onClose={onClose}
      onSubmit={() => void runPromise()}
    >
      <NameField
        name={name}
        setName={setName}
        touched={name.length > 0}
        label="Name"
        placeholder="Staging"
      />
    </FormDialog>
  );
}

export function DeleteEnvironmentDialog({
  environment,
  onDeleted,
  onClose,
}: Readonly<{
  environment: Environment;
  onDeleted: () => void;
  onClose: () => void;
}>) {
  const { apply } = useCollectionActions();
  const { loading, runPromise } = usePromise({
    promise: () => apply({ op: "delete-environment", id: environment.id }),
    onSuccess: () => {
      toast.success(`Deleted ${environment.name}`);
      onDeleted();
      onClose();
    },
  });
  return (
    <ConfirmDialog
      title={`Delete environment “${environment.name}”?`}
      description="Its file is removed from the working tree and its secret values are forgotten on this computer. Until you commit, you can still restore the file with git."
      confirmLabel="Delete"
      busy={loading}
      onConfirm={() => void runPromise()}
      onClose={onClose}
    />
  );
}
