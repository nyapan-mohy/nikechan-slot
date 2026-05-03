#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TABLES_PATH = path.join(ROOT, "src", "data", "tables.json");
const REQUIRED_SETTINGS = Array.from({ length: 6 }, (_, index) => `setting${index + 1}`);
const BONUS_TYPES = new Set(["BIG", "REG"]);

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`required file not found: ${path.relative(ROOT, filePath)}`);
    }
    throw new Error(`failed to read JSON ${path.relative(ROOT, filePath)}: ${error.message}`);
  }
}

function normalizeTables(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.tables)) return json.tables;
  if (json?.tables && typeof json.tables === "object") return Object.values(json.tables);
  throw new Error("tables.json must be an array or an object with a tables array/object");
}

function asResult(entry) {
  return entry?.result && typeof entry.result === "object" ? entry.result : entry ?? {};
}

function getBonus(result) {
  return result.bonus ?? result.bonusCandidate ?? null;
}

function getSmallRole(result) {
  const role = result.smallRole ?? result.role ?? null;
  return role === "NONE" || role === "REPLAY" ? null : role;
}

function getReplay(result) {
  return Boolean(result.isReplay ?? result.replay ?? result.role === "REPLAY");
}

function isNone(result) {
  return !getBonus(result) && !getSmallRole(result) && !getReplay(result);
}

function validateEntry(table, entry, index, errors) {
  const prefix = `${table.id ?? "(missing id)"} entries[${index}]`;
  if (!Number.isInteger(entry?.weight) || entry.weight < 0) {
    errors.push(`${prefix}: weight must be a non-negative integer`);
  }

  const result = asResult(entry);
  const bonus = getBonus(result);
  const smallRole = getSmallRole(result);
  const replay = getReplay(result);

  if (bonus && !BONUS_TYPES.has(bonus)) {
    errors.push(`${prefix}: bonus must be BIG, REG, null, or omitted`);
  }
  if (replay && smallRole) {
    errors.push(`${prefix}: replay and smallRole must not be true in the same result`);
  }
  if (replay && bonus) {
    errors.push(`${prefix}: bonus and replay simultaneous results are not allowed in the initial spec`);
  }
}

function validateTable(table, errors) {
  if (!table || typeof table !== "object") {
    errors.push("table entry must be an object");
    return;
  }
  if (typeof table.id !== "string" || table.id.length === 0) {
    errors.push("table is missing string id");
  }
  if (!REQUIRED_SETTINGS.includes(table.settingId)) {
    errors.push(`${table.id ?? "(missing id)"}: settingId must be setting1 through setting6`);
  }
  if (!Number.isInteger(table.denominator) || table.denominator <= 0) {
    errors.push(`${table.id ?? "(missing id)"}: denominator must be a positive integer`);
  }
  if (!Array.isArray(table.entries) || table.entries.length === 0) {
    errors.push(`${table.id ?? "(missing id)"}: entries must be a non-empty array`);
    return;
  }

  table.entries.forEach((entry, index) => validateEntry(table, entry, index, errors));
  const totalWeight = table.entries.reduce((sum, entry) => sum + (Number.isInteger(entry?.weight) ? entry.weight : 0), 0);
  if (Number.isInteger(table.denominator) && totalWeight !== table.denominator) {
    errors.push(`${table.id}: weight total ${totalWeight} does not match denominator ${table.denominator}`);
  }
}

function validateNormalTable(table, errors) {
  const results = table.entries.map(asResult);
  const hasBig = results.some((result) => getBonus(result) === "BIG");
  const hasReg = results.some((result) => getBonus(result) === "REG");
  const hasSmallRole = results.some((result) => getSmallRole(result));
  const hasReplay = results.some((result) => getReplay(result));
  const hasNone = results.some(isNone);

  if (!hasBig) errors.push(`${table.id}: normal table must contain BIG results`);
  if (!hasReg) errors.push(`${table.id}: normal table must contain REG results`);
  if (!hasSmallRole) errors.push(`${table.id}: normal table must contain at least one smallRole result`);
  if (!hasReplay) errors.push(`${table.id}: normal table must contain replay results`);
  if (!hasNone) errors.push(`${table.id}: normal table must contain a NONE/miss result`);
}

function validateBonusFlaggedTable(table, errors) {
  const results = table.entries.map(asResult);
  const bonusResults = results.filter((result) => getBonus(result));
  if (bonusResults.length > 0) {
    errors.push(`${table.id}: bonus-flagged table must not contain new BIG/REG results`);
  }
  if (!results.some((result) => getSmallRole(result))) {
    errors.push(`${table.id}: bonus-flagged table must contain smallRole results`);
  }
  if (!results.some((result) => getReplay(result))) {
    errors.push(`${table.id}: bonus-flagged table must contain replay results`);
  }
  if (!results.some(isNone)) {
    errors.push(`${table.id}: bonus-flagged table must contain a NONE/miss result`);
  }
}

function validateRequiredSettings(tables, errors) {
  const ids = new Set(tables.map((table) => table?.id));
  for (const settingId of REQUIRED_SETTINGS) {
    const normalId = `normal-${settingId}`;
    const bonusFlaggedId = `bonus-flagged-${settingId}`;
    if (!ids.has(normalId)) errors.push(`missing table: ${normalId}`);
    if (!ids.has(bonusFlaggedId)) errors.push(`missing table: ${bonusFlaggedId}`);
  }
}

async function main() {
  const tables = normalizeTables(await readJson(TABLES_PATH));
  const errors = [];
  const seenIds = new Set();

  for (const table of tables) {
    if (table?.id) {
      if (seenIds.has(table.id)) errors.push(`duplicate table id: ${table.id}`);
      seenIds.add(table.id);
    }
    validateTable(table, errors);
  }

  validateRequiredSettings(tables, errors);

  for (const table of tables) {
    if (typeof table?.id !== "string" || !Array.isArray(table.entries)) continue;
    if (table.id.startsWith("normal-")) validateNormalTable(table, errors);
    if (table.id.startsWith("bonus-flagged-")) validateBonusFlaggedTable(table, errors);
  }

  if (errors.length > 0) {
    console.error(`verify-tables: failed (${errors.length} issue${errors.length === 1 ? "" : "s"})`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`verify-tables: ok (${tables.length} tables)`);
}

main().catch((error) => {
  console.error(`verify-tables: ${error.message}`);
  process.exitCode = 1;
});
