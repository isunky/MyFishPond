import { AnimatedSprite, Container, Graphics, type Texture, type Ticker } from 'pixi.js';
import { drawFishMarkings, type FishDefinition } from './FishPattern';

export type FishSpecies = 'koi' | 'goldfish';
export type FishBehavior = 'wander' | 'cruise' | 'school';

export class FishEntity {
  readonly sprite: Container;
  readonly animation: AnimatedSprite;
  readonly species: FishSpecies;
  readonly definition: FishDefinition;
  readonly baseSpeed: number;
  readonly turnRate: number;
  readonly schoolAffinity: number;
  x = 0;
  y = 0;
  heading = 0;
  desiredHeading = 0;
  currentSpeed = 0;
  behavior: FishBehavior = 'wander';
  private nextWanderAt = 0;
  private stateUntil = 0;
  private swimClock = 0;
  private swimPhase: number;
  private swimRate: number;
  private turnResponsiveness: number;
  private speedIntent = 1;
  private angularVelocity = 0;

  constructor(definition: FishDefinition, textures: Texture[], random: () => number, scale: number) {
    this.definition = definition;
    this.species = definition.species;
    this.baseSpeed = 22 + random() * 24;
    this.currentSpeed = this.baseSpeed;
    this.turnRate = 0.75 + random() * 0.45;
    this.turnResponsiveness = 1.8 + random() * 0.6;
    this.schoolAffinity = 0.35 + random() * 0.55;
    this.speedIntent = 0.88 + random() * 0.18;
    this.heading = random() * Math.PI * 2;
    this.desiredHeading = this.heading;
    this.sprite = new Container();
    this.animation = new AnimatedSprite({
      textures,
      // 7.2–8.4 frames/s gives the 8-frame tail cycle a relaxed ~1 Hz beat.
      animationSpeed: 0.12 + random() * 0.02,
      autoUpdate: false,
      anchor: 0.5,
    });
    this.swimRate = (Math.PI * 2 * 60 * this.animation.animationSpeed) / textures.length;
    const fishLength = (this.species === 'koi' ? 72 : 60) * 0.88 * scale * (0.9 + random() * 0.2);
    this.animation.width = fishLength;
    this.animation.height = fishLength * (textures[0]!.height / textures[0]!.width);
    this.animation.tint = definition.appearance.tint;
    this.animation.gotoAndPlay(Math.floor(random() * textures.length));
    this.sprite.addChild(this.animation);
    const markings = new Graphics();
    drawFishMarkings(markings, definition.appearance, this.animation.width, this.animation.height);
    this.sprite.addChild(markings);
    this.swimPhase = random() * Math.PI * 2;
  }

  beginDecision(now: number, random: () => number, heading: number, school: boolean) {
    if (now >= this.nextWanderAt && this.behavior !== 'school') {
      this.desiredHeading += (random() - 0.5) * 1.1;
      this.nextWanderAt = now + 1.2 + random() * 2.6;
      this.behavior = random() > 0.65 ? 'cruise' : 'wander';
      this.speedIntent = this.behavior === 'cruise'
        ? 1.02 + random() * 0.08
        : 0.86 + random() * 0.12;
      this.stateUntil = now + 1.5 + random() * 3;
    }
    if (school && this.schoolAffinity > 0.65) {
      if (this.behavior !== 'school') this.speedIntent = 0.9 + random() * 0.08;
      this.desiredHeading = blendAngle(this.desiredHeading, heading, 0.18);
      this.behavior = 'school';
      this.stateUntil = now + 1.1;
    } else if (now > this.stateUntil && this.behavior === 'school') {
      this.behavior = 'wander';
      this.speedIntent = 0.88 + random() * 0.16;
      this.nextWanderAt = now + 0.6 + random() * 1.2;
    }
  }

  applySteering(angle: number, responsiveness: number, deltaSeconds: number) {
    const blend = 1 - Math.exp(-responsiveness * deltaSeconds);
    this.desiredHeading = blendAngle(this.desiredHeading, angle, blend);
  }

  update(deltaSeconds: number, bounds: { width: number; height: number }, speedScale: number, ticker: Ticker) {
    this.animation.update(ticker);
    this.swimClock += deltaSeconds * this.swimRate;
    const swim = Math.sin(this.swimClock + this.swimPhase);
    const difference = shortestAngle(this.heading, this.desiredHeading);
    const wantedTurnRate = Math.max(-this.turnRate, Math.min(this.turnRate, difference * 2.1));
    const turnBlend = 1 - Math.exp(-this.turnResponsiveness * deltaSeconds);
    this.angularVelocity += (wantedTurnRate - this.angularVelocity) * turnBlend;
    const movementHeading = this.heading + this.angularVelocity * deltaSeconds * 0.5;
    this.heading += this.angularVelocity * deltaSeconds;

    // Tail strokes add a small forward pulse, followed by a smooth glide.
    const strokePower = 1 + Math.max(0, swim) * 0.08;
    const targetSpeed = this.baseSpeed * this.speedIntent * strokePower;
    this.currentSpeed += (targetSpeed - this.currentSpeed) * (1 - Math.exp(-2.2 * deltaSeconds));
    this.x += Math.cos(movementHeading) * this.currentSpeed * speedScale * deltaSeconds;
    this.y += Math.sin(movementHeading) * this.currentSpeed * speedScale * deltaSeconds;
    this.x = Math.min(bounds.width + 48, Math.max(-48, this.x));
    this.y = Math.min(bounds.height + 48, Math.max(-48, this.y));
    this.sprite.position.set(this.x, this.y);
    // A slight lag through a turn hints at body flex without bending the whole fish visibly.
    this.sprite.rotation = this.heading + this.angularVelocity * 0.025;
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
