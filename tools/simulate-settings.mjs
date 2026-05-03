#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TABLES_PATH = path.join(ROOT, "src", "data", "tables.json");
const BONUS_SPEC_PATH = path.join(ROOT, "src", "data", "bonus-spec.json");
const DEFAULT_SETTINGS = Array.from({ length: 6 }, (_, index) => `setting${index + 1}`);
const DEFAULT_SMALL_ROLE_PAYOUTS = { BELL: 5, RARE_CHERRY: 2, SUIKA: 15 };
const DEFAULT_BONUSES = {
  BIG: { games: 21, bet: 2, payout: 14 },
  REG: { games: 8, bet: 2, payout: 14 }
};

function parseArgs(argv) {
  const args = { games: 100000, seed: 0x12345678, settings: DEFAULT_SETTINGS, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.json = true;
    } else if (arg === "--games") {
      args.games = Number.parseInt(argv[++index], 10);
    } else if (arg.startsWith("--games=")) {
      args.games = Number.parseInt(arg.slice("--games=".length), 10);
    } else if (arg === "--seed") {
      args.seed = parseSeed(argv[++index]);
    } else if (arg.startsWith("--seed=")) {
      args.seed = parseSeed(arg.slice("--seed=".length));
    } else if (arg === "--settings") {
      args.settings = parseSettings(argv[++index]);
    } else if (arg.startsWith("--settings=")) {
      args.settings = parseSettings(arg.slice("--settings=".length));
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!Number.isInteger(args.games) || args.games <= 0) {
    throw new Error("--games must be a positive integer");
  }
  return args;
}

function parseSettings(value) {
  const settings = String(value ?? "")
    .split(",")
    .map((setting) => setting.trim())
    .filter(Boolean)
    .map((setting) => (setting.startsWith("setting") ? setting : `setting${setting}`));
  if (settings.length === 0) throw new Error("--settings must include at least one setting id");
  return settings;
}

function parseSeed(value) {
  const raw = String(value ?? "").trim();
  const parsed = raw.startsWith("0x") || raw.startsWith("0X")
    ? Number.parseInt(raw.slice(2), 16)
    : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) throw new Error(`invalid seed: ${value}`);
  return parsed >>> 0;
}

function createRng(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 0x100000000;
    },
    get seed() {
      return state >>> 0;
    }
  };
}

async function readJson(filePath, required = true) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && !required) return null;
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

function drawEntry(table, rng) {
  let pick = Math.floor(rng.next() * table.denominator);
  for (const entry of table.entries) {
    pick -= entry.weight;
    if (pick < 0) return asResult(entry);
  }
  return {};
}

function readBonusConfig(spec, type) {
  const source = spec?.bonuses?.[type] ?? spec?.[type] ?? spec?.bonusTypes?.[type] ?? {};
  return {
    games: source.games ?? source.gameCount ?? source.durationGames ?? source.endAfterGames ?? DEFAULT_BONUSES[type].games,
    bet: source.bet ?? source.betPerGame ?? source.maxBet ?? DEFAULT_BONUSES[type].bet,
    payout: source.payout ?? source.payoutPerGame ?? source.gamePayout ?? DEFAULT_BONUSES[type].payout
  };
}

function readSmallRolePayouts(spec) {
  return {
    ...DEFAULT_SMALL_ROLE_PAYOUTS,
    ...(spec?.smallRolePayouts ?? {}),
    ...(spec?.payouts?.smallRoles ?? {}),
    ...(spec?.payouts ?? {})
  };
}

function formatRate(count, games) {
  return count > 0 ? `1/${(games / count).toFixed(1)}` : "-";
}

