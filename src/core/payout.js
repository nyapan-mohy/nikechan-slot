import { DEFAULT_DATA_BUNDLE } from "./default-data.js";
import { getRoleById } from "./line-evaluator.js";

export function getBonusSpec(dataBundle = DEFAULT_DATA_BUNDLE, bonusType) {
  const source = dataBundle.bonusSpec ?? DEFAULT_DATA_BUNDLE.bonusSpec;
  return source[bonusType] ?? source.bonusTypes?.[bonusType] ?? null;
}

export function betForState(state, dataBundle = DEFAULT_DATA_BUNDLE) {
  if (state.stateId === "bonusActive") {
    return getBonusSpec(dataBundle, state.bonusType)?.bet ?? 2;
  }
  return 3;
}

export function evaluatePayout({ state, win, lottery, dataBundle = DEFAULT_DATA_BUNDLE } = {}) {
  if (state.stateId === "bonusActive") {
    const bonusSpec = getBonusSpec(dataBundle, state.bonusType);
    const activeRole = dataBundle.bonusSpec?.bonusActiveRole;
    return {
      payout: bonusSpec?.payoutPerGame ?? activeRole?.payout ?? 14,
      replayReturn: 0,
      role: activeRole?.roleId ?? "BELL",
      tag: "bonusPayout"
    };
  }

  if (win?.bonusEntered) {
    return { payout: 0, replayReturn: 0, role: win.role, tag: "bonusEntered" };
  }

  if (win?.isReplay || win?.role === "REPLAY") {
    return { payout: 0, replayReturn: state.currentBet, role: "REPLAY", tag: "replay" };
  }

  const role = win?.role ? getRoleById(dataBundle, win.role) : null;
  const payout = role?.type === "smallRole" ? Number(role.payout ?? 0) : 0;
  return {
    payout,
    replayReturn: 0,
    role: win?.role ?? lottery?.smallRole ?? null,
    tag: payout > 0 ? "win" : (win?.tag ?? "miss")
  };
}

export function applyPayout(state, payoutResult) {
  const creditBefore = state.credit;
  const payout = Number(payoutResult.payout ?? 0);
  const replayReturn = Number(payoutResult.replayReturn ?? 0);
  state.credit += payout + replayReturn;
  state.totalPayout += payout + replayReturn;
  if (state.stateId === "bonusActive") {
    state.bonusGameCount += 1;
    state.bonusGrossPayout += payout;
    state.bonusNetPayout += payout - state.currentBet;
  }
  return {
    creditBefore,
    creditAfter: state.credit,
    payout,
    replayReturn,
    delta: state.credit - creditBefore
  };
}

export function isBonusComplete(state, dataBundle = DEFAULT_DATA_BUNDLE) {
  if (state.stateId !== "bonusActive") return false;
  const bonusSpec = getBonusSpec(dataBundle, state.bonusType);
  if (!bonusSpec) return false;
  if (bonusSpec.gameCount && state.bonusGameCount >= bonusSpec.gameCount) return true;
  if (bonusSpec.endByGrossPayout && state.bonusGrossPayout >= bonusSpec.endByGrossPayout) return true;
  if (bonusSpec.endByNetPayout && state.bonusNetPayout >= bonusSpec.endByNetPayout) return true;
  return false;
}
