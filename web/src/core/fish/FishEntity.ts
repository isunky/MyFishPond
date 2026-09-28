import type { AnimatedSprite, Container, Mesh, Renderer, Texture } from 'pixi.js';
import type { FishDefinition } from './FishPattern';
import { FishVisual } from './FishVisual';

export type FishSpecies = 'koi' | 'goldfish';
export type FishBehavior = 'wander' | 'cruise' | 'school';

export class FishEntity {
  readonly sprite: Container;
  readonly animation: AnimatedSprite;
  readonly shadow: Mesh;
  private readonly visual: FishVisual;
  private readonly baseDepth: number;
  depth = 0.4;
  readonly species: FishSpecies;
  readonly definition: FishDefinition;
  readonly baseSpeed: number;
  readonly turnRate: number;
  readonly schoolAffinity: number;
  x = 0;
  y = 0;
  heading = 0;
  desiredHeading = 0;
  preferredHeading = 0;
  currentSpeed = 0;
  behavior: FishBehavior = 'wander';
  private nextWanderAt = 0;
  private stateUntil = 0;
  private swimClock = 0;
  private swimPhase: number;
  private swimRate: number;
  private readonly baseAnimationSpeed: number;
  private turnResponsiveness: number;
  private speedIntent = 1;
  private speedClock = 0;
  private speedPhase: number;
  private speedCycleRate: number;
  private speedCycleAmplitude: number;
  private nextBurstAt = 0;
  private burstStartAt = -1;
  private burstDuration = 1;
  private burstStrength = 0;
  private angularVelocity = 0;

  constructor(definition: FishDefinition, textures: Texture[], random: () => number, scale: number, renderer: Renderer) {
    this.definition = definition;
    this.species = definition.species;
    this.baseSpeed = 22 + random() * 24;
    this.currentSpeed = this.baseSpeed;
    this.turnRate = 0.75 + random() * 0.45;
    this.turnResponsiveness = 1.8 + random() * 0.6;
    this.schoolAffinity = 0.35 + random() * 0.55;
    this.speedIntent = 0.88 + random() * 0.18;
    this.speedPhase = random() * Math.PI * 2;
    this.speedCycleRate = 0.35 + random() * 0.25;
    this.speedCycleAmplitude = 0.08 + random() * 0.08;
    this.nextBurstAt = 2 + random() * 4;
    this.heading = random() * Math.PI * 2;
    this.desiredHeading = this.heading;
    this.preferredHeading = this.heading;
    this.baseAnimationSpeed = 0.12 + random() * 0.02;
    const fishLength = (this.species === 'koi' ? 72 : 60) * 0.88 * scale * (0.9 + random() * 0.2);
    this.visual = new FishVisual(renderer, definition, textures, fishLength, this.baseAnimationSpeed, Math.floor(random() * textures.length));
    this.sprite = this.visual.root;
    this.animation = this.visual.animation;
    this.shadow = this.visual.shadow;
    this.swimRate = (Math.PI * 2 * 60 * this.baseAnimationSpeed) / textures.length;
    this.swimPhase = random() * Math.PI * 2;
    this.baseDepth = 0.18 + random() * 0.58;
    this.depth = this.baseDepth;
  }

  beginDecision(now: number, random: () => number, heading: number, school: boolean) {
    if (now >= this.nextWanderAt && this.behavior !== 'school') {
      this.preferredHeading = this.heading + (random() - 0.5) * 1.1;
      this.nextWanderAt = now + 1.2 + random() * 2.6;
      this.behavior = random() > 0.65 ? 'cruise' : 'wander';
      this.speedIntent = this.behavior === 'cruise'
        ? 1.02 + random() * 0.14
        : 0.75 + random() * 0.38;
      this.stateUntil = now + 1.5 + random() * 3;
    }
    if (school && this.schoolAffinity > 0.65) {
      if (this.behavior !== 'school') this.speedIntent = 0.84 + random() * 0.16;
      this.preferredHeading = blendAngle(this.preferredHeading, heading, 0.12);
      this.behavior = 'school';
      this.stateUntil = now + 1.1;
    } else if (now > this.stateUntil && this.behavior === 'school') {
      this.behavior = 'wander';
      this.speedIntent = 0.77 + random() * 0.29;
      this.nextWanderAt = now + 0.6 + random() * 1.2;
    }

    if (now >= this.nextBurstAt) {
      const burstChance = this.behavior === 'school' ? 0.16 : 0.28;
      if (random() < burstChance) {
        this.burstStartAt = this.speedClock;
        this.burstDuration = 0.45 + random() * 0.65;
        this.burstStrength = 0.18 + random() * 0.28;
      }
      this.nextBurstAt = now + 2.8 + random() * 5.2;
    }
  }

