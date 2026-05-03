const DEFAULT_OPTIONS = {
  lineColor: "#37d67a",
  axisColor: "#303741",
  gridColor: "rgba(154, 163, 175, 0.18)",
  fillColor: "rgba(55, 214, 122, 0.12)",
  textColor: "#9aa3af",
  bigColor: "#f4c542",
  regColor: "#5eb1ff"
};

export function drawSlumpGraph(canvas, history = [], options = {}) {
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const palette = { ...DEFAULT_OPTIONS, ...options };
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width || canvas.width || 320));
  const height = Math.max(1, Math.floor(rect.height || canvas.height || 160));

  if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
  }

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0d0f11";
  ctx.fillRect(0, 0, width, height);

  const pad = { top: 16, right: 12, bottom: 24, left: 42 };
  const graphWidth = Math.max(1, width - pad.left - pad.right);
  const graphHeight = Math.max(1, height - pad.top - pad.bottom);
  const values = normalizeHistory(history);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue === minValue ? 1 : maxValue - minValue;

  const xFor = index => pad.left + (values.length <= 1 ? 0 : (index / (values.length - 1)) * graphWidth);
  const yFor = value => pad.top + ((maxValue - value) / range) * graphHeight;
  const zeroY = yFor(0);

  drawGrid(ctx, pad, graphWidth, graphHeight, zeroY, palette);
  drawMarkers(ctx, normalizeMarkers(options.markers, values.length), xFor, pad, graphWidth, graphHeight, palette);

  ctx.beginPath();
  values.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(pad.left + graphWidth, zeroY);
  ctx.lineTo(pad.left, zeroY);
  ctx.closePath();
  ctx.fillStyle = palette.fillColor;
  ctx.fill();

  ctx.beginPath();
  values.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineWidth = 2;
  ctx.strokeStyle = palette.lineColor;
  ctx.stroke();

  ctx.fillStyle = palette.textColor;
  ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  ctx.textBaseline = "middle";
  ctx.fillText(formatSigned(maxValue), 6, pad.top);
  ctx.fillText("0", 6, zeroY);
  ctx.fillText(formatSigned(minValue), 6, pad.top + graphHeight);

  const latest = values[values.length - 1] ?? 0;
  ctx.textAlign = "right";
  ctx.fillText(`差枚 ${formatSigned(latest)}`, width - 10, height - 11);
  ctx.textAlign = "left";
}

function normalizeHistory(history) {
  const values = Array.isArray(history) ? history : [];
  const numeric = values
    .map(value => Number(value))
    .filter(value => Number.isFinite(value));
  return numeric.length > 0 ? numeric : [0];
}

function drawGrid(ctx, pad, graphWidth, graphHeight, zeroY, palette) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = palette.gridColor;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (graphHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + graphWidth, y);
    ctx.stroke();
  }

  ctx.strokeStyle = palette.axisColor;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + graphHeight);
  ctx.lineTo(pad.left + graphWidth, pad.top + graphHeight);
  ctx.stroke();

  ctx.strokeStyle = palette.lineColor;
  ctx.beginPath();
  ctx.moveTo(pad.left, zeroY);
  ctx.lineTo(pad.left + graphWidth, zeroY);
  ctx.stroke();
}

function drawMarkers(ctx, markers, xFor, pad, graphWidth, graphHeight, palette) {
  if (!markers.length) return;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  ctx.textBaseline = "top";

  for (const marker of markers) {
    const x = xFor(marker.index);
    const color = marker.type === "REG" ? palette.regColor : palette.bigColor;

    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + graphHeight);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, pad.top + 7, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(marker.type, Math.min(x + 5, pad.left + graphWidth - 22), pad.top + 2);
  }

  ctx.restore();
}

function normalizeMarkers(markers, pointCount) {
  if (!Array.isArray(markers) || pointCount <= 0) return [];
  return markers
    .map(marker => ({
      index: Number.parseInt(marker?.index, 10),
      type: marker?.type === "REG" ? "REG" : "BIG"
    }))
    .filter(marker => Number.isFinite(marker.index) && marker.index >= 0 && marker.index < pointCount);
}

function formatSigned(value) {
  const rounded = Math.round(Number(value) || 0);
  return `${rounded >= 0 ? "+" : ""}${rounded}`;
}
