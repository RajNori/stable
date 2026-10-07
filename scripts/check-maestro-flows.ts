/**
 * Validates every committed Maestro flow without a device.
 *
 * Each flow must target the mobile app id, contain the config/commands
 * separator, and launch the app. This is structure validation only; it does
 * not run Maestro.
 *
 * Run from the repo root:
 *   node --experimental-strip-types scripts/check-maestro-flows.ts
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const FLOW_DIR = "apps/mobile/maestro";
const APP_ID = "app.stable.mobile";

function checkFlow(file: string): string {
  const text = readFileSync(file, "utf8");
  if (text.trim().length === 0) {
    throw new Error(`${file} is empty`);
  }

  let appId = "";
  let sawSeparator = false;
  const commands: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("appId:")) {
      appId = line.slice("appId:".length).trim();
    }
    if (line.trim() === "---") {
      sawSeparator = true;
    }
    const command = /^- (\w+)/.exec(line);
    if (command?.[1] !== undefined) {
      commands.push(command[1]);
    }
  }

  if (appId !== APP_ID) {
    throw new Error(`${file} must declare appId ${APP_ID}`);
  }
  if (!sawSeparator) {
    throw new Error(`${file} must contain a YAML document separator`);
  }
  if (!commands.includes("launchApp")) {
    throw new Error(`${file} must launch the app`);
  }

  return `parsed ${file}: appId=${appId} commands=${commands.join(",")}`;
}

const flows = readdirSync(FLOW_DIR)
  .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
  .sort()
  .map((name) => join(FLOW_DIR, name));

if (flows.length === 0) {
  console.error(`${FLOW_DIR} has no committed Maestro flows.`);
  process.exitCode = 1;
} else {
  try {
    for (const flow of flows) {
      console.log(checkFlow(flow));
    }
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : "flow check failed");
    process.exitCode = 1;
  }
}
