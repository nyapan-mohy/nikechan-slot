import { DEFAULT_DATA_BUNDLE } from "./default-data.js";
import { resolveTableForState, weightedPick } from "./lottery-table.js";

export function normalizeLotteryResult(rawResult = {}, context = {}) {
  const bonus = rawResult.bonus ?? rawResult.bonusCandidate ?? null;
  const carriedBonus = context.carriedBonus ?? null;
  const activeBonus = carriedBonus ?? bonus ?? null;
  const smallRole = rawResult.smallRole ?? rawResult.role ?? null;
  const isReplay = Boolean(rawResult.isReplay ?? rawResult.replay ?? false);
  return {
    settingId: context.settingId ?? null,
    tableId: context.tableId ?? null,
    bonus,
    bonusCandidate: bonus,
    carriedBonus,
    activeBonus,
    smallRole,
    isReplay,
    replay: isReplay,
    forced: Boolean(context.forced),
    bonusGame: Boolean(rawResult.bonusGame),
    rawResult
  };
}

export function resolveLottery({ state, dataBundle = DEFAULT_DATA_BUNDLE, rng, override = null } = {}) {
  if (!state) throw new Error("resolveLottery requires state");
  if (!rng) throw new Error("resolveLottery requires rng");

  if (override) {
    const forced = normalizeLotteryResult(override, {
      settingId: state.settingId,
      tableId: "override",
      carriedBonus: state.carriedBonus,
      forced: true
    });
    if (state.carriedBonus || state.stateId === "bonusFlagged") {
      forced.bonus = null;
      forced.bonusCandidate = null;
      forced.activeBonus = state.carriedBonus;
    }
    return forced;
  }

  const table = resolveTableForState(dataBundle, state);
  const entry = weightedPick(table, rng);
  const result = normalizeLotteryResult(entry.result, {
    settingId: state.settingId,
    tableId: table.id,
    carriedBonus: state.carriedBonus,
    forced: false
  });

  if (state.carriedBonus || state.stateId === "bonusFlagged") {
    result.bonus = null;
    result.bonusCandidate = null;
    result.activeBonus = state.carriedBonus;
  }
  return result;
}
