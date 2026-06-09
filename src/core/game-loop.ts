import { useGameStore } from "./store";

export class GameClock {
  private lastTime: number = 0;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;

  constructor() {}

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private loop = (now: number): void => {
    if (!this.isRunning) return;

    // deltaTime in seconds
    const deltaTime = Math.min(0.1, (now - this.lastTime) / 1000); 
    this.lastTime = now;

    // Tick the game store
    useGameStore.getState().tick(deltaTime);

    this.animationFrameId = requestAnimationFrame(this.loop);
  };
}
