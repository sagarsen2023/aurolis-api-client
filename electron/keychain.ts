import { safeStorage } from "electron";

export function osKeychainAvailable() {
  if (!safeStorage.isEncryptionAvailable()) return false;
  return !(
    process.platform === "linux" &&
    safeStorage.getSelectedStorageBackend() === "basic_text"
  );
}
