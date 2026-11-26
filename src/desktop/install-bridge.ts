import { isTauri } from "@tauri-apps/api/core";
import { createTauriBridge } from "./tauri-bridge";

if (isTauri() && !window.aurolis) {
  window.aurolis = createTauriBridge();
}
