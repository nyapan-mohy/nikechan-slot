import { createGameEngine } from "../core/index.js";
import { CabinetFlowController } from "./cabinet-flow-controller.js";
import { DataTerminal } from "./data-terminal.js";
import { ReelWindow } from "./reel-window.js";
import { TerminalLog } from "./terminal-log.js";

const DATA_FILES = {
  settings: "settings.json",
  tables: "tables.json",
  roles: "roles.json",
  reels: "reels.json",
  lines: "lines.json",
  stopControl: "stop-control.json",
  bonusSpec: "bonus-spec.json",
  symbols: "symbols.json",
  reachPatterns: "reach-patterns.json"
};
const INITIAL_CREDIT = 10000;
const SMALL_ROLES = ["REPLAY", "BELL", "RARE_CHERRY", "SUIKA"];

const bus = new EventTarget();
const els = {};
let terminalLog;
let dataTerminal;
let reelWindow;
let cabinetFlow;
let engine = null;
let dataBundle = null;
let symbolAssetMap = {};
let cabinetPlayResult = null;
let delayedCabinetLines = null;
let capturedCabinetLines = [];
let stopRequested = false;
let autoRequested = false;
let autoRunning = false;
let noWaitEnabled = false;
let forcedBonusNext = null;
let uiStats = createUiStats();

async function init() {
  bindElements();
  terminalLog = new TerminalLog(els.log);
  terminalLog.attach(bus);
  dataTerminal = new DataTerminal({
    root: els.dataTerminal,
    canvas: els.slumpGraph
  });
  dataTerminal.attach(bus);
  reelWindow = new ReelWindow({
    root: els.reelWindow,
    assetMap: symbolAssetMap
  });
  reelWindow.attach(bus);
  cabinetFlow = new CabinetFlowController({
    maxBetButton: els.cabinetMaxBet,
    startButton: els.cabinetStart,
    stopButtons: {
      left: els.cabinetStopLeft,
      center: els.cabinetStopCenter,
      right: els.cabinetStopRight
    },
    onMaxBet: handleCabinetMaxBet,
    onStart: handleCabinetStart,
    onStop: handleCabinetStop,
    onComplete: handleCabinetComplete
  });
  bindEvents();

  if (window.location.protocol === "file:") {
    showHttpWarning();
    disableControls(true);
    addLog("SYSTEM HTTP配信URLで開いてください。file:// 直開きではESM/fetchがブロックされる可能性があります。");
    publishState();
    return;
  }

  try {
    hideHttpWarning();
    symbolAssetMap = await loadSymbolAssetMap();
    reelWindow.setAssetMap(symbolAssetMap);
    dataBundle = await loadDataBundle();
    reelWindow.setDataBundle(dataBundle);
    resetGame();
  } catch (error) {
    showHttpWarning(`HTTP配信URLで開いてください。データ読込に失敗しました: ${error.message}`);
    disableControls(true);
    addLog(`SYSTEM dataLoadFailed message=${error.message}`);
    publishState();
  }
}

