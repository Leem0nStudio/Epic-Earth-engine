export class GameWorld {
  private tickRate: number = 20;
  private interval: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.interval = setInterval(() => this.tick(), 1000 / this.tickRate);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private tick(): void {
    // TODO: Sprint 2 — entity updates, AI, spawns, physics
  }
}
