import type { QualityProfile } from '../../config/defaults';
import type { Ticker } from 'pixi.js';
import { SpatialGrid } from '../boids/SpatialGrid';
import { FishEntity } from './FishEntity';

interface SimulationSettings {
  fishSpeed: number;
  schooling: number;
}

export class FishSimulation {
  private readonly grid = new SpatialGrid(110);
  private boidsAccumulator = 0;
  private decisionAccumulator = 0;
  private simulationTime = 0;

  constructor(
    private readonly fish: FishEntity[],
    private readonly getBounds: () => { width: number; height: number },
    private readonly profile: () => QualityProfile,
    private readonly settings: () => SimulationSettings,
    private readonly random: () => number,
  ) {}

  update(deltaMs: number, ticker: Ticker) {
    const deltaSeconds = Math.min(0.05, Math.max(0, deltaMs / 1_000));
    this.simulationTime += deltaSeconds;
    this.boidsAccumulator += deltaSeconds;
    this.decisionAccumulator += deltaSeconds;

    const profile = this.profile();
    const boidsInterval = 1 / profile.boidsHz;
    const decisionInterval = 1 / profile.behaviorHz;

    if (this.boidsAccumulator >= boidsInterval) {
      const elapsedSeconds = this.boidsAccumulator;
      this.boidsAccumulator %= boidsInterval;
      this.updateBoids(elapsedSeconds);
    }
    if (this.decisionAccumulator >= decisionInterval) {
      this.decisionAccumulator %= decisionInterval;
      this.updateBehaviorDecisions();
    }

    for (const fish of this.fish) {
      fish.update(deltaSeconds, this.getBounds(), this.settings().fishSpeed, ticker);
    }
  }

  resize(width: number, height: number) {
    const bounds = this.getBounds();
    for (const fish of this.fish) {
      fish.x = Math.min(width, (fish.x / Math.max(1, bounds.width)) * width);
      fish.y = Math.min(height, (fish.y / Math.max(1, bounds.height)) * height);
    }
  }

  private updateBoids(elapsedSeconds: number) {
    this.grid.rebuild(this.fish);
    const { width, height } = this.getBounds();
    const margin = Math.min(130, Math.min(width, height) * 0.18);

    for (const fish of this.fish) {
      let separationX = 0;
      let separationY = 0;
      let alignmentX = 0;
      let alignmentY = 0;
      let cohesionX = 0;
      let cohesionY = 0;
      let neighborCount = 0;
      let separationCount = 0;

      for (const other of this.grid.query(fish.x, fish.y)) {
        if (other === fish) continue;
        const dx = other.x - fish.x;
        const dy = other.y - fish.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > 110 * 110) continue;
        neighborCount += 1;
        alignmentX += Math.cos(other.heading);
        alignmentY += Math.sin(other.heading);
        cohesionX += other.x;
        cohesionY += other.y;
        if (distanceSquared < 44 * 44) {
          const distance = Math.max(1, Math.sqrt(distanceSquared));
          separationX -= dx / distance;
          separationY -= dy / distance;
          separationCount += 1;
        }
      }

      let steerX = Math.cos(fish.desiredHeading) * 0.35;
      let steerY = Math.sin(fish.desiredHeading) * 0.35;
      if (neighborCount > 0) {
        steerX += (alignmentX / neighborCount) * 0.25;
        steerY += (alignmentY / neighborCount) * 0.25;
        steerX += ((cohesionX / neighborCount - fish.x) / 110) * profileSchooling(this.settings().schooling) * 0.16;
        steerY += ((cohesionY / neighborCount - fish.y) / 110) * profileSchooling(this.settings().schooling) * 0.16;
      }
      if (separationCount > 0) {
        steerX += (separationX / separationCount) * 0.9;
        steerY += (separationY / separationCount) * 0.9;
      }

      const edgeForce = (distance: number, positive: boolean) => {
        if (distance >= margin) return 0;
        const force = (1 - Math.max(0, distance) / Math.max(1, margin)) ** 2;
        return positive ? force : -force;
      };
      steerX += edgeForce(fish.x, true) + edgeForce(width - fish.x, false);
      steerY += edgeForce(fish.y, true) + edgeForce(height - fish.y, false);
      fish.applySteering(
        Math.atan2(steerY, steerX),
        separationCount > 0 ? 3.2 : 2.2,
        elapsedSeconds,
      );
    }
  }

  private updateBehaviorDecisions() {
    for (const fish of this.fish) {
      const nearby = this.grid.query(fish.x, fish.y).filter((other) => {
        if (other === fish) return false;
        const dx = other.x - fish.x;
        const dy = other.y - fish.y;
        return dx * dx + dy * dy < 90 * 90;
      });
      const schoolHeading = nearby.length
        ? Math.atan2(
            nearby.reduce((sum, other) => sum + Math.sin(other.heading), 0),
            nearby.reduce((sum, other) => sum + Math.cos(other.heading), 0),
          )
        : fish.heading;
      fish.beginDecision(this.simulationTime, this.random, schoolHeading, nearby.length >= 2);
    }
  }
}

function profileSchooling(value: number) {
  return Math.max(0, Math.min(1, value));
}
