export class TerminalLog {
  constructor(element, options = {}) {
    this.element = element;
    this.maxLines = options.maxLines ?? 3000;
    this.lines = [];
  }

  attach(bus) {
    if (!bus || typeof bus.addEventListener !== "function") return;
    bus.addEventListener("log:append", event => {
      this.append(event.detail?.line ?? "");
    });
    bus.addEventListener("log:clear", () => {
      this.clear();
    });
  }

  append(line) {
    this.lines.push(String(line));
    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(-this.maxLines);
    }
    this.render();
  }

  clear() {
    this.lines = [];
    this.render();
  }

  render() {
    if (!this.element) return;
    this.element.textContent = this.lines.join("\n");
    this.element.scrollTop = this.element.scrollHeight;
  }
}
