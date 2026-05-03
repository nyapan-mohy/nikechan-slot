import { DEFAULT_DATA_BUNDLE } from "./default-data.js";
import { getDefaultSettingId } from "./lottery-table.js";

export const GAME_STATES = Object.freeze({
  NORMAL: "normal",
  BONUS_FLAGGED: "bonusFlagged",
  BONUS_SYMBOL_ENTERED: "bonusSymbolEntered",
  BONUS_ACTIVE: "bonusActive",
  BONUS_ENDING: "bonusEnding",
  ERROR: "error"
});

export function createInitialState({
  dataBundle = DEFAULT_DATA_BUNDLE,
  settingId = getDefaultSettingId(dataBundle),
  initialCredit = 10000,
  reelPositions = {}
} = {}) {
  return {
    gameNo: 0,
    displayGameCount: 0,
    settingId,
    stateId: GAME_STATES.NORMAL,
    bonusType: null,
    carriedBonus: null,
    currentBet: 0,
    credit: initialCredit,
    totalBet: 0,
    totalPayout: 0,
    reelPositions: { left: 0, center: 0, right: 0, ...reelPositions },
    bigCount: 0,
    regCount: 0,
    bonusGameCount: 0,
    bonusGrossPayout: 0,
    bonusNetPayout: 0,
    lastLottery: null,
    lastStops: null,
    lastWin: null
  };
}

export function cloneState(state) {
  return structuredCloneSafe(state);
}

export function transitionState(state, nextStateId, payload = {}) {
  const previousStateId = state.stateId;
  state.stateId = nextStateId;
  Object.assign(state, payload);
  return { from: previousStateId, to: nextStateId, ...payload };
}

export function raiseBonusFlag(state, bonusType) {
  return transitionState(state, GAME_STATES.BONUS_FLAGGED, {
    carriedBonus: bonusType,
    bonusType
  });
}

export function enterBonusSymbol(state, bonusType) {
  return transitionState(state, GAME_STATES.BONUS_SYMBOL_ENTERED, {
    carriedBonus: null,
    bonusType
  });
}

export function startBonus(state, bonusType) {
  return transitionState(state, GAME_STATES.BONUS_ACTIVE, {
    bonusType,
    carriedBonus: null,
    bonusGameCount: 0,
    bonusGrossPayout: 0,
    bonusNetPayout: 0
  });
}

export function endBonus(state) {
  return transitionState(state, GAME_STATES.BONUS_ENDING, {});
}

export function completeBonusEnding(state) {
  return transitionState(state, GAME_STATES.NORMAL, {
    bonusType: null,
    carriedBonus: null,
    bonusGameCount: 0,
    bonusGrossPayout: 0,
    bonusNetPayout: 0
  });
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
