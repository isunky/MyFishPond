import { Container, defaultFilterVert, Filter, Graphics } from 'pixi.js';
import type { QualityProfile } from '../../config/defaults';

const RIPPLE_COUNT = 4;
const RIPPLE_LIFETIME = 3.4;

const WATER_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uAspect;
uniform float uMotion;
uniform float uCaustics;
uniform vec4 uRipple0;
uniform vec4 uRipple1;
uniform vec4 uRipple2;
uniform vec4 uRipple3;

float waterHeight(vec2 p, float time) {
    float a = dot(p, vec2(7.0, 10.0)) + time * 0.44;
    float b = dot(p, vec2(-14.0, 4.0)) - time * 0.31;
    float c = dot(p, vec2(20.0, -13.0)) + time * 0.22;
    return sin(a) * 0.50 + sin(b) * 0.32 + sin(c) * 0.18;
}

vec2 waterGradient(vec2 p, float time) {
    float a = dot(p, vec2(7.0, 10.0)) + time * 0.44;
    float b = dot(p, vec2(-14.0, 4.0)) - time * 0.31;
    float c = dot(p, vec2(20.0, -13.0)) + time * 0.22;
    return cos(a) * vec2(7.0, 10.0) * 0.50
         + cos(b) * vec2(-14.0, 4.0) * 0.32
         + cos(c) * vec2(20.0, -13.0) * 0.18;
}

float rippleField(vec4 ripple, vec2 p, out float highlight) {
    if (ripple.z < 0.0) {
        highlight = 0.0;
        return 0.0;
    }

    vec2 center = ripple.xy * vec2(uAspect, 1.0);
    vec2 delta = p - center;
    float distanceToCenter = length(delta);
    float ringFront = distanceToCenter - ripple.z * 0.20;
    float fade = exp(-ripple.z * 1.18) * ripple.w;
    highlight = exp(-abs(ringFront) * 58.0) * fade;
    return sin(ringFront * 210.0) * exp(-abs(ringFront) * 30.0) * fade;
}

