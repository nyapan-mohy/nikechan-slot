import { drawSlumpGraph } from "./slump-graph.js";

const SMALL_ROLES = ["REPLAY", "BELL", "RARE_CHERRY", "SUIKA"];
const ROLE_LABELS = {
  REPLAY: "リプレイ",
  BELL: "ベル",
  RARE_CHERRY: "レアチェリー",
  SUIKA: "スイカ"
};

export class DataTerminal {
  constructor(options = {}) {
    this.root = options.root ?? null;
    this.canvas = options.canvas ?? null;
    this.state = createInitialState();
    this.resizeHandler = () => this.renderGraph();

    window.addEventListener("resize", this.resizeHandler);
    this.render();
  }

  attach(bus) {
    if (!bus || typeof bus.addEventListener !== "function") return;
    bus.addEventListener("state:update", event => {
      this.applySnapshot(event.detail?.snapshot);
    });
    bus.addEventListener("game:complete", event => {
      this.applySnapshot(event.detail?.snapshot);
    });
    bus.addEventListener("ui:command", event => {
      const command = event.detail?.command ?? "-";
      this.state.lastCommand = command;
      this.render();
    });
  }

  applySnapshot(snapshot) {
    if (!snapshot) return;
    this.state = {
      ...this.state,
      currentState: snapshot.stateId ?? this.state.currentState,
      activeGameCount: numberOr(snapshot.displayGameCount, numberOr(snapshot.gameNo, this.state.activeGameCount)),
      bonusIntervalGames: numberOr(snapshot.bonusIntervalGames, this.state.bonusIntervalGames),
      bigCount: numberOr(snapshot.bigCount, this.state.bigCount),
      regCount: numberOr(snapshot.regCount, this.state.regCount),
      displayGameCount: numberOr(snapshot.displayGameCount, this.state.displayGameCount),
      smallRoleCounts: normalizeRoleCounts(snapshot.smallRoleCounts, this.state.smallRoleCounts),
      slumpHistory: normalizeHistory(snapshot.slumpHistory, this.state.slumpHistory),
      bonusMarkers: normalizeBonusMarkers(snapshot.bonusMarkers, this.state.bonusMarkers),
      slumpStats: normalizeSlumpStats(snapshot.slumpStats, snapshot.slumpHistory, this.state.slumpStats),
      delta: numberOr(snapshot.delta, this.state.delta)
    };
    this.render();
  }

  render() {
    if (this.root) {
      this.root.innerHTML = this.buildMarkup();
    }
    this.renderGraph();
  }

  renderGraph() {
    drawSlumpGraph(this.canvas, this.state.slumpHistory, {
      markers: this.state.bonusMarkers
    });
  }

  buildMarkup() {
    const games = Math.max(0, this.state.displayGameCount || this.state.activeGameCount);
    const bonusTotal = this.state.bigCount + this.state.regCount;
    const bonusProbability = formatProbability(games, bonusTotal);
    const smallRoleRows = SMALL_ROLES.map(role => {
      const count = this.state.smallRoleCounts[role] ?? 0;
      return `
        <div class="data-terminal__role">
          <span>${ROLE_LABELS[role]}</span>
          <span>${count} / ${formatProbability(games, count)}</span>
        </div>
      `;
    }).join("");

    return `
      <div class="data-terminal__grid">
        ${metric("現在状態", this.state.currentState)}
        ${metric("動作回転数", this.state.activeGameCount)}
        ${metric("ボーナス間ゲーム数", this.state.bonusIntervalGames)}
        ${metric("BIG回数", this.state.bigCount)}
        ${metric("REG回数", this.state.regCount)}
        ${metric("大当たり確率", bonusProbability)}
        ${metric("差枚", formatSigned(this.state.delta), this.state.delta >= 0 ? "status" : "warning")}
        ${metric("最高差枚", formatSigned(this.state.slumpStats.max), "status")}
        ${metric("最低差枚", formatSigned(this.state.slumpStats.min), "warning")}
        ${metric("UIコマンド", this.state.lastCommand)}
      </div>
      <div class="data-terminal__section-title">小役成立数 / 確率</div>
      <div class="data-terminal__roles">${smallRoleRows}</div>
      <div class="data-terminal__section-title">スランプグラフ差枚履歴</div>
      <div class="data-terminal__history">${historySummary(this.state.slumpHistory)}</div>
    `;
  }
}

function createInitialState() {
  return {
    currentState: "boot",
    activeGameCount: 0,
    bonusIntervalGames: 0,
    displayGameCount: 0,
    bigCount: 0,
    regCount: 0,
    smallRoleCounts: normalizeRoleCounts(),
    slumpHistory: [0],
    bonusMarkers: [],
    slumpStats: normalizeSlumpStats(null, [0]),
    delta: 0,
    lastCommand: "-"
  };
}

function metric(label, value, className = "") {
  const valueClass = className ? ` class="${className}"` : "";
  return `<span>${label}</span><span${valueClass}>${value ?? "-"}</span>`;
}

function normalizeRoleCounts(source = {}, fallback = {}) {
  return SMALL_ROLES.reduce((counts, role) => {
    counts[role] = numberOr(source?.[role], numberOr(fallback?.[role], 0));
    return counts;
  }, {});
}

function normalizeHistory(source, fallback = [0]) {
  const values = Array.isArray(source) ? source : fallback;
  const numeric = values
    .map(value => Number(value))
    .filter(value => Number.isFinite(value));
  return numeric.length > 0 ? numeric : [0];
}

function normalizeBonusMarkers(source, fallback = []) {
  const values = Array.isArray(source) ? source : fallback;
  return values
    .map(marker => ({
      index: Number.parseInt(marker?.index, 10),
      type: marker?.type === "REG" ? "REG" : "BIG"
    }))
    .filter(marker => Number.isFinite(marker.index) && marker.index >= 0);
}

function normalizeSlumpStats(source, historySource, fallback = null) {
  if (source && typeof source === "object") {
    return {
      latest: numberOr(source.latest, 0),
      min: numberOr(source.min, 0),
      max: numberOr(source.max, 0),
      points: numberOr(source.points, 1)
    };
  }
  if (fallback && typeof fallback === "object") return fallback;
  const values = normalizeHistory(historySource);
  return {
    latest: values[values.length - 1] ?? 0,
    min: Math.min(...values),
    max: Math.max(...values),
    points: values.length
  };
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatProbability(games, count) {
  if (!count || !games) return "-";
  return `1/${(games / count).toFixed(1)}`;
}

function formatSigned(value) {
  const rounded = Math.round(Number(value) || 0);
  return `${rounded >= 0 ? "+" : ""}${rounded}`;
}

function historySummary(history) {
  const values = normalizeHistory(history);
  const latestValues = values.slice(-8).map(formatSigned).join(" ");
  return `points=${values.length} latest=[${latestValues}]`;
}
