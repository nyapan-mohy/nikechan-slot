import { getReelKeys, getReels } from "../core/line-evaluator.js";

const REEL_KEYS = ["left", "center", "right"];
const REEL_LENGTH = 21;
const TAU = Math.PI * 2;
const STEP = TAU / REEL_LENGTH;
const SPIN_SPEED = TAU;
const SYMBOL_ASSET_ALIASES = {
  RED7: "AI_NIKECHAN",
  BAR: "LOGO_BAR",
  SUIKA: "WATERMELON"
};

let threeModulePromise = null;

export class ReelWindow {
  constructor(options = {}) {
    this.root = options.root ?? null;
    this.assetMap = normalizeAssetMap(options.assetMap);
    this.dataBundle = null;
    this.reels = null;
    this.reelKeys = REEL_KEYS;
    this.positions = Object.fromEntries(this.reelKeys.map(key => [key, 0]));
    this.reelState = Object.fromEntries(this.reelKeys.map(key => [key, createReelState()]));
    this.lastWinLineId = null;
    this.ready = false;
    this.loading = false;
    this.needsBuild = false;
    this.frame = null;
    this.canvas = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.THREE = null;
    this.textureCache = new Map();
    this.resizeObserver = null;
    this.lastFrameAt = performance.now();
    this.animationFrame = null;

    this.renderShell();
    this.initThree();
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
    this.textureCache.clear();
    this.rebuildWhenReady();
  }

  setDataBundle(dataBundle) {
    this.dataBundle = dataBundle ?? null;
    this.reels = this.dataBundle ? getReels(this.dataBundle) : null;
    this.reelKeys = this.dataBundle ? getReelKeys(this.dataBundle) : this.reelKeys;
    this.positions = {
      ...Object.fromEntries(this.reelKeys.map(key => [key, 0])),
      ...this.positions
    };
    this.reelState = {
      ...Object.fromEntries(this.reelKeys.map(key => [key, createReelState()])),
      ...this.reelState
    };
    this.rebuildWhenReady();
  }

  applySnapshot(snapshot) {
    if (!snapshot) return;
    const incomingPositions = snapshot.reelPositions ?? {};
    for (const key of this.reelKeys) {
      const state = this.reelState[key];
      if (!state?.spinning && !state?.stopping && Number.isFinite(Number(incomingPositions[key]))) {
        this.setReelRotation(key, Number(incomingPositions[key]), false);
      }
    }
    this.lastWinLineId = snapshot.lastWin?.lineId ?? null;
  }

  startSpin(reelIds = this.reelKeys) {
    for (const reelId of reelIds) {
      const state = this.reelState[reelId];
      if (!state) continue;
      state.spinning = true;
      state.stopping = null;
    }
    this.lastFrameAt = performance.now();
  }

  stopReel(reelId, index) {
    const state = this.reelState[reelId];
    if (!state || !Number.isFinite(Number(index))) return;
    const stopIndex = Number(index);
    const targetRotation = targetRotationFor(state.rotation, stopIndex);
    state.spinning = false;
    state.stopping = {
      from: state.rotation,
      to: targetRotation,
      startedAt: performance.now(),
      duration: 180
    };
    state.stopIndex = stopIndex;
    this.positions[reelId] = stopIndex;
  }

  stopAll(finalPositions = {}) {
    for (const reelId of this.reelKeys) {
      this.stopReel(reelId, finalPositions[reelId]);
    }
  }

  renderShell() {
    if (!this.root) return;
    this.root.innerHTML = `
      <div class="reel-window__frame" role="group" aria-label="リール窓">
        <canvas class="reel-window__canvas" aria-label="3Dリール"></canvas>
        <div class="reel-window__payline" aria-hidden="true"></div>
        <div class="reel-window__shade reel-window__shade--top" aria-hidden="true"></div>
        <div class="reel-window__shade reel-window__shade--bottom" aria-hidden="true"></div>
      </div>
    `;
    this.frame = this.root.querySelector(".reel-window__frame");
    this.canvas = this.root.querySelector(".reel-window__canvas");
  }

  async initThree() {
    if (!this.canvas || this.loading || this.ready) return;
    this.loading = true;
    try {
      this.THREE = await loadThree();
      this.createScene();
      this.ready = true;
      await this.rebuildWhenReady();
      this.observeResize();
      this.resize();
      this.animate(performance.now());
    } catch (error) {
      this.renderFallback(error);
    } finally {
      this.loading = false;
    }
  }

