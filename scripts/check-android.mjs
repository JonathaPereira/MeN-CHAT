import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const base = new URL("../public/downloads/", import.meta.url);
const apk = await readFile(new URL("menchat-2.1.0.apk", base));
const checksum = await readFile(new URL("menchat-2.1.0.apk.sha256", base), "utf8");
if (!checksum.startsWith(createHash("sha256").update(apk).digest("hex"))) throw new Error("Checksum do APK divergente.");
console.log(`APK: ${(apk.length / 1000000).toFixed(1)} MB; checksum OK.`);
