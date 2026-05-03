import { getReelKeys, getReels, visibleSymbols } from "../core/line-evaluator.js";

const REEL_KEYS = ["left", "center", "right"];
const ROW_LABELS = ["上段", "中段", "下段"];
const SYMBOL_ASSET_ALIASES = {
  RED7: "AI_NIKECHAN",
  BAR: "LOGO_BAR",
  SUIKA: "WATERMELON"
};

export class ReelWindow {
  constructor(options = {}) {
    this.root = options.root ?? null;
    this.assetMap = normalizeAssetMap(options.assetMap);
    this.dataBundle = null;
    this.reels = null;
    this.reelKeys = REEL_KEYS;
    this.positions = Object.fromEntries(this.reelKeys.map(key => [key, 0]));
    this.spinning = Object.fromEntries(this.reelKeys.map(key => [key, false]));
    this.lastWinLineId = null;

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
  }

  setAssetMap(assetMap) {
    this.assetMap = normalizeAssetMap(assetMap);
    this.render();
  }

  setDataBundle(dataBundle) {
    this.dataBundle = dataBundle ?? null;
    this.reels = this.dataBundle ? getReels(this.dataBundle) : null;
    this.reelKeys = this.dataBundle ? getReelKeys(this.dataBundle) : this.reelKeys;
    this.positions = {
      ...Object.fromEntries(this.reelKeys.map(key => [key, 0])),
      ...this.positions
    };
    this.spinning = {
      ...Object.fromEntries(this.reelKeys.map(key => [key, false])),
      ...this.spinning
    };
    this.render();
  }

  applySnapshot(snapshot) {
    if (!snapshot) return;
    const incomingPositions = snapshot.reelPositions ?? {};
    for (const key of this.reelKeys) {
      if (!this.spinning[key] && Number.isFinite(Number(incomingPositions[key]))) {
        this.positions[key] = incomingPositions[key];
      }
    }
    this.lastWinLineId = snapshot.lastWin?.lineId ?? null;
    this.render();
  }

  startSpin(reelIds = this.reelKeys) {
    for (const reelId of reelIds) {
      if (this.reelKeys.includes(reelId)) this.spinning[reelId] = true;
    }
    this.render();
  }

  stopReel(reelId, index) {
    if (!this.reelKeys.includes(reelId)) return;
    if (Number.isFinite(Number(index))) this.positions[reelId] = Number(index);
    this.spinning[reelId] = false;
    this.render();
  }

  stopAll(finalPositions = {}) {
    for (const reelId of this.reelKeys) {
      this.stopReel(reelId, finalPositions[reelId]);
    }
  }

  render() {
    if (!this.root) return;
    this.root.innerHTML = this.buildMarkup();
  }

  buildMarkup() {
    const reels = this.reels ?? {};
    const reelMarkup = this.reelKeys.map((key, reelIndex) => {
      const symbols = Array.isArray(reels[key]) ? reels[key] : [];
      const centerIndex = Number(this.positions[key] ?? 0);
      const isSpinning = Boolean(this.spinning[key]);
      const visible = isSpinning ? spinningSymbols(symbols, centerIndex) : visibleSymbols(symbols, centerIndex);
      const cells = visible.map((symbolId, rowIndex) => {
        const asset = this.assetFor(symbolId);
        const isPayline = !isSpinning && rowIndex === 1;
        return `
          <div class="reel-window__cell${isPayline ? " is-payline" : ""}" aria-label="${ROW_LABELS[rowIndex]} ${asset.label}">
            <img src="${asset.src}" alt="${asset.label}" draggable="false">
            <span>${asset.shortLabel}</span>
          </div>
        `;
      }).join("");

      return `
        <div class="reel-window__reel${isSpinning ? " is-spinning" : ""}" aria-label="${reelLabel(key, reelIndex)}リール">
          ${cells}
        </div>
      `;
    }).join("");

    return `
      <div class="reel-window__frame" role="group" aria-label="リール窓">
        <div class="reel-window__payline" aria-hidden="true"></div>
        <div class="reel-window__shade reel-window__shade--top" aria-hidden="true"></div>
        <div class="reel-window__shade reel-window__shade--bottom" aria-hidden="true"></div>
        <div class="reel-window__reels">${reelMarkup}</div>
      </div>
    `;
  }

  assetFor(symbolId) {
    const assetKey = SYMBOL_ASSET_ALIASES[symbolId] ?? symbolId;
    const asset = this.assetMap[assetKey] ?? this.assetMap[symbolId] ?? {};
    const label = asset.label ?? symbolId ?? "-";
    return {
      label,
      shortLabel: shortLabel(label, symbolId),
      src: asset.src ?? ""
    };
  }
}

function spinningSymbols(symbols, centerIndex) {
  if (!symbols.length) return [];
  return Array.from({ length: 9 }, (_, offset) => {
    const index = (centerIndex + offset + symbols.length) % symbols.length;
    return symbols[index];
  });
}

function normalizeAssetMap(source = {}) {
  return Object.fromEntries(Object.entries(source).map(([key, value]) => {
    const src = value?.src ?? "";
    return [key, {
      ...value,
      src: src.startsWith("/") || src.startsWith("http") ? src : `./${src}`
    }];
  }));
}

function reelLabel(key, index) {
  return {
    left: "左",
    center: "中",
    right: "右"
  }[key] ?? String(index + 1);
}

function shortLabel(label, symbolId) {
  if (symbolId === "AI_NIKECHAN") return "7";
  if (symbolId === "MASTER_NIKECHAN") return "DON";
  if (symbolId === "RED7") return "7";
  if (symbolId === "LOGO_BAR" || symbolId === "BAR") return "BAR";
  return label;
}
