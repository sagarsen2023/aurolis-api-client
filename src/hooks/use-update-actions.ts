import { useAtom } from "jotai";
import { updateStateAtom } from "@/context/update-context";
import { updateService } from "@/services/update.service";
import { usePromise } from "./usePromise";

const messageOf = (error: Error) =>
  error.message.trim() || "Something went wrong. Try again.";

export function useUpdateActions() {
  const [state, setState] = useAtom(updateStateAtom);

  const checking = usePromise({
    promise: async () => {
      setState((current) => ({ ...current, phase: "checking", error: null }));
      return updateService.check();
    },
    showErrorToast: false,
    onSuccess: (update) =>
      setState({
        phase: update ? "available" : "up-to-date",
        update,
        progress: null,
        error: null,
        checkedAt: new Date().toISOString(),
      }),
    onError: (error) =>
      setState((current) => ({
        ...current,
        phase: "error",
        error: `Couldn't check for updates. ${messageOf(error)}`,
        checkedAt: new Date().toISOString(),
      })),
  });

  const installing = usePromise({
    promise: () => {
      setState((current) => ({
        ...current,
        phase: "downloading",
        progress: null,
        error: null,
      }));
      return updateService.install((progress) =>
        setState((current) => ({
          ...current,
          phase: progress === 100 ? "installing" : "downloading",
          progress,
        })),
      );
    },
    showErrorToast: false,
    onError: (error) =>
      setState((current) => ({
        ...current,
        phase: "error",
        progress: null,
        error: `The update didn't install. ${messageOf(error)}`,
      })),
  });

  return {
    state,
    checkNow: () => void checking.runPromise(),
    install: () => void installing.runPromise(),
    busy:
      state.phase === "checking" ||
      state.phase === "downloading" ||
      state.phase === "installing",
  };
}
