import { DEFAULT_DATA_BUNDLE } from "./default-data.js";
import {
  evaluateLines,
  getLines,
  getReelKeys,
  getReels,
  getRoleById,
  isRoleAllowed,
  matchedRolesForSymbols,
  symbolsForLine,
  visibleSymbols
} from "./line-evaluator.js";

export function candidateIndexes(pushPosition, reelLength, maxSlip) {
  return Array.from({ length: maxSlip + 1 }, (_, slip) => ({
    index: mod(Number(pushPosition) + slip, reelLength),
    slip
  }));
}

export function chooseStops({ pushes, lottery, dataBundle = DEFAULT_DATA_BUNDLE } = {}) {
  const reels = getReels(dataBundle);
  const reelKeys = getReelKeys(dataBundle);
  const maxSlip = Number(dataBundle.stopControl?.maxSlip ?? 5);
  const normalizedPushes = normalizePushes(pushes, reels, reelKeys);
  const candidateGroups = reelKeys.map((key) => candidateIndexes(normalizedPushes[key], reels[key].length, maxSlip));
  let best = null;

  for (const combo of cartesian(candidateGroups)) {
    const stops = Object.fromEntries(reelKeys.map((key, index) => [key, combo[index]]));
    const score = scoreStops(stops, lottery, dataBundle);
    if (score.invalidRoleCount > 0) continue;
    if (!best || compareScore(score, best.score) > 0) {
      best = { stops, score };
    }
  }

  if (!best) {
    for (const combo of cartesian(candidateGroups)) {
      const stops = Object.fromEntries(reelKeys.map((key, index) => [key, combo[index]]));
      const score = scoreStops(stops, lottery, dataBundle);
      if (!best || compareScore(score, best.score) > 0) {
        best = { stops, score };
      }
    }
  }

  const selectedStops = best.stops;
  const evaluation = evaluateLines({ stops: selectedStops, lottery, dataBundle });
  const stopReasons = reasonForStops(selectedStops, evaluation, lottery, dataBundle);
  const result = {};
  for (const key of reelKeys) {
    const stop = selectedStops[key];
    result[key] = {
      ...stop,
      push: normalizedPushes[key],
      reason: stopReasons[key],
      visible: visibleSymbols(reels[key], stop.index)
    };
  }
  return { stops: result, evaluation, score: best.score };
}

export function choosePushes({ strategy = "current", lottery = {}, state = {}, dataBundle = DEFAULT_DATA_BUNDLE, rng } = {}) {
  const reels = getReels(dataBundle);
  const reelKeys = getReelKeys(dataBundle);
  return Object.fromEntries(reelKeys.map((key, index) => {
    const reel = reels[key];
    if (strategy === "bonusAim" && lottery.activeBonus) {
      const role = getRoleById(dataBundle, lottery.activeBonus);
      const target = role?.winningPattern?.[index];
      const targetIndex = targetIndexForPattern(reel, target);
      return [key, targetIndex >= 0 ? targetIndex : currentPositionFor(state, key)];
    }
    if (strategy === "rareAim" && lottery.smallRole) {
      const role = getRoleById(dataBundle, lottery.smallRole);
      const target = role?.winningPattern?.[index];
      const targetIndex = targetIndexForPattern(reel, target);
      return [key, targetIndex >= 0 ? targetIndex : currentPositionFor(state, key)];
    }
    if (strategy === "pseudoRandom") {
      if (!rng) throw new Error("pseudoRandom push strategy requires rng");
      return [key, rng.nextInt(reel.length)];
    }
    return [key, currentPositionFor(state, key)];
  }));
}

function scoreStops(stops, lottery, dataBundle) {
  const lines = getLines(dataBundle);
  let invalidRoleCount = 0;
  let allowedPriority = 0;
  let missPriority = lottery.activeBonus ? 30 : 10;
  const matchedRoleIds = [];

  for (const line of lines) {
    const symbols = symbolsForLine(stops, line, dataBundle);
    for (const role of matchedRolesForSymbols(symbols, dataBundle)) {
      matchedRoleIds.push(role.id);
      if (!isRoleAllowed(role, lottery)) {
        invalidRoleCount += 1;
      } else {
        allowedPriority = Math.max(allowedPriority, roleScore(role, lottery));
      }
    }
  }

  if (lottery.smallRole) {
    const role = getRoleById(dataBundle, lottery.smallRole);
    if (role?.requiresAim && allowedPriority === 0) missPriority = Math.max(missPriority, 40);
  }

  const totalSlip = Object.values(stops).reduce((sum, stop) => sum + stop.slip, 0);
  return {
    invalidRoleCount,
    allowedPriority,
    missPriority,
    totalSlip,
    matchedRoleIds,
    value: invalidRoleCount === 0 ? Math.max(allowedPriority, missPriority) : -invalidRoleCount
  };
}

function roleScore(role, lottery) {
  if (role.type === "bonus" && (role.id === lottery.activeBonus || role.bonusType === lottery.activeBonus)) return 100;
  if (role.type === "replay") return lottery.activeBonus ? 80 : 70;
  if (role.id === "BELL") return lottery.activeBonus ? 75 : 65;
  if (role.type === "smallRole") return lottery.activeBonus ? 70 : 60;
  return 0;
}

function reasonForStops(stops, evaluation, lottery, dataBundle) {
  const reelKeys = getReelKeys(dataBundle);
  const role = evaluation.role ? getRoleById(dataBundle, evaluation.role) : null;
  const reason = {};
  for (const key of reelKeys) {
    if (role?.type === "bonus") reason[key] = "bonus";
    else if (role?.type === "replay") reason[key] = "replay";
    else if (role?.id === "BELL") reason[key] = "smallRole";
    else if (role?.id === "SUIKA") reason[key] = "suika";
    else if (role?.id === "RARE_CHERRY") reason[key] = "rare";
    else if (lottery.smallRole === "SUIKA") reason[key] = "suikaMiss";
    else if (lottery.smallRole === "RARE_CHERRY") reason[key] = "rareMiss";
    else if (lottery.activeBonus) reason[key] = "reachPattern";
    else reason[key] = "blank";
  }
  return reason;
}

function normalizePushes(pushes, reels, reelKeys) {
  if (Array.isArray(pushes)) {
    return Object.fromEntries(reelKeys.map((key, index) => [key, mod(pushes[index] ?? 0, reels[key].length)]));
  }
  return Object.fromEntries(reelKeys.map((key) => [key, mod(pushes?.[key] ?? 0, reels[key].length)]));
}

function compareScore(a, b) {
  if (a.value !== b.value) return a.value - b.value;
  if (a.invalidRoleCount !== b.invalidRoleCount) return b.invalidRoleCount - a.invalidRoleCount;
  return b.totalSlip - a.totalSlip;
}

function currentPositionFor(state, key) {
  return Number(state.reelPositions?.[key] ?? 0);
}

function targetIndexForPattern(reel, target) {
  if (!target || target === "ANY") return -1;
  if (!Array.isArray(target)) return reel.indexOf(target);
  const indexes = target.map((symbol) => reel.indexOf(symbol)).filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : -1;
}

function cartesian(groups) {
  return groups.reduce((acc, group) => acc.flatMap((items) => group.map((item) => [...items, item])), [[]]);
}

function mod(value, length) {
  return ((value % length) + length) % length;
}