void main() {
    vec2 uv = vTextureCoord;
    vec2 p = uv * vec2(uAspect, 1.0);
    vec2 gradient = waterGradient(p, uTime);
    vec4 undistorted = texture(uTexture, uv);
    float baseBlueWater = smoothstep(0.06, 0.27, undistorted.b - undistorted.r);
    float baseGreenWater = smoothstep(0.05, 0.24, undistorted.g - undistorted.r);
    float waterMask = baseBlueWater * baseGreenWater;

    float highlight0;
    float highlight1;
    float highlight2;
    float highlight3;
    float ripple0 = rippleField(uRipple0, p, highlight0);
    float ripple1 = rippleField(uRipple1, p, highlight1);
    float ripple2 = rippleField(uRipple2, p, highlight2);
    float ripple3 = rippleField(uRipple3, p, highlight3);

    vec2 rippleDelta0 = p - uRipple0.xy * vec2(uAspect, 1.0);
    vec2 rippleDelta1 = p - uRipple1.xy * vec2(uAspect, 1.0);
    vec2 rippleDelta2 = p - uRipple2.xy * vec2(uAspect, 1.0);
    vec2 rippleDelta3 = p - uRipple3.xy * vec2(uAspect, 1.0);
    vec2 rippleOffset = rippleDelta0 / max(length(rippleDelta0), 0.0001) * ripple0
                      + rippleDelta1 / max(length(rippleDelta1), 0.0001) * ripple1
                      + rippleDelta2 / max(length(rippleDelta2), 0.0001) * ripple2
                      + rippleDelta3 / max(length(rippleDelta3), 0.0001) * ripple3;
    rippleOffset *= 0.00075;
    vec2 offset = (gradient * (0.000035 + waterMask * 0.00020) * uMotion) + rippleOffset;
    vec2 sampleUv = clamp(uv + offset, vec2(0.001), vec2(0.999));
    vec4 color = texture(uTexture, sampleUv);

    float causticA = sin(p.x * 25.0 + sin(p.y * 9.0 + uTime * 0.19) * 1.8 + uTime * 0.12);
    float causticB = sin(p.y * 27.0 + sin(p.x * 8.0 - uTime * 0.16) * 1.5 - uTime * 0.15);
    float caustic = smoothstep(0.50, 0.94, causticA * causticB);
    float rippleHighlight = max(max(highlight0, highlight1), max(highlight2, highlight3));
    float glint = caustic * waterMask * uCaustics * 0.34
                + rippleHighlight * (0.20 + waterMask * 0.80) * 0.52;

    color.rgb += vec3(0.56, 0.92, 0.98) * glint * color.a;
    finalColor = color;
}
`;

interface Ripple {
  x: number;
  y: number;
  age: number;
  strength: number;
}

export class PondWaterSurface {
  readonly filter: Filter;
  private readonly ripples: Ripple[] = Array.from({ length: RIPPLE_COUNT }, () => ({
    x: 0,
    y: 0,
    age: -1,
    strength: 0,
  }));
  private rippleCursor = 0;
  private width = 1;
  private height = 1;
  private time = 0;
  private motionStrength = 0.85;
  private causticsStrength = 0.66;
  private readonly rippleGraphics: Graphics;
  private hasDrawnRipples = false;

  constructor(fxLayer: Container) {
    this.rippleGraphics = new Graphics();
    fxLayer.addChild(this.rippleGraphics);

    const resources: Record<string, { value: number | Float32Array; type: string }> = {
      uTime: { value: 0, type: 'f32' },
      uAspect: { value: 1, type: 'f32' },
      uMotion: { value: 0.85, type: 'f32' },
      uCaustics: { value: 0.75, type: 'f32' },
    };
    for (let index = 0; index < RIPPLE_COUNT; index += 1) {
      resources[`uRipple${index}`] = {
        value: new Float32Array([0, 0, -1, 0]),
        type: 'vec4<f32>',
      };
    }

    this.filter = Filter.from({
      gl: { vertex: defaultFilterVert, fragment: WATER_FRAGMENT, name: 'pond-water-surface' },
      resources: { waterUniforms: resources },
      resolution: 0.72,
      padding: 2,
    });
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.filter.resources.waterUniforms.uniforms.uAspect = this.width / this.height;
  }

  setQuality(profile: QualityProfile) {
    const qualityScale = profile.shaderQuality === 'off' ? 0.55 : profile.shaderQuality === 'light' ? 0.78 : 1;
    this.filter.resolution = profile.shaderQuality === 'off' ? 0.48 : profile.shaderQuality === 'light' ? 0.68 : 0.88;
    this.motionStrength = qualityScale;
    this.causticsStrength = qualityScale * 0.78;
  }

  addRipple(x: number, y: number) {
    const ripple = this.ripples[this.rippleCursor]!;
    ripple.x = clamp(x / this.width, 0.02, 0.98);
    ripple.y = clamp(y / this.height, 0.02, 0.98);
    ripple.age = 0;
    ripple.strength = 1;
    this.rippleCursor = (this.rippleCursor + 1) % RIPPLE_COUNT;
  }

  update(deltaMs: number, motionEnabled: boolean, causticsEnabled: boolean) {
    const deltaSeconds = Math.min(0.05, Math.max(0, deltaMs / 1_000));
    this.time += deltaSeconds;
    const uniforms = this.filter.resources.waterUniforms.uniforms;
    uniforms.uTime = this.time;
    uniforms.uMotion = motionEnabled ? this.motionStrength : 0;
    uniforms.uCaustics = causticsEnabled ? this.causticsStrength : 0;

    for (let index = 0; index < this.ripples.length; index += 1) {
      const ripple = this.ripples[index]!;
      if (ripple.age >= 0) {
        ripple.age += deltaSeconds;
        if (ripple.age > RIPPLE_LIFETIME) ripple.age = -1;
      }
      const data = uniforms[`uRipple${index}`] as Float32Array;
      data[0] = ripple.x;
      data[1] = ripple.y;
      data[2] = ripple.age;
      data[3] = ripple.strength;
    }
    this.drawRipples();
  }

  destroy() {
    this.rippleGraphics.destroy();
    this.filter.destroy();
  }

  private drawRipples() {
    const activeRipples = this.ripples.filter((ripple) => ripple.age >= 0);
    if (activeRipples.length === 0 && !this.hasDrawnRipples) return;

    this.rippleGraphics.clear();
    this.hasDrawnRipples = activeRipples.length > 0;
    const radiusLimit = Math.min(this.width, this.height) * 0.28;

    for (const ripple of activeRipples) {
      const progress = clamp(ripple.age / RIPPLE_LIFETIME, 0, 1);
      const fade = (1 - progress) ** 1.35 * ripple.strength;
      const radius = radiusLimit * progress;
      const x = ripple.x * this.width;
      const y = ripple.y * this.height;
      this.rippleGraphics
        .circle(x, y, radius)
        .stroke({ color: 0xbcefff, width: 2, alpha: fade * 0.62 });
      this.rippleGraphics
        .circle(x, y, radius * 0.78)
        .stroke({ color: 0xe0ffff, width: 1.1, alpha: fade * 0.26 });
    }
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
