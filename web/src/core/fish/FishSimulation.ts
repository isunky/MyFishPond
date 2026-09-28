import type { QualityProfile } from '../../config/defaults';
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

  update(deltaMs: number) {
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

    const bounds = this.getBounds();
    const speed = this.settings().fishSpeed;
    for (const fish of this.fish) {
      fish.update(deltaSeconds, bounds, speed);
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
    const schooling = profileSchooling(this.settings().schooling);

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
        const distance = Math.max(1, Math.sqrt(distanceSquared));
        const ahead = (dx * Math.cos(fish.heading) + dy * Math.sin(fish.heading)) / distance;
        const weight = (1 - distance / 110) * (ahead > -0.3 ? 1 : 0.25);
        neighborCount += weight;
        alignmentX += Math.cos(other.heading) * weight;
        alignmentY += Math.sin(other.heading) * weight;
        cohesionX += other.x * weight;
        cohesionY += other.y * weight;
        if (distanceSquared < 50 * 50 && Math.abs(other.depth - fish.depth) < 0.3) {
          const pressure = (1 - distance / 50) ** 2;
          separationX -= dx / distance * pressure;
          separationY -= dy / distance * pressure;
          separationCount += 1;
        }
      }

      let steerX = Math.cos(fish.preferredHeading) * 0.48;
      let steerY = Math.sin(fish.preferredHeading) * 0.48;
      if (neighborCount > 0) {
        steerX += (alignmentX / neighborCount) * schooling * 0.27;
        steerY += (alignmentY / neighborCount) * schooling * 0.27;
        steerX += ((cohesionX / neighborCount - fish.x) / 110) * schooling * 0.12;
        steerY += ((cohesionY / neighborCount - fish.y) / 110) * schooling * 0.12;
      }
      if (separationCount > 0) {
        steerX += separationX * 1.4;
        steerY += separationY * 1.4;
      }

      const edgeForce = (distance: number, positive: boolean) => {
        if (distance >= margin) return 0;
        const force = (1 - Math.max(0, distance) / Math.max(1, margin)) ** 2;
        return positive ? force : -force;
      };
      const lookAhead = fish.currentSpeed * this.settings().fishSpeed * 1.2;
      const nextX = fish.x + Math.cos(fish.heading) * lookAhead;
      const nextY = fish.y + Math.sin(fish.heading) * lookAhead;
      steerX += edgeForce(nextX, true) + edgeForce(width - nextX, false);
      steerY += edgeForce(nextY, true) + edgeForce(height - nextY, false);
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
      fish.beginDecision(this.simulationTime, this.random, schoolHeading,
        nearby.length >= 2 && this.settings().schooling > 0.2);
    }
  }
}

function profileSchooling(value: number) {
  return Math.max(0, Math.min(1, value));
}
