#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createGameEngine,
  createRng,
  GAME_STATES,
  resolveLottery
} from "../src/core/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "src", "data");

async function readJson(name) {
  const filePath = path.join(DATA_DIR, name);
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadDataBundle() {
  const [
    settings,
    tables,
    roles,
    reels,
    lines,
    stopControl,
    bonusSpec,
    symbols,
    reachPatterns
  ] = await Promise.all([
    readJson("settings.json"),
    readJson("tables.json"),
    readJson("roles.json"),
    readJson("reels.json"),
    readJson("lines.json"),
    readJson("stop-control.json"),
    readJson("bonus-spec.json"),
    readJson("symbols.json"),
    readJson("reach-patterns.json")
  ]);

  return {
    settings,
    tables,
    roles,
    reels,
    lines,
    stopControl,
    bonusSpec,
    symbols,
    reachPatterns
  };
}

function collectEvents(engine, types) {
  const events = [];
  for (const type of types) {
    engine.on(type, (event) => events.push(event));
  }
  return events;
}

function testSameSeedRng() {
  const first = createRng(12345);
  const second = createRng(12345);
  const firstValues = Array.from({ length: 12 }, () => ({
    float: first.nextFloat(),
    int: first.nextInt(65536),
    state: first.getState()
  }));
  const secondValues = Array.from({ length: 12 }, () => ({
    float: second.nextFloat(),
    int: second.nextInt(65536),
    state: second.getState()
  }));

  assert.deepEqual(secondValues, firstValues);
  console.log("core-smoke: ok same-seed RNG sequence");
}

function testBonusFlaggedLottery(dataBundle) {
  const lottery = resolveLottery({
    dataBundle,
    rng: createRng(1),
    state: {
      settingId: "setting1",
      stateId: GAME_STATES.BONUS_FLAGGED,
      carriedBonus: "BIG",
      bonusType: "BIG"
    }
  });

  assert.equal(lottery.tableId, "bonus-flagged-setting1");
  assert.equal(lottery.bonus, null);
  assert.equal(lottery.bonusCandidate, null);
  assert.equal(lottery.carriedBonus, "BIG");
  assert.equal(lottery.activeBonus, "BIG");
  console.log("core-smoke: ok bonusFlagged lottery suppresses new bonus");
}

function testForcedBigEvents(dataBundle) {
  const engine = createGameEngine({
    dataBundle,
    seed: 12345,
    settingId: "setting1",
    initialCredit: 10000
  });
  const events = collectEvents(engine, ["lotteryResolved", "bonusFlagRaised"]);

  engine.setNextOutcomeOverride({ bonus: "BIG", smallRole: null, isReplay: false });
  const result = engine.play({ pushes: { left: 0, center: 0, right: 0 } });

  assert.equal(result.lottery.bonus, "BIG");
  assert.equal(result.lottery.forced, true);
  assert.ok(events.some((event) => event.type === "lotteryResolved" && event.lottery.bonus === "BIG"));
  assert.ok(events.some((event) => event.type === "bonusFlagRaised" && event.bonusType === "BIG"));
  console.log("core-smoke: ok forced BIG emits lotteryResolved and bonusFlagRaised");
}

function testSettingChangedEvent(dataBundle) {
  const engine = createGameEngine({
    dataBundle,
    seed: 12345,
    settingId: "setting1",
    initialCredit: 10000
  });
  const events = collectEvents(engine, ["settingChanged"]);

  const state = engine.setSetting("setting6");

  assert.equal(state.settingId, "setting6");
  assert.deepEqual(
    events.map(({ type, from, to }) => ({ type, from, to })),
    [{ type: "settingChanged", from: "setting1", to: "setting6" }]
  );
  console.log("core-smoke: ok setSetting emits settingChanged");
}

function testForcedBigEntryAndBonusProgress(dataBundle) {
  const engine = createGameEngine({
    dataBundle,
    seed: 12345,
    settingId: "setting1",
    initialCredit: 10000
  });
  const events = collectEvents(engine, ["bonusSymbolEntered", "bonusStarted", "bonusEnded", "stateChanged"]);

  engine.setNextOutcomeOverride({ bonus: "BIG", smallRole: null, isReplay: false });
  const entryResult = engine.play({ pushes: { left: 0, center: 0, right: 0 } });

  assert.equal(entryResult.win.bonusEntered, true);
  assert.equal(entryResult.state.stateId, GAME_STATES.BONUS_ACTIVE);
  assert.equal(entryResult.state.bonusType, "BIG");
  assert.ok(events.some((event) => event.type === "bonusSymbolEntered" && event.bonusType === "BIG"));
  assert.ok(events.some((event) => event.type === "bonusStarted" && event.bonusType === "BIG"));

  for (let index = 0; index < 21; index += 1) {
    engine.play({ pushes: { left: 0, center: 0, right: 0 } });
  }

  const afterBonus = engine.getState();
  assert.equal(afterBonus.stateId, GAME_STATES.BONUS_ENDING);
  assert.equal(afterBonus.bonusGameCount, 21);
  assert.equal(afterBonus.bonusGrossPayout, 294);
  assert.ok(events.some((event) => event.type === "bonusEnded" && event.bonusType === "BIG"));
  console.log("core-smoke: ok forced BIG enters and progresses through bonus games");
}

async function main() {
  const dataBundle = await loadDataBundle();
  testSameSeedRng();
  testBonusFlaggedLottery(dataBundle);
  testForcedBigEvents(dataBundle);
  testSettingChangedEvent(dataBundle);
  testForcedBigEntryAndBonusProgress(dataBundle);
}

main().catch((error) => {
  console.error(`core-smoke: ${error.stack ?? error.message}`);
  process.exitCode = 1;
});
