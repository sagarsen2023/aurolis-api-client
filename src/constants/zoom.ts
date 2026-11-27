export const ZOOM_STORAGE_KEY = "aurolis-zoom";

export const DEFAULT_ZOOM = 100;

export const ZOOM_LEVELS = [
  50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200,
] as const;

export const MIN_ZOOM = ZOOM_LEVELS[0];

export const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
