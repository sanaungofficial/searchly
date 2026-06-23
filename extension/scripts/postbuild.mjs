import { copyFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const dist = resolve(import.meta.dirname, "../dist");
const nestedPopup = resolve(dist, "src/popup/popup.html");
const rootPopup = resolve(dist, "popup.html");

if (existsSync(nestedPopup)) {
  copyFileSync(nestedPopup, rootPopup);
  rmSync(resolve(dist, "src"), { recursive: true, force: true });
}

// Remove accidental nested icons/ from prior builds
const nestedIcons = resolve(dist, "icons/icons");
if (existsSync(nestedIcons)) {
  rmSync(nestedIcons, { recursive: true, force: true });
}

console.log("postbuild: popup.html at dist root");