  applySteering(angle: number, responsiveness: number, deltaSeconds: number) {
    const blend = 1 - Math.exp(-responsiveness * deltaSeconds);
    this.desiredHeading = blendAngle(this.desiredHeading, angle, blend);
  }

  update(deltaSeconds: number, bounds: { width: number; height: number }, speedScale: number) {
    this.speedClock += deltaSeconds;
    const previousSpeedRatio = this.currentSpeed / this.baseSpeed;
    const tailRate = Math.max(0.72, Math.min(1.5, 0.68 + previousSpeedRatio * 0.42));
    this.swimClock += deltaSeconds * this.swimRate * tailRate;
    const difference = shortestAngle(this.heading, this.desiredHeading);
    const wantedTurnRate = Math.max(-this.turnRate, Math.min(this.turnRate, difference * 2.1));
    const turnBlend = 1 - Math.exp(-this.turnResponsiveness * deltaSeconds);
    this.angularVelocity += (wantedTurnRate - this.angularVelocity) * turnBlend;
    const movementHeading = this.heading + this.angularVelocity * deltaSeconds * 0.5;
    this.heading += this.angularVelocity * deltaSeconds;

    // Fish alternate between a gentle cruise and brief tail-powered surges.
    const cruiseVariation = 1
      + Math.sin(this.speedClock * this.speedCycleRate + this.speedPhase) * this.speedCycleAmplitude
      + Math.sin(this.speedClock * this.speedCycleRate * 0.47 + this.speedPhase * 1.7)
        * this.speedCycleAmplitude * 0.32;
    const strokePower = 1 + Math.sin(this.swimClock + this.swimPhase) * 0.055;
    const turnLoad = Math.min(
      1,
      Math.abs(difference) / 1.7 + (Math.abs(this.angularVelocity) / this.turnRate) * 0.18,
    );
    const turnFactor = 1 - turnLoad * 0.2;
    const burstProgress = (this.speedClock - this.burstStartAt) / this.burstDuration;
    const burstEnvelope = burstProgress >= 0 && burstProgress <= 1
      ? Math.sin(Math.PI * burstProgress) ** 2
      : 0;
    const burstFactor = 1 + burstEnvelope * this.burstStrength;
    const speedFactor = this.speedIntent * cruiseVariation * strokePower * turnFactor * burstFactor;
    const targetSpeed = this.baseSpeed * Math.max(0.55, Math.min(1.65, speedFactor));
    const acceleration = targetSpeed > this.currentSpeed ? 2.1 : 3;
    this.currentSpeed += (targetSpeed - this.currentSpeed)
      * (1 - Math.exp(-acceleration * deltaSeconds));
    this.x += Math.cos(movementHeading) * this.currentSpeed * speedScale * deltaSeconds;
    this.y += Math.sin(movementHeading) * this.currentSpeed * speedScale * deltaSeconds;
    this.x = Math.min(bounds.width + 48, Math.max(-48, this.x));
    this.y = Math.min(bounds.height + 48, Math.max(-48, this.y));
    this.sprite.position.set(this.x, this.y);
    const speedRatio = this.currentSpeed / this.baseSpeed;
    const animationRate = Math.max(0.72, Math.min(1.5, 0.68 + speedRatio * 0.42));
    this.animation.animationSpeed = this.baseAnimationSpeed * animationRate;
    this.visual.advance(deltaSeconds);
    this.depth = this.baseDepth + Math.sin(this.speedClock * 0.23 + this.speedPhase) * 0.09;
    this.visual.update(this.swimClock + this.swimPhase, this.angularVelocity, speedRatio, this.depth);
    this.sprite.zIndex = -this.depth;
    const shadowOffset = 17 - this.depth * 11;
    this.shadow.position.set(this.x + shadowOffset * 0.6, this.y + shadowOffset);
    this.shadow.rotation = this.heading;
    // A slight lag through a turn hints at body flex without bending the whole fish visibly.
    this.sprite.rotation = this.heading + this.angularVelocity * 0.025;
  }

  destroy() {
    this.visual.destroy();
  }
}

export function shortestAngle(from: number, to: number) {
  let difference = (to - from) % (Math.PI * 2);
  if (difference > Math.PI) difference -= Math.PI * 2;
  if (difference < -Math.PI) difference += Math.PI * 2;
  return difference;
}

function blendAngle(from: number, to: number, amount: number) {
  return from + shortestAngle(from, to) * amount;
}
