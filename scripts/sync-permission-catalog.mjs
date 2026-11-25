import { readFileSync, writeFileSync } from "node:fs";
import { URL } from "node:url";
import process from "node:process";

// Core owns the canonical schema. Keep the generated projection committed so
// the frontend can build independently of sibling repository availability.
const source = new URL("../../Core/src/permission_catalog.json", import.meta.url);
const target = new URL("../src/features/community/permissions/catalog.json", import.meta.url);
const canonical = JSON.stringify(JSON.parse(readFileSync(source, "utf8")), null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8").replace(/\r\n/g, "\n") !== canonical) throw new Error("Permission catalog is stale; run node scripts/sync-permission-catalog.mjs");
} else writeFileSync(target, canonical);
