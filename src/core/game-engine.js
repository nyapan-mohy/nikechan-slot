import { DEFAULT_DATA_BUNDLE } from "./default-data.js";
import { EventBus } from "./event-bus.js";
import {
  cloneState,
  completeBonusEnding,
  createInitialState,
  endBonus,
  enterBonusSymbol,
  GAME_STATES,
  raiseBonusFlag,
  startBonus
} from "./game-state.js";
import { resolveLottery } from "./lottery.js";
import { resolveSetting } from "./lottery-table.js";
import { choosePushes, chooseStops } from "./reel-control.js";
import { createRng } from "./rng.js";
import { applyPayout, betForState, evaluatePayout, isBonusComplete } from "./payout.js";

export class GameEngine {
  constructor({
    dataBundle = DEFAULT_DATA_BUNDLE,
    seed = 0x12345678,
    settingId,
    initialCredit = 10000,
    eventBus = new EventBus()
  } = {}) {
    this.dataBundle = dataBundle;
    this.rng = createRng(seed);
    this.eventBus = eventBus;
    this.state = createInitialState({ dataBundle, settingId, initialCredit });
    this.nextOutcomeOverride = null;
  }

  on(type, listener) {
    return this.eventBus.on(type, listener);
  }

  getState() {
    return cloneState(this.state);
  }

  start() {
    this.emit("gameStarted", { state: this.getState(), rngState: this.rng.getState() });
    return this.getState();
  }

  setSetting(settingId, source = "core") {
    resolveSetting(this.dataBundle, settingId);
    const from = this.state.settingId;
    this.state.settingId = settingId;
    this.emit("settingChanged", { from, to: settingId, source });
    return this.getState();
  }

  setNextOutcomeOverride(outcome) {
    this.nextOutcomeOverride = outcome ? { ...outcome } : null;
  }

  stopSimulation(reason = "userStop") {
    this.emit("simulationStopped", { reason, gameNo: this.state.gameNo, state: this.getState() });
  }

  play({ pushes = null, strategy = "current" } = {}) {
    if (this.state.stateId === GAME_STATES.BONUS_ENDING) {
      const transition = completeBonusEnding(this.state);
      this.emit("stateChanged", transitionEvent(transition, this.state));
      return { state: this.getState(), skippedGame: true };
    }

    const bet = betForState(this.state, this.dataBundle);
    if (this.state.credit < bet) {
      this.state.stateId = GAME_STATES.ERROR;
      this.emit("simulationStopped", { reason: "creditShortage", credit: this.state.credit, requiredBet: bet });
      return { state: this.getState(), error: "creditShortage" };
    }

    this.state.gameNo += 1;
    if (this.state.stateId !== GAME_STATES.BONUS_ACTIVE) this.state.displayGameCount += 1;
    this.acceptBet(bet);

    const override = this.nextOutcomeOverride;
    this.nextOutcomeOverride = null;
    const lottery = resolveLottery({ state: this.state, dataBundle: this.dataBundle, rng: this.rng, override });
    this.state.lastLottery = lottery;
    this.emit("lotteryResolved", { gameNo: this.state.gameNo, lottery });

    if (lottery.bonus && !this.state.carriedBonus && this.state.stateId === GAME_STATES.NORMAL) {
      const transition = raiseBonusFlag(this.state, lottery.bonus);
      this.emit("bonusFlagRaised", { gameNo: this.state.gameNo, bonusType: lottery.bonus, lottery });
      this.emit("stateChanged", transitionEvent(transition, this.state));
      lottery.activeBonus = lottery.bonus;
      lottery.carriedBonus = lottery.bonus;
    }

    const normalizedPushes = pushes ?? choosePushes({ strategy, lottery, state: this.state, dataBundle: this.dataBundle, rng: this.rng });
    const stopResult = chooseStops({ pushes: normalizedPushes, lottery, dataBundle: this.dataBundle });
    this.state.lastStops = stopResult.stops;
    for (const [reelId, stop] of Object.entries(stopResult.stops)) {
      this.state.reelPositions[reelId] = stop.index;
      this.emit("reelStopped", { gameNo: this.state.gameNo, reelId, ...stop });
    }

    const win = this.buildWinResult(stopResult, lottery);
    this.state.lastWin = win;
    this.emit("winEvaluated", { gameNo: this.state.gameNo, win, lottery, stops: stopResult.stops });

    const payoutResult = evaluatePayout({ state: this.state, win, lottery, dataBundle: this.dataBundle });
    const creditChange = applyPayout(this.state, payoutResult);
    this.emit("payoutApplied", { gameNo: this.state.gameNo, ...payoutResult, ...creditChange });
    if (creditChange.creditBefore !== creditChange.creditAfter) {
      this.emit("creditChanged", { from: creditChange.creditBefore, to: creditChange.creditAfter, reason: "payout" });
    }

    if (win.bonusEntered) {
      this.handleBonusEntered(win.role);
    }

    if (isBonusComplete(this.state, this.dataBundle)) {
      const bonusType = this.state.bonusType;
      const summary = {
        bonusType,
        bonusGameCount: this.state.bonusGameCount,
        bonusGrossPayout: this.state.bonusGrossPayout,
        bonusNetPayout: this.state.bonusNetPayout
      };
      const transition = endBonus(this.state);
      this.emit("bonusEnded", summary);
      this.emit("stateChanged", transitionEvent(transition, this.state));
    }

    return {
      state: this.getState(),
      lottery,
      stops: stopResult.stops,
      win,
      payout: payoutResult
    };
  }

