import { DEFAULT_DATA_BUNDLE, DEFAULT_REEL_KEYS } from "./default-data.js";

export function getRoleDefinitions(dataBundle = DEFAULT_DATA_BUNDLE) {
  const source = dataBundle.roles ?? DEFAULT_DATA_BUNDLE.roles;
  const roles = Array.isArray(source) ? source : source.roles;
  return roles ?? DEFAULT_DATA_BUNDLE.roles.roles;
}

export function getRoleById(dataBundle = DEFAULT_DATA_BUNDLE, roleId) {
  return getRoleDefinitions(dataBundle).find((role) => role.id === roleId || role.bonusType === roleId) ?? null;
}

export function getLines(dataBundle = DEFAULT_DATA_BUNDLE) {
  const source = dataBundle.lines ?? DEFAULT_DATA_BUNDLE.lines;
  const lines = Array.isArray(source) ? source : source.lines;
  const activeLineIds = Array.isArray(source?.activeLineIds) ? new Set(source.activeLineIds) : null;
  return (lines ?? DEFAULT_DATA_BUNDLE.lines.lines)
    .filter((line) => line.enabled !== false)
    .filter((line) => !activeLineIds || activeLineIds.has(line.id));
}

export function getReelKeys(dataBundle = DEFAULT_DATA_BUNDLE) {
  return dataBundle.stopControl?.reelKeys
    ?? dataBundle.stopControl?.stopOrder
    ?? dataBundle.reels?.reelKeys
    ?? dataBundle.reels?.stops
    ?? dataBundle.settings?.game?.stops
    ?? DEFAULT_REEL_KEYS;
}

export function getReels(dataBundle = DEFAULT_DATA_BUNDLE) {
  const source = dataBundle.reels ?? DEFAULT_DATA_BUNDLE.reels;
  if (Array.isArray(source)) {
    return Object.fromEntries(source.map((reel, index) => [reel.id ?? DEFAULT_REEL_KEYS[index], reel.symbols ?? reel]));
  }
  if (Array.isArray(source.reels)) {
    return Object.fromEntries(source.reels.map((reel, index) => [reel.id ?? DEFAULT_REEL_KEYS[index], reel.symbols ?? reel]));
  }
  return source.reels ?? source;
}

export function visibleSymbols(reelSymbols, centerIndex) {
  const length = reelSymbols.length;
  return [
    reelSymbols[mod(centerIndex - 1, length)],
    reelSymbols[mod(centerIndex, length)],
    reelSymbols[mod(centerIndex + 1, length)]
  ];
}

export function symbolsForLine(stops, line, dataBundle = DEFAULT_DATA_BUNDLE) {
  const reels = getReels(dataBundle);
  const reelKeys = getReelKeys(dataBundle);
  return reelKeys.map((key, index) => {
    const stop = typeof stops[key] === "number" ? { index: stops[key] } : stops[key];
    const visible = visibleSymbols(reels[key], stop.index);
    const position = Array.isArray(line.positions) ? line.positions[index] : line.positions?.[key];
    return visible[position ?? 1];
  });
}

export function lineMatches(symbols, pattern) {
  return pattern.every((symbol, index) => {
    if (symbol === "ANY") return true;
    if (Array.isArray(symbol)) return symbol.includes(symbols[index]);
    return symbols[index] === symbol;
  });
}

export function matchedRolesForSymbols(symbols, dataBundle = DEFAULT_DATA_BUNDLE) {
  return getRoleDefinitions(dataBundle).filter((role) => Array.isArray(role.winningPattern) && lineMatches(symbols, role.winningPattern));
}

export function evaluateLines({ stops, lottery, dataBundle = DEFAULT_DATA_BUNDLE } = {}) {
  const matches = [];
  for (const line of getLines(dataBundle)) {
    const symbols = symbolsForLine(stops, line, dataBundle);
    for (const role of matchedRolesForSymbols(symbols, dataBundle)) {
      matches.push({ lineId: line.id, line, symbols, role });
    }
  }
  const allowed = matches.filter((match) => isRoleAllowed(match.role, lottery));
  const best = chooseBestMatch(allowed, lottery);
  const denied = matches.filter((match) => !isRoleAllowed(match.role, lottery));
  return {
    matches,
    allowed,
    denied,
    role: best?.role?.id ?? null,
    roleType: best?.role?.type ?? null,
    lineId: best?.lineId ?? null,
    symbols: best?.symbols ?? symbolsForLine(stops, getLines(dataBundle)[0], dataBundle),
    bonusEntered: best?.role?.type === "bonus",
    isReplay: best?.role?.type === "replay",
    deniedRoleIds: denied.map((match) => match.role.id)
  };
}

export function isRoleAllowed(role, lottery = {}) {
  if (!role) return true;
  if (role.type === "bonus") return role.bonusType === lottery.activeBonus || role.id === lottery.activeBonus;
  if (role.type === "replay") return Boolean(lottery.isReplay || lottery.replay);
  if (role.type === "smallRole") return role.id === lottery.smallRole;
  return false;
}

function chooseBestMatch(matches, lottery = {}) {
  return [...matches].sort((a, b) => rolePriority(b.role, lottery) - rolePriority(a.role, lottery))[0] ?? null;
}

function rolePriority(role, lottery = {}) {
  if (role.type === "bonus" && (role.bonusType === lottery.activeBonus || role.id === lottery.activeBonus)) return 100;
  if (role.type === "replay") return 80;
  if (role.id === "BELL") return 70;
  if (role.type === "smallRole") return 60;
  return 0;
}

function mod(value, length) {
  return ((value % length) + length) % length;
}
