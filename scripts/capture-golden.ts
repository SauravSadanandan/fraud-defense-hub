import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze } from "../src/engine/fraudEngine";
import { DEFAULT_SETTINGS } from "../src/engine/config";
import { generateInstallRows, generateEventRows } from "../tests/engine/fixtures";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");
const goldenDir = resolve(root, "tests", "engine", "__golden__");

mkdirSync(goldenDir, { recursive: true });

console.log("[golden] Generating install rows fixture...");
const installs = generateInstallRows(42);
console.log(`[golden] Analyzing ${installs.rows.length} install rows...`);
const installResult = analyze(installs.headers, installs.rows, "Install", DEFAULT_SETTINGS);
installResult.generatedAt = 0;

const installGoldenPath = resolve(goldenDir, "install.default.json");
writeFileSync(installGoldenPath, JSON.stringify(installResult, null, 2) + "\n", "utf8");
console.log(`[golden] Wrote install golden to ${installGoldenPath} (${installResult.flaggedRows}/${installResult.totalRows} flagged)`);

console.log("[golden] Generating event rows fixture...");
const events = generateEventRows(42);
console.log(`[golden] Analyzing ${events.rows.length} event rows...`);
const eventResult = analyze(events.headers, events.rows, "Event", DEFAULT_SETTINGS);
eventResult.generatedAt = 0;

const eventGoldenPath = resolve(goldenDir, "event.default.json");
writeFileSync(eventGoldenPath, JSON.stringify(eventResult, null, 2) + "\n", "utf8");
console.log(`[golden] Wrote event golden to ${eventGoldenPath} (${eventResult.flaggedRows}/${eventResult.totalRows} flagged)`);