function simulateSetting(settingId, table, bonusSpec, games, seed) {
  const rng = createRng(seed);
  const smallRolePayouts = readSmallRolePayouts(bonusSpec);
  const bonusConfigs = {
    BIG: readBonusConfig(bonusSpec, "BIG"),
    REG: readBonusConfig(bonusSpec, "REG")
  };
  const stats = {
    settingId,
    seed,
    normalGames: games,
    bonusGames: 0,
    totalGames: games,
    totalBet: 0,
    totalPayout: 0,
    normalBet: 0,
    normalPayout: 0,
    big: 0,
    reg: 0,
    replay: 0,
    smallRoles: {}
  };

  for (let game = 0; game < games; game += 1) {
    stats.totalBet += 3;
    stats.normalBet += 3;
    const result = drawEntry(table, rng);
    const bonus = getBonus(result);
    const smallRole = getSmallRole(result);
    const replay = getReplay(result);

    if (replay) {
      stats.replay += 1;
      stats.totalPayout += 3;
      stats.normalPayout += 3;
    }
    if (smallRole) {
      const payout = Number(smallRolePayouts[smallRole] ?? 0);
      stats.smallRoles[smallRole] = (stats.smallRoles[smallRole] ?? 0) + 1;
      stats.totalPayout += payout;
      stats.normalPayout += payout;
    }
    if (bonus === "BIG" || bonus === "REG") {
      if (bonus === "BIG") stats.big += 1;
      if (bonus === "REG") stats.reg += 1;
      const config = bonusConfigs[bonus];
      stats.bonusGames += config.games;
      stats.totalGames += config.games;
      stats.totalBet += config.games * config.bet;
      stats.totalPayout += config.games * config.payout;
    }
  }

  const bonusTotal = stats.big + stats.reg;
  const normalNetCost = stats.normalBet - stats.normalPayout;
  return {
    ...stats,
    bonusTotal,
    payoutRate: stats.totalBet > 0 ? (stats.totalPayout / stats.totalBet) * 100 : 0,
    base50: normalNetCost > 0 ? (games / normalNetCost) * 50 : Number.POSITIVE_INFINITY,
    rates: {
      big: formatRate(stats.big, games),
      reg: formatRate(stats.reg, games),
      totalBonus: formatRate(bonusTotal, games),
      replay: formatRate(stats.replay, games),
      smallRoles: Object.fromEntries(Object.entries(stats.smallRoles).sort().map(([role, count]) => [role, formatRate(count, games)]))
    }
  };
}

function printText(results) {
  for (const result of results) {
    console.log(`設定${result.settingId.replace("setting", "")}`);
    console.log(`  normalGames=${result.normalGames} bonusGames=${result.bonusGames} totalGames=${result.totalGames}`);
    console.log(`  machineRate=${result.payoutRate.toFixed(2)}% base50=${Number.isFinite(result.base50) ? result.base50.toFixed(1) : "inf"}G`);
    console.log(`  BIG=${result.big} (${result.rates.big}) REG=${result.reg} (${result.rates.reg}) 合算=${result.bonusTotal} (${result.rates.totalBonus})`);
    const smallRoles = Object.entries(result.smallRoles).sort();
    const smallRoleText = smallRoles.length > 0
      ? smallRoles.map(([role, count]) => `${role}=${count} (${result.rates.smallRoles[role]})`).join(" ")
      : "none";
    console.log(`  smallRoles ${smallRoleText}`);
    console.log(`  REPLAY=${result.replay} (${result.rates.replay})`);
  }
}

function printHelp() {
  console.log("Usage: node tools/simulate-settings.mjs [--games 100000] [--seed 12345] [--settings 1,6] [--json]");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const tableJson = await readJson(TABLES_PATH);
  const bonusSpec = await readJson(BONUS_SPEC_PATH, false) ?? {};
  const tables = normalizeTables(tableJson);
  const tableById = new Map(tables.map((table) => [table.id, table]));
  const results = [];

  for (const settingId of args.settings) {
    const table = tableById.get(`normal-${settingId}`);
    if (!table) throw new Error(`missing normal table for ${settingId}`);
    results.push(simulateSetting(settingId, table, bonusSpec, args.games, args.seed));
  }

  if (args.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    printText(results);
  }
}

main().catch((error) => {
  console.error(`simulate-settings: ${error.message}`);
  process.exitCode = 1;
});
