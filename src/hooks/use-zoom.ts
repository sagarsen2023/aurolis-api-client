import { useAtomValue, useStore } from "jotai";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { toast } from "sonner";
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_LEVELS,
} from "@/constants/zoom";
import { zoomAtom } from "@/context/settings-atoms";

type ZoomAction = "in" | "out" | "reset";

function nearestLevel(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_ZOOM;
  return ZOOM_LEVELS.reduce<number>(
    (best, level) =>
      Math.abs(level - value) < Math.abs(best - value) ? level : best,
    DEFAULT_ZOOM,
  );
}

function zoomActionFor(event: KeyboardEvent): ZoomAction | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  if (event.key === "+" || event.key === "=" || event.code === "NumpadAdd") {
    return "in";
  }
  if (
    event.key === "-" ||
    event.key === "_" ||
    event.code === "NumpadSubtract"
  ) {
    return "out";
  }
  if (
    event.key === "0" ||
    event.code === "Digit0" ||
    event.code === "Numpad0"
  ) {
    return "reset";
  }
  return null;
}

export function useZoom() {
  const store = useStore();
  const zoom = nearestLevel(useAtomValue(zoomAtom));

  const setZoom = useCallback(
    (next: number) => {
      const level = nearestLevel(next);
      store.set(zoomAtom, level);
      toast(`Zoom ${level}%`, { id: "zoom", duration: 1500 });
    },
    [store],
  );

  const zoomIn = useCallback(() => {
    const current = nearestLevel(store.get(zoomAtom));
    setZoom(ZOOM_LEVELS.find((level) => level > current) ?? MAX_ZOOM);
  }, [setZoom, store]);

  const zoomOut = useCallback(() => {
    const current = nearestLevel(store.get(zoomAtom));
    setZoom(ZOOM_LEVELS.filter((level) => level < current).at(-1) ?? MIN_ZOOM);
  }, [setZoom, store]);

  const resetZoom = useCallback(() => setZoom(DEFAULT_ZOOM), [setZoom]);

  return { zoom, setZoom, zoomIn, zoomOut, resetZoom };
}

export function useWindowZoom() {
  const { zoom, zoomIn, zoomOut, resetZoom } = useZoom();
  const actions = useRef({ in: zoomIn, out: zoomOut, reset: resetZoom });
  useLayoutEffect(() => {
    actions.current = { in: zoomIn, out: zoomOut, reset: resetZoom };
  });

  useEffect(() => {
    window.aurolis?.setZoom(zoom / 100).catch(() => undefined);
  }, [zoom]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = zoomActionFor(event);
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat || action !== "reset") actions.current[action]();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);
}
