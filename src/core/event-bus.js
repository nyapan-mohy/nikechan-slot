export class EventBus {
  constructor({ keepHistory = true } = {}) {
    this.listeners = new Map();
    this.keepHistory = keepHistory;
    this.history = [];
  }

  on(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
    return () => this.off(type, listener);
  }

  off(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type, payload = {}) {
    const event = {
      type,
      timestamp: new Date().toISOString(),
      ...payload
    };
    if (this.keepHistory) this.history.push(event);
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    for (const listener of this.listeners.get("*") ?? []) listener(event);
    return event;
  }

  clearHistory() {
    this.history.length = 0;
  }
}

export function createEventBus(options) {
  return new EventBus(options);
}
