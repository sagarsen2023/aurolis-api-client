import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

type ErrorResponse = { error: true; message?: string };

const isErrorResponse = (value: unknown): value is ErrorResponse =>
  typeof value === "object" &&
  value !== null &&
  "error" in value &&
  (value as { error: unknown }).error === true;

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(FALLBACK_MESSAGE);

interface UsePromiseOptions<T> {
  initialLoading?: boolean;
  showErrorToast?: boolean;
  promise: () => Promise<T>;
  onSuccess?: (_data: T) => void;
  onSuccessAsync?: (_data: T) => Promise<void>;
  onError?: (_error: Error) => void;
  onErrorAsync?: (_error: Error) => Promise<void>;
  onFinally?: () => void;
  onFinallyAsync?: () => Promise<void>;
}

export function usePromise<T>(options: UsePromiseOptions<T>): {
  loading: boolean;
  runPromise: () => Promise<T | undefined>;
} {
  const [loading, setLoading] = useState(options.initialLoading || false);
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  const runPromise = useCallback(async () => {
    const {
      promise,
      onSuccess,
      onSuccessAsync,
      onError,
      onErrorAsync,
      onFinally,
      onFinallyAsync,
      showErrorToast = true,
    } = latest.current;
    try {
      setLoading(true);
      const response = await promise();
      if (isErrorResponse(response)) {
        throw new Error(response.message || FALLBACK_MESSAGE);
      }
      onSuccess?.(response);
      await onSuccessAsync?.(response);
      return response;
    } catch (caught) {
      const error = toError(caught);
      onError?.(error);
      if (showErrorToast) {
        toast.error(error.message || FALLBACK_MESSAGE);
      }
      await onErrorAsync?.(error);
      return undefined;
    } finally {
      setLoading(false);
      onFinally?.();
      await onFinallyAsync?.();
    }
  }, []);

  if (typeof options.promise !== "function") {
    throw new Error("Promise must be a function");
  }

  return { loading, runPromise };
}

export const handleError = (error: unknown) => {
  toast.error(error instanceof Error ? error.message : FALLBACK_MESSAGE);
};
