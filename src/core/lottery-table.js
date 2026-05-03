import { DEFAULT_DATA_BUNDLE } from "./default-data.js";

export function getSettingsList(dataBundle = DEFAULT_DATA_BUNDLE) {
  const source = dataBundle.settings ?? DEFAULT_DATA_BUNDLE.settings;
  if (Array.isArray(source)) return source;
  if (Array.isArray(source.settings)) return source.settings;
  return DEFAULT_DATA_BUNDLE.settings.settings;
}

export function getDefaultSettingId(dataBundle = DEFAULT_DATA_BUNDLE) {
  const source = dataBundle.settings ?? DEFAULT_DATA_BUNDLE.settings;
  return source.defaultSettingId ?? getSettingsList(dataBundle)[0]?.id ?? "setting1";
}

export function resolveSetting(dataBundle = DEFAULT_DATA_BUNDLE, settingId = getDefaultSettingId(dataBundle)) {
  const settings = getSettingsList(dataBundle);
  const setting = settings.find((item) => item.id === settingId);
  if (!setting) {
    throw new Error(`Unknown settingId: ${settingId}`);
  }
  return setting;
}

export function getTablesList(dataBundle = DEFAULT_DATA_BUNDLE) {
  const source = dataBundle.tables ?? DEFAULT_DATA_BUNDLE.tables;
  if (Array.isArray(source)) return source;
  if (Array.isArray(source.tables)) return source.tables;
  return DEFAULT_DATA_BUNDLE.tables.tables;
}

export function resolveTable(dataBundle = DEFAULT_DATA_BUNDLE, tableId) {
  const table = getTablesList(dataBundle).find((item) => item.id === tableId);
  if (!table) {
    throw new Error(`Unknown lottery tableId: ${tableId}`);
  }
  return table;
}

export function resolveTableForState(dataBundle = DEFAULT_DATA_BUNDLE, state = {}) {
  const setting = resolveSetting(dataBundle, state.settingId);
  if (state.stateId === "bonusActive") {
    const key = state.bonusType === "REG" ? "regTableId" : "bigTableId";
    return resolveTable(dataBundle, setting[key]);
  }
  if (state.stateId === "bonusFlagged" || state.carriedBonus) {
    return resolveTable(dataBundle, setting.bonusFlaggedTableId);
  }
  return resolveTable(dataBundle, setting.lotteryTableId);
}

export function validateTable(table) {
  if (!table || !Array.isArray(table.entries)) {
    throw new Error("Lottery table must include entries");
  }
  const denominator = Number(table.denominator);
  if (!Number.isFinite(denominator) || denominator <= 0) {
    throw new Error(`Lottery table ${table.id ?? "(unknown)"} has invalid denominator`);
  }
  const totalWeight = table.entries.reduce((sum, entry) => sum + normalizedWeight(entry), 0);
  if (totalWeight > denominator) {
    throw new Error(`Lottery table ${table.id ?? "(unknown)"} weights exceed denominator`);
  }
  return { tableId: table.id, denominator, totalWeight, noneWeight: denominator - totalWeight };
}

export function weightedPick(table, rng) {
  const validation = validateTable(table);
  let pick = rng.nextInt(validation.denominator);
  for (const entry of table.entries) {
    const weight = normalizedWeight(entry);
    if (weight <= 0) continue;
    if (pick < weight) return entry;
    pick -= weight;
  }
  return { result: { bonus: null, smallRole: null, isReplay: false }, weight: validation.noneWeight };
}

function normalizedWeight(entry) {
  const weight = Number(entry?.weight ?? 0);
  return Number.isFinite(weight) && weight > 0 ? weight : 0;
}