function bindElements() {
  [
    "setting",
    "seed",
    "pushStrategy",
    "maxGames",
    "step",
    "runUntilBonus",
    "autoMode",
    "noWait",
    "forceBig",
    "forceReg",
    "stop",
    "reset",
    "clear",
    "log",
    "statePanel",
    "dataTerminal",
    "reelWindow",
    "machineCabinet",
    "cabinetLcd",
    "cabinetNotice",
    "cabinetCredit",
    "cabinetPayout",
    "cabinetMaxBet",
    "cabinetStart",
    "cabinetStopLeft",
    "cabinetStopCenter",
    "cabinetStopRight",
    "slumpGraph",
    "httpWarning"
  ].forEach(id => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.step?.addEventListener("click", () => {
    issueCommand("step");
    playOneGame();
  });
  els.runUntilBonus?.addEventListener("click", () => {
    issueCommand("runUntilBonus");
    runUntilBonus();
  });
  els.autoMode?.addEventListener("click", toggleAutoMode);
  els.noWait?.addEventListener("click", toggleNoWait);
  els.forceBig?.addEventListener("click", () => {
    issueCommand("forceBonus", { type: "BIG" });
    reserveForcedBonus("BIG");
  });
  els.forceReg?.addEventListener("click", () => {
    issueCommand("forceBonus", { type: "REG" });
    reserveForcedBonus("REG");
  });
  els.stop?.addEventListener("click", () => {
    issueCommand("stop");
    stopRequested = true;
    autoRequested = false;
    engine?.stopSimulation("userStop");
    updateModeButtons();
  });
  els.reset?.addEventListener("click", () => {
    issueCommand("reset");
    resetGame();
  });
  els.clear?.addEventListener("click", () => {
    publish("log:clear");
  });
  els.setting?.addEventListener("change", () => {
    issueCommand("settingChanged", { settingId: els.setting.value });
    changeSetting(els.setting.value);
  });
  els.seed?.addEventListener("change", () => {
    issueCommand("seedChanged", { seed: els.seed.value });
    resetGame({ reason: "seedChanged" });
  });
}

async function loadDataBundle() {
  const entries = await Promise.all(Object.entries(DATA_FILES).map(async ([key, filename]) => {
    const response = await fetch(new URL(`../data/${filename}`, import.meta.url));
    if (!response.ok) throw new Error(`${filename}: ${response.status}`);
    return [key, await response.json()];
  }));
  return Object.fromEntries(entries);
}

async function loadSymbolAssetMap() {
  const response = await fetch(new URL("../../assets/images/symbols/symbols.json", import.meta.url));
  if (!response.ok) throw new Error(`symbols assets: ${response.status}`);
  return response.json();
}

function resetGame({ reason = "reset" } = {}) {
  if (!dataBundle) return;
  uiStats = createUiStats();
  cabinetPlayResult = null;
  delayedCabinetLines = null;
  capturedCabinetLines = [];
  forcedBonusNext = null;
  stopRequested = false;
  autoRequested = false;
  engine = createGameEngine({
    dataBundle,
    seed: parseSeed(els.seed?.value),
    settingId: els.setting?.value ?? dataBundle.settings?.defaultSettingId ?? "setting1",
    initialCredit: dataBundle.settings?.game?.initialCredit ?? INITIAL_CREDIT
  });
  attachCoreEvents(engine);
  engine.start();
  addLog(`SYSTEM ${reason} setting=${engine.getState().settingId} seed=${seedText(parseSeed(els.seed?.value))}`);
  updateModeButtons();
  disableControls(false);
  cabinetFlow?.reset({ disabled: false });
  render();
}

function attachCoreEvents(coreEngine) {
  coreEngine.on("*", event => {
    updateUiStatsFromCoreEvent(event);
    const line = formatCoreEvent(event);
    if (delayedCabinetLines && shouldDelayCabinetLine(event)) {
      delayedCabinetLines.push({ event, line });
    } else if (line) {
      addLog(line);
    }
    publish("core:event", { event });
    publishState();
  });
}

function playOneGame() {
  if (!engine) return;
  try {
    cabinetFlow?.reset({ disabled: false });
    const result = engine.play({ strategy: els.pushStrategy?.value ?? "current" });
    if (result?.error) return result;
    render();
    publish("game:complete", { snapshot: snapshot(), result });
    return result;
  } catch (error) {
    addLog(`SYSTEM playFailed message=${error.message}`);
    publishState();
    return { error };
  }
}

function handleCabinetMaxBet() {
  issueCommand("cabinetMaxBet");
  addLog(`SYSTEM cabinet MAX_BET armed bet=3`);
}

function handleCabinetStart() {
  issueCommand("cabinetStart", { strategy: els.pushStrategy?.value ?? "current" });
  if (!engine) {
    cabinetFlow?.reset({ disabled: true });
    return;
  }
  reelWindow?.startSpin(["left", "center", "right"]);
  delayedCabinetLines = [];
  capturedCabinetLines = [];
  cabinetPlayResult = null;

  try {
    const result = engine.play({ strategy: els.pushStrategy?.value ?? "current" });
    capturedCabinetLines = delayedCabinetLines ?? [];
    delayedCabinetLines = null;
    if (result?.error) {
      cabinetFlow?.reset({ disabled: false });
      reelWindow?.stopAll(engine.getState()?.reelPositions ?? {});
      render();
      return;
    }
    cabinetPlayResult = result;
    addLog(`SYSTEM cabinet REELS spinning stopOrder=left,center,right`);
    render();
  } catch (error) {
    delayedCabinetLines = null;
    capturedCabinetLines = [];
    cabinetPlayResult = null;
    reelWindow?.stopAll(engine.getState()?.reelPositions ?? {});
    cabinetFlow?.reset({ disabled: false });
    addLog(`SYSTEM cabinetStartFailed message=${error.message}`);
    render();
  }
}

function handleCabinetStop(reelId) {
  issueCommand("cabinetStop", { reelId });
  const stop = cabinetPlayResult?.stops?.[reelId];
  if (stop) {
    reelWindow?.stopReel(reelId, stop.index);
  }
  flushCabinetLines(event => event.type === "reelStopped" && event.reelId === reelId);
}

function handleCabinetComplete() {
  flushCabinetLines(event => event.type !== "reelStopped");
  const result = cabinetPlayResult;
  cabinetPlayResult = null;
  capturedCabinetLines = [];
  render();
  publish("game:complete", { snapshot: snapshot(), result });
  window.setTimeout(() => {
    if (!cabinetPlayResult) cabinetFlow?.reset({ disabled: false });
  }, 180);
}

function flushCabinetLines(predicate) {
  const keep = [];
  for (const entry of capturedCabinetLines) {
    if (predicate(entry.event)) {
      if (entry.line) addLog(entry.line);
    } else {
      keep.push(entry);
    }
  }
  capturedCabinetLines = keep;
}

function shouldDelayCabinetLine(event) {
  return [
    "reelStopped",
    "winEvaluated",
    "payoutApplied",
    "bonusSymbolEntered",
    "bonusStarted",
    "bonusEnded"
  ].includes(event.type);
}

async function runUntilBonus() {
  if (!engine) return;
  stopRequested = false;
  const maxGames = Math.max(1, Math.min(10000, Number.parseInt(els.maxGames?.value, 10) || 10000));
  addLog(`SYSTEM runUntilBonus start maxGames=${maxGames} noWait=${noWaitEnabled}`);
  for (let i = 0; i < maxGames; i += 1) {
    if (stopRequested) {
      engine.stopSimulation("userStop");
      break;
    }
    const before = engine.getState();
    const result = playOneGame();
    if (result?.error) break;
    const after = engine.getState();
    if (after.carriedBonus && after.carriedBonus !== before.carriedBonus) {
      addLog(`SYSTEM simulationStopped reason=bonusFlagRaised gameNo=${after.gameNo} bonusType=${after.carriedBonus}`);
      break;
    }
    if (!noWaitEnabled || i % 50 === 0) {
      await nextFrame();
    }
  }
}

async function runAutoMode() {
  if (autoRunning || !engine) return;
  autoRunning = true;
  stopRequested = false;
  updateModeButtons();
  addLog(`SYSTEM autoMode start noWait=${noWaitEnabled}`);

  while (autoRequested && !stopRequested) {
    const result = playOneGame();
    if (result?.error) break;
    if (noWaitEnabled) {
      if ((engine.getState().gameNo % 100) === 0) await nextFrame();
    } else {
      await sleep(120);
    }
  }

  autoRunning = false;
  autoRequested = false;
  updateModeButtons();
  addLog(`SYSTEM autoMode stop gameNo=${engine?.getState().gameNo ?? 0}`);
}

function reserveForcedBonus(type) {
  if (!engine) return;
  const state = engine.getState();
  if (state.stateId !== "normal" || state.carriedBonus) {
    addLog(`SYSTEM forceBonusRejected type=${type} reason=bonusNotNormal`);
    publishState();
    return;
  }
  forcedBonusNext = type;
  engine.setNextOutcomeOverride({ bonus: type, smallRole: null, isReplay: false });
  addLog(`SYSTEM forceBonusReserved type=${type} source=coreOverride`);
  render();
}

function changeSetting(settingId) {
  if (!engine) return;
  try {
    engine.setSetting(settingId, "ui");
    render();
  } catch (error) {
    addLog(`SYSTEM settingChangeFailed setting=${settingId} message=${error.message}`);
    if (els.setting) els.setting.value = engine.getState().settingId;
    publishState();
  }
}

function updateUiStatsFromCoreEvent(event) {
  if (event.type === "gameStarted") {
    uiStats.slumpHistory = [0];
    uiStats.bonusMarkers = [];
    uiStats.smallRoleCounts = roleCountSeed();
  }
  if (event.type === "lotteryResolved") {
    const role = event.lottery?.isReplay || event.lottery?.replay ? "REPLAY" : event.lottery?.smallRole;
    if (SMALL_ROLES.includes(role)) uiStats.smallRoleCounts[role] += 1;
  }
  if (event.type === "payoutApplied") {
    uiStats.lastPayout = Number(event.payout ?? 0) + Number(event.replayReturn ?? 0);
    uiStats.slumpHistory.push(deltaFromState(engine?.getState()));
    if (uiStats.slumpHistory.length > 1000) {
      const removed = uiStats.slumpHistory.length - 1000;
      uiStats.slumpHistory = uiStats.slumpHistory.slice(-1000);
      uiStats.bonusMarkers = uiStats.bonusMarkers
        .map(marker => ({ ...marker, index: marker.index - removed }))
        .filter(marker => marker.index >= 0);
    }
  }
  if (event.type === "bonusStarted") {
    uiStats.bonusMarkers.push({
      index: Math.max(0, uiStats.slumpHistory.length - 1),
      type: event.bonusType
    });
    if (uiStats.bonusMarkers.length > 200) {
      uiStats.bonusMarkers = uiStats.bonusMarkers.slice(-200);
    }
  }
  if (event.type === "bonusSymbolEntered") {
    uiStats.lastBonusDisplayGame = engine?.getState().displayGameCount ?? uiStats.lastBonusDisplayGame;
  }
}

function formatCoreEvent(event) {
  const gameNo = event.gameNo ?? engine?.getState().gameNo ?? 0;
  const prefix = `[${String(gameNo).padStart(6, "0")}]`;
  switch (event.type) {
    case "gameStarted":
      return `SYSTEM coreStarted setting=${event.state?.settingId} credit=${event.state?.credit}`;
    case "settingChanged":
      return `SYSTEM settingChanged from=${event.from} to=${event.to} source=${event.source}`;
    case "betAccepted":
      return `${prefix} BET bet=${event.bet} credit=${event.creditAfter}`;
    case "lotteryResolved":
      return `${prefix} LOTTERY bonus=${event.lottery?.bonus ?? "null"} smallRole=${event.lottery?.smallRole ?? "null"} replay=${Boolean(event.lottery?.isReplay || event.lottery?.replay)} table=${event.lottery?.tableId ?? "unknown"} forced=${Boolean(event.lottery?.forced)}`;
    case "bonusFlagRaised":
      return `${prefix} BONUS_FLAG type=${event.bonusType} announced=false`;
    case "stateChanged":
      return `${prefix} STATE ${event.from} -> ${event.to} bonusType=${event.bonusType ?? "null"} carriedBonus=${event.carriedBonus ?? "null"}`;
    case "reelStopped":
      return `${prefix} STOP ${String(event.reelId).toUpperCase()} push=${event.push} stop=${event.index} slip=${event.slip} reason=${event.reason} visible=[${(event.visible ?? []).join(",")}]`;
    case "winEvaluated":
      return `${prefix} STOP_RESULT line=[${(event.win?.symbols ?? []).join(",")}] tag=${event.win?.tag ?? "unknown"} bonusEntered=${Boolean(event.win?.bonusEntered)}`;
    case "payoutApplied":
      return formatPayoutEvent(prefix, event);
    case "bonusSymbolEntered":
      return `${prefix} BONUS_SYMBOL_ENTERED type=${event.bonusType}`;
    case "bonusStarted":
      return `${prefix} BONUS_STARTED type=${event.bonusType}`;
    case "bonusEnded":
      return `${prefix} BONUS_ENDED type=${event.bonusType} gameCount=${event.bonusGameCount} gross=${event.bonusGrossPayout} net=${event.bonusNetPayout}`;
    case "simulationStopped":
      return `SYSTEM simulationStopped reason=${event.reason} gameNo=${event.gameNo ?? engine?.getState().gameNo ?? 0}`;
    default:
      return null;
  }
}

function formatPayoutEvent(prefix, event) {
  if (event.tag === "replay") {
    return `${prefix} PAYOUT role=REPLAY credit=${event.creditAfter} replayReturn=${event.replayReturn}`;
  }
  if (event.payout > 0) {
    return `${prefix} PAYOUT role=${event.role ?? "null"} credit=${event.creditAfter} payout=${event.payout} delta=${formatSigned(event.delta)}`;
  }
  return `${prefix} PAYOUT role=${event.role ?? "null"} credit=${event.creditAfter} payout=0`;
}

function render() {
  const snap = snapshot();
  if (els.statePanel && snap) {
    els.statePanel.innerHTML = [
      ["state", snap.stateId],
      ["bonusType", snap.bonusType || "-"],
      ["carriedBonus", snap.carriedBonus || "-"],
      ["forcedNext", forcedBonusNext || "-"],
      ["setting", snap.settingId?.replace("setting", "設定") ?? "-"],
      ["seed", seedText(parseSeed(els.seed?.value))],
      ["gameNo", snap.gameNo],
      ["displayGames", snap.displayGameCount],
      ["bonusInterval", snap.bonusIntervalGames],
      ["credit", snap.credit],
      ["currentBet", snap.currentBet],
      ["cabinetFlow", snap.cabinetFlowState || "-"],
      ["BIG", snap.bigCount],
      ["REG", snap.regCount],
      ["delta", formatSigned(snap.delta)],
      ["peak", formatSigned(snap.slumpStats?.max ?? 0)],
      ["bottom", formatSigned(snap.slumpStats?.min ?? 0)]
    ].map(([key, value]) => `<span>${key}</span><span class="${key === "state" ? "status" : ""}">${value}</span>`).join("");
  }
  renderCabinet(snap);
  publishState();
}

function renderCabinet(snap) {
  if (!snap) return;
  const bonusLabel = snap.carriedBonus || snap.bonusType || "";
  const isBonusNotice = Boolean(bonusLabel) || snap.stateId === "bonusFlagged" || snap.stateId === "bonusActive";

  if (els.cabinetLcd) {
    els.cabinetLcd.textContent = isBonusNotice ? `${bonusLabel || "BONUS"} BONUS` : "LIVE START";
    els.cabinetLcd.classList.toggle("is-bonus", isBonusNotice);
  }
  if (els.cabinetNotice) {
    els.cabinetNotice.textContent = isBonusNotice ? `${bonusLabel || "BIG"} BONUS` : "BIG BONUS";
    els.cabinetNotice.classList.toggle("is-bonus", isBonusNotice);
  }
  if (els.cabinetCredit) {
    els.cabinetCredit.textContent = padMeter(snap.credit, 4);
  }
  if (els.cabinetPayout) {
    els.cabinetPayout.textContent = padMeter(lastPayoutFromSnapshot(snap), 3);
  }
}

function snapshot() {
  const coreState = engine?.getState();
  if (!coreState) {
    return {
      stateId: "notReady",
      gameNo: 0,
      displayGameCount: 0,
      bonusIntervalGames: 0,
      bigCount: 0,
      regCount: 0,
      smallRoleCounts: roleCountSeed(),
      slumpHistory: [0],
      bonusMarkers: [],
      slumpStats: createSlumpStats([0]),
      delta: 0
    };
  }
  const slumpHistory = [...uiStats.slumpHistory];
  return {
    ...coreState,
    bonusIntervalGames: Math.max(0, Number(coreState.displayGameCount ?? 0) - uiStats.lastBonusDisplayGame),
    smallRoleCounts: { ...uiStats.smallRoleCounts },
    slumpHistory,
    bonusMarkers: [...uiStats.bonusMarkers],
    lastPayout: uiStats.lastPayout,
    slumpStats: createSlumpStats(slumpHistory),
    forcedBonusNext,
    delta: deltaFromState(coreState),
    noWaitEnabled,
    autoRequested,
    cabinetFlowState: cabinetFlow?.state ?? "notReady"
  };
}

function publishState() {
  publish("state:update", { snapshot: snapshot() });
}

function publish(type, detail = {}) {
  bus.dispatchEvent(new CustomEvent(type, { detail }));
}

function issueCommand(command, payload = {}) {
  publish("ui:command", { command, payload, at: Date.now() });
}

function addLog(line) {
  publish("log:append", { line });
}

function toggleAutoMode() {
  autoRequested = !autoRequested;
  issueCommand(autoRequested ? "autoStart" : "autoStop", { noWait: noWaitEnabled });
  updateModeButtons();
  if (autoRequested) runAutoMode();
}

function toggleNoWait() {
  noWaitEnabled = !noWaitEnabled;
  issueCommand("toggleNoWait", { enabled: noWaitEnabled });
  updateModeButtons();
  addLog(`SYSTEM noWait ${noWaitEnabled ? "enabled" : "disabled"}`);
}

function updateModeButtons() {
  if (els.autoMode) {
    els.autoMode.textContent = autoRequested || autoRunning ? "オート停止" : "オート開始";
    els.autoMode.classList.toggle("primary", autoRequested || autoRunning);
    els.autoMode.setAttribute("aria-pressed", String(autoRequested || autoRunning));
  }
  if (els.noWait) {
    els.noWait.textContent = noWaitEnabled ? "Waitなし ON" : "Waitなし OFF";
    els.noWait.classList.toggle("primary", noWaitEnabled);
    els.noWait.setAttribute("aria-pressed", String(noWaitEnabled));
  }
}

function disableControls(disabled) {
  ["step", "runUntilBonus", "autoMode", "noWait", "forceBig", "forceReg", "stop", "reset"].forEach(id => {
    if (els[id]) els[id].disabled = disabled;
  });
  cabinetFlow?.setDisabled(disabled);
}

function showHttpWarning(message = "HTTP配信URLで開いてください。file:// 直開きではESM/fetchがブロックされる可能性があります。") {
  if (!els.httpWarning) return;
  els.httpWarning.textContent = message;
  els.httpWarning.hidden = false;
}

function hideHttpWarning() {
  if (els.httpWarning) els.httpWarning.hidden = true;
}

function createUiStats() {
  return {
    lastBonusDisplayGame: 0,
    lastPayout: 0,
    smallRoleCounts: roleCountSeed(),
    slumpHistory: [0],
    bonusMarkers: []
  };
}

function createSlumpStats(history) {
  const values = Array.isArray(history) && history.length ? history : [0];
  const numeric = values.map(value => Number(value)).filter(value => Number.isFinite(value));
  const safeValues = numeric.length ? numeric : [0];
  const latest = safeValues[safeValues.length - 1] ?? 0;
  return {
    latest,
    min: Math.min(...safeValues),
    max: Math.max(...safeValues),
    points: safeValues.length
  };
}

function roleCountSeed() {
  return SMALL_ROLES.reduce((counts, role) => {
    counts[role] = 0;
    return counts;
  }, {});
}

function parseSeed(value) {
  const raw = String(value || "").trim();
  if (raw.startsWith("0x") || raw.startsWith("0X")) {
    return Number.parseInt(raw.slice(2), 16) >>> 0;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed >>> 0 : 0x12345678;
}

function seedText(seed) {
  return "0x" + (seed >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

function deltaFromState(state) {
  return Number(state?.totalPayout ?? 0) - Number(state?.totalBet ?? 0);
}

function lastPayoutFromSnapshot(snapshot) {
  return Number.isFinite(Number(snapshot?.lastPayout)) ? Number(snapshot.lastPayout) : 0;
}

function padMeter(value, digits) {
  const number = Math.max(0, Math.trunc(Number(value) || 0));
  return String(number).padStart(digits, "0").slice(-digits);
}

function formatSigned(value) {
  const rounded = Math.round(Number(value) || 0);
  return `${rounded >= 0 ? "+" : ""}${rounded}`;
}

function nextFrame() {
  return new Promise(requestAnimationFrame);
}

function sleep(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

window.nikeSlotUi = {
  bus,
  command: issueCommand,
  getSnapshot: snapshot
};
