import { readFileSync, writeFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));

function setVersion(file, pattern) {
  const text = readFileSync(file, "utf8");
  if (!pattern.test(text)) {
    throw new Error(`Could not find the aurolis version in ${file}`);
  }
  writeFileSync(file, text.replace(pattern, `$1"${version}"`));
}

setVersion(
  "src-tauri/Cargo.toml",
  /^(\[package\]\r?\nname = "aurolis"\r?\nversion = )"[^"]+"/m,
);
setVersion(
  "src-tauri/Cargo.lock",
  /^(name = "aurolis"\r?\nversion = )"[^"]+"/m,
);
