import { useAtom } from "jotai";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { addWorkspaceOpenAtom } from "@/context/workspace-context";
import GetStarted from "./get-started";

function AddWorkspaceSheet() {
  const [open, setOpen] = useAtom(addWorkspaceOpenAtom);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-xl data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-xl font-medium">
            Add a workspace
          </SheetTitle>
          <SheetDescription>
            Clone a repository, create a local workspace, or open a folder you
            already have.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-6">
          {open ? (
            <GetStarted variant="sheet" onDone={() => setOpen(false)} />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default AddWorkspaceSheet;
