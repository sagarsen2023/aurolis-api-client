import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const APP_NAME = "Aurolis";
const appPath = path.join("node_modules/electron/dist/Electron.app");
const plistPath = path.join(appPath, "Contents/Info.plist");

const plist = readFileSync(plistPath, "utf8");
const named = plist.replace(
  /(<key>CFBundle(?:Display)?Name<\/key>\s*<string>)Electron(<\/string>)/g,
  `$1${APP_NAME}$2`,
);

if (named === plist) process.exit(0);

writeFileSync(plistPath, named);
execFileSync("codesign", ["--force", "--sign", "-", appPath], {
  stdio: "inherit",
});