  acceptBet(bet) {
    const creditBefore = this.state.credit;
    this.state.currentBet = bet;
    this.state.credit -= bet;
    this.state.totalBet += bet;
    this.emit("betAccepted", { gameNo: this.state.gameNo, bet, creditBefore, creditAfter: this.state.credit });
    this.emit("creditChanged", { from: creditBefore, to: this.state.credit, reason: "bet" });
  }

  buildWinResult(stopResult, lottery) {
    const evaluation = stopResult.evaluation;
    if (this.state.stateId === GAME_STATES.BONUS_ACTIVE) {
      return { role: "BELL", lineId: evaluation.lineId ?? "bonus", payout: 14, tag: "bonusPayout", bonusEntered: false, isReplay: false };
    }
    if (evaluation.bonusEntered) {
      return { role: evaluation.role, lineId: evaluation.lineId, symbols: evaluation.symbols, payout: 0, tag: "bonusEntered", bonusEntered: true, isReplay: false };
    }
    if (evaluation.isReplay) {
      return { role: "REPLAY", lineId: evaluation.lineId, symbols: evaluation.symbols, payout: 0, tag: "replay", bonusEntered: false, isReplay: true };
    }
    if (evaluation.role) {
      return { role: evaluation.role, lineId: evaluation.lineId, symbols: evaluation.symbols, payout: null, tag: "win", bonusEntered: false, isReplay: false };
    }
    const reasons = Object.values(stopResult.stops).map((stop) => stop.reason);
    const tag = reasons.includes("suikaMiss") ? "suikaMiss"
      : reasons.includes("rareMiss") ? "rareMiss"
        : lottery.activeBonus ? "reachPattern" : "miss";
    return { role: null, lineId: null, symbols: evaluation.symbols, payout: 0, tag, bonusEntered: false, isReplay: false };
  }

  handleBonusEntered(bonusType) {
    if (bonusType === "BIG") this.state.bigCount += 1;
    if (bonusType === "REG") this.state.regCount += 1;
    const enteredTransition = enterBonusSymbol(this.state, bonusType);
    this.emit("bonusSymbolEntered", { gameNo: this.state.gameNo, bonusType });
    this.emit("stateChanged", transitionEvent(enteredTransition, this.state));
    const activeTransition = startBonus(this.state, bonusType);
    this.emit("bonusStarted", { gameNo: this.state.gameNo, bonusType });
    this.emit("stateChanged", transitionEvent(activeTransition, this.state));
  }

  emit(type, payload = {}) {
    return this.eventBus.emit(type, payload);
  }
}

export function createGameEngine(options) {
  return new GameEngine(options);
}

function transitionEvent(transition, state) {
  return {
    from: transition.from,
    to: transition.to,
    bonusType: state.bonusType,
    carriedBonus: state.carriedBonus,
    state: cloneState(state)
  };
}