  createScene() {
    const { THREE } = this;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setClearColor(0x050607, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-2.75, 2.75, 0.82, -0.82, 0.1, 100);
    this.camera.position.set(0, 0, 8);
    this.camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 1.9);
    this.scene.add(ambient);
    const light = new THREE.DirectionalLight(0xffffff, 1.15);
    light.position.set(0, 2, 5);
    this.scene.add(light);
  }

  async rebuildWhenReady() {
    if (!this.ready || !this.scene || !this.reels) {
      this.needsBuild = true;
      return;
    }
    this.needsBuild = false;
    await this.buildReels();
    this.resize();
  }

  async buildReels() {
    const { THREE } = this;
    for (const key of Object.keys(this.reelState)) {
      const group = this.reelState[key]?.group;
      if (group) this.scene.remove(group);
    }

    const panelGeometry = new THREE.PlaneGeometry(0.92, 0.66);
    const backingMaterial = new THREE.MeshBasicMaterial({ color: 0xf4f1e8, side: THREE.DoubleSide });
    const radius = 1.92;
    const xPositions = [-1.02, 0, 1.02];
    const loader = new THREE.TextureLoader();

    for (const [reelIndex, key] of this.reelKeys.entries()) {
      const group = new THREE.Group();
      group.position.x = xPositions[reelIndex] ?? 0;
      this.scene.add(group);

      const state = this.reelState[key] ?? createReelState();
      state.group = group;
      state.panels = [];
      this.reelState[key] = state;

      const symbols = this.reels[key] ?? [];
      for (let index = 0; index < symbols.length; index += 1) {
        const angle = -index * STEP;
        const holder = new THREE.Group();
        holder.userData.symbolIndex = index;
        holder.userData.angle = angle;
        holder.position.set(0, -Math.sin(angle) * radius, Math.cos(angle) * radius);
        holder.rotation.x = angle;

        const backing = new THREE.Mesh(panelGeometry, backingMaterial.clone());
        backing.position.z = -0.03;
        backing.renderOrder = 1;
        holder.add(backing);

        const texture = await this.textureForSymbol(loader, symbols[index]);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false
        });
        const symbolPlane = new THREE.Mesh(panelGeometry, material);
        const symbolScale = symbolScaleFor(symbols[index]);
        symbolPlane.scale.set(symbolScale, symbolScale, 1);
        symbolPlane.position.z = 0.03;
        symbolPlane.renderOrder = 10;
        holder.add(symbolPlane);

        group.add(holder);
        state.panels.push(holder);
      }
      this.setReelRotation(key, this.positions[key] ?? 0, false);
    }
  }

  async textureForSymbol(loader, symbolId) {
    const assetKey = SYMBOL_ASSET_ALIASES[symbolId] ?? symbolId;
    const asset = this.assetMap[assetKey] ?? this.assetMap[symbolId];
    const src = asset?.src || "./assets/images/symbols/symbol-blank.png";
    if (!this.textureCache.has(src)) {
      this.textureCache.set(src, new Promise((resolve, reject) => {
        loader.load(src, texture => {
          texture.colorSpace = this.THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
          resolve(texture);
        }, undefined, reject);
      }));
    }
    return this.textureCache.get(src);
  }

  setReelRotation(reelId, stopIndex, animate = false) {
    const state = this.reelState[reelId];
    if (!state) return;
    const rotation = stopIndex * STEP;
    if (animate) {
      this.stopReel(reelId, stopIndex);
      return;
    }
    state.rotation = rotation;
    state.stopIndex = stopIndex;
    state.spinning = false;
    state.stopping = null;
    if (state.group) state.group.rotation.x = state.rotation;
    this.positions[reelId] = stopIndex;
    this.updatePanelVisibility(state);
  }

  animate(now) {
    const delta = Math.min(0.05, (now - this.lastFrameAt) / 1000);
    this.lastFrameAt = now;

    for (const key of this.reelKeys) {
      const state = this.reelState[key];
      if (!state?.group) continue;
      if (state.spinning) {
        state.rotation += SPIN_SPEED * delta;
      } else if (state.stopping) {
        const t = Math.min(1, (now - state.stopping.startedAt) / state.stopping.duration);
        state.rotation = lerp(state.stopping.from, state.stopping.to, easeOutCubic(t));
        if (t >= 1) {
          state.rotation = state.stopping.to;
          state.stopping = null;
        }
      }
      state.group.rotation.x = state.rotation;
      this.updatePanelVisibility(state);
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
    this.animationFrame = requestAnimationFrame(nowValue => this.animate(nowValue));
  }

  updatePanelVisibility(state) {
    for (const panel of state.panels ?? []) {
      const angle = normalizeAngle(panel.userData.angle + state.rotation);
      panel.visible = Math.abs(angle) <= STEP * 2.2;
    }
  }

  observeResize() {
    if (!this.frame || this.resizeObserver) return;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.frame);
  }

  resize() {
    if (!this.renderer || !this.canvas || !this.camera) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.left = -0.72 * aspect;
    this.camera.right = 0.72 * aspect;
    this.camera.top = 1.02;
    this.camera.bottom = -1.02;
    this.camera.updateProjectionMatrix();
  }

  renderFallback(error) {
    if (!this.root) return;
    this.root.innerHTML = `
      <div class="reel-window__frame reel-window__frame--error">
        <div class="reel-window__error">REEL LOAD ERROR</div>
      </div>
    `;
    console.error(error);
  }
}

function createReelState() {
  return {
    group: null,
    panels: [],
    rotation: 0,
    spinning: false,
    stopping: null,
    stopIndex: 0
  };
}

function loadThree() {
  if (!threeModulePromise) {
    threeModulePromise = import("https://unpkg.com/three@0.164.1/build/three.module.js");
  }
  return threeModulePromise;
}

function targetRotationFor(currentRotation, stopIndex) {
  let target = stopIndex * STEP;
  while (target < currentRotation) target += TAU;
  return target;
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

function symbolScaleFor(symbolId) {
  return isBonusSymbol(symbolId) ? 0.78 : 0.66;
}

function isBonusSymbol(symbolId) {
  return symbolId === "RED7" || symbolId === "BAR" || symbolId === "AI_NIKECHAN" || symbolId === "MASTER_NIKECHAN" || symbolId === "LOGO_BAR";
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function lerp(a, b, t) {
  return a + ((b - a) * t);
}

function normalizeAngle(angle) {
  return ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
}
