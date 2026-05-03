const REEL_ORDER = ["left", "center", "right"];

export class CabinetFlowController {
  constructor({
    maxBetButton = null,
    startButton = null,
    stopButtons = {},
    onMaxBet = null,
    onStart = null,
    onStop = null,
    onComplete = null
  } = {}) {
    this.maxBetButton = maxBetButton;
    this.startButton = startButton;
    this.stopButtons = stopButtons;
    this.onMaxBet = onMaxBet;
    this.onStart = onStart;
    this.onStop = onStop;
    this.onComplete = onComplete;
    this.disabled = false;
    this.state = "readyForBet";
    this.stopped = new Set();

    this.bind();
    this.render();
  }

  bind() {
    this.maxBetButton?.addEventListener("click", () => this.maxBet());
    this.startButton?.addEventListener("click", () => this.start());
    for (const reelId of REEL_ORDER) {
      this.stopButtons[reelId]?.addEventListener("click", () => this.stop(reelId));
    }
  }

  reset({ disabled = this.disabled } = {}) {
    this.disabled = Boolean(disabled);
    this.state = "readyForBet";
    this.stopped = new Set();
    this.render();
  }

  setDisabled(disabled) {
    this.disabled = Boolean(disabled);
    this.render();
  }

  maxBet() {
    if (!this.canMaxBet()) return;
    this.state = "readyForStart";
    this.stopped = new Set();
    this.onMaxBet?.();
    this.render();
  }

  start() {
    if (!this.canStart()) return;
    this.state = "spinning";
    this.stopped = new Set();
    this.onStart?.();
    this.render();
  }

  stop(reelId) {
    if (!this.canStop(reelId)) return;
    this.stopped.add(reelId);
    this.onStop?.(reelId, {
      stopped: [...this.stopped],
      remaining: REEL_ORDER.filter(key => !this.stopped.has(key))
    });
    if (this.stopped.size === REEL_ORDER.length) {
      this.state = "complete";
      this.onComplete?.();
    }
    this.render();
  }

  canMaxBet() {
    return !this.disabled && this.state === "readyForBet";
  }

  canStart() {
    return !this.disabled && this.state === "readyForStart";
  }

  canStop(reelId) {
    return !this.disabled && this.state === "spinning" && REEL_ORDER.includes(reelId) && !this.stopped.has(reelId);
  }

  render() {
    this.updateButton(this.maxBetButton, {
      enabled: this.canMaxBet(),
      active: this.canMaxBet(),
      pressed: this.state !== "readyForBet"
    });
    this.updateButton(this.startButton, {
      enabled: this.canStart(),
      active: this.canStart(),
      pressed: this.state === "spinning"
    });
    for (const reelId of REEL_ORDER) {
      this.updateButton(this.stopButtons[reelId], {
        enabled: this.canStop(reelId),
        active: this.canStop(reelId),
        pressed: this.stopped.has(reelId)
      });
    }
  }

  updateButton(button, { enabled, active, pressed }) {
    if (!button) return;
    button.disabled = !enabled;
    button.classList.toggle("is-enabled", enabled);
    button.classList.toggle("is-active", active);
    button.classList.toggle("is-pressed", pressed);
    button.setAttribute("aria-pressed", String(Boolean(pressed)));
  }
}
