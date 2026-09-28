import { defaultFilterVert, Filter, Texture } from 'pixi.js';
import type { QualityProfile } from '../../config/defaults';

const RIPPLE_COUNT = 6;
const RIPPLE_LIFETIME = 3.6;
const WAKE_COUNT = 4;

const WATER_FRAGMENT = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uBackground;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;
uniform vec2 uViewSize;
uniform vec4 uBackgroundUv;
uniform float uTime;
uniform float uMotion;
uniform float uCaustics;
uniform vec4 uRipple0;
uniform vec4 uRipple1;
uniform vec4 uRipple2;
uniform vec4 uRipple3;
uniform vec4 uRipple4;
uniform vec4 uRipple5;
uniform vec4 uWake0;
uniform vec4 uWake1;
uniform vec4 uWake2;
uniform vec4 uWake3;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1)), f.x), f.y);
}

vec2 surfaceSlope(vec2 p) {
    // Broad, slow gusts interrupt the otherwise regular wave repetition.
    p += vec2(sin(p.y * 2.1 + uTime * 0.045), cos(p.x * 1.7 - uTime * 0.038)) * 0.11;
    return vec2(0.66, 0.75) * cos(dot(p, vec2(18, 21)) + uTime * 0.78) * 0.46
         + vec2(-0.94, 0.34) * cos(dot(p, vec2(-31, 11)) - uTime * 0.57) * 0.28
         + vec2(0.36, -0.93) * cos(dot(p, vec2(43, -37)) + uTime * 0.93) * 0.16
         + vec2(0.85, 0.52) * cos(dot(p, vec2(73, 45)) - uTime * 1.12) * 0.07;
}

vec2 rippleSlope(vec4 ripple, vec2 p, vec2 aspect) {
    if (ripple.z < 0.0) return vec2(0);
    vec2 delta = p - ripple.xy * aspect;
    float d = length(delta);
    float front = d - ripple.z * 0.14;
    float width = 0.018 + ripple.z * 0.009;
    float envelope = exp(-front * front / (width * width));
    float fade = exp(-ripple.z * 0.9) * smoothstep(0.0, 0.14, ripple.z)
               * (1.0 - smoothstep(2.7, 3.6, ripple.z));
    float carrier = cos(front * 235.0) * envelope;
    return delta / max(d, 0.001) * carrier * fade * ripple.w * 2.5;
}

vec2 wakeSlope(vec4 wake, vec2 p, vec2 aspect) {
    if (wake.w <= 0.0) return vec2(0);
    vec2 delta = p - wake.xy * aspect;
    vec2 forward = vec2(cos(wake.z), sin(wake.z));
    vec2 side = vec2(-forward.y, forward.x);
    float trail = -dot(delta, forward);
    float lateral = dot(delta, side);
    float front = abs(lateral) - trail * 0.32;
    float envelope = smoothstep(0.0, 0.024, trail) * (1.0 - smoothstep(0.035, 0.13, trail));
    float crest = exp(-front * front / 0.000075) * sin(front * 250.0 - trail * 45.0);
    return side * sign(lateral) * crest * envelope * wake.w;
}

void main() {
    // Filter textures may be pooled at a larger size than the viewport.
    vec2 screenUv = vTextureCoord * uInputSize.xy / uViewSize;
    vec2 aspect = uViewSize / min(uViewSize.x, uViewSize.y);
    vec2 p = screenUv * aspect;
    vec2 backgroundUv = uBackgroundUv.xy + screenUv * uBackgroundUv.zw;
    vec4 background = texture(uBackground, backgroundUv);
    // Use the scenery, never a fish's red/white skin, to identify the water.
    float water = smoothstep(0.015, 0.13, background.b - background.r)
                * smoothstep(0.025, 0.14, background.g - background.r);

    vec2 ambient = surfaceSlope(p) * uMotion;
    vec2 ripples = rippleSlope(uRipple0, p, aspect) + rippleSlope(uRipple1, p, aspect)
                 + rippleSlope(uRipple2, p, aspect) + rippleSlope(uRipple3, p, aspect)
                 + rippleSlope(uRipple4, p, aspect) + rippleSlope(uRipple5, p, aspect);
    vec2 wakes = wakeSlope(uWake0, p, aspect) + wakeSlope(uWake1, p, aspect)
               + wakeSlope(uWake2, p, aspect) + wakeSlope(uWake3, p, aspect);
    vec2 slope = ambient + ripples + wakes * uMotion;
    vec2 displacement = slope * 1.65 * water;
    vec2 sampleUv = clamp(vTextureCoord + displacement * uInputSize.zw,
                          uInputClamp.xy, uInputClamp.zw);
    vec4 color = texture(uTexture, sampleUv);

    // Weak sky reflection varies with the surface normal, above the submerged fish.
    vec3 normal = normalize(vec3(-slope * 0.24, 1.0));
    float fresnel = 0.018 + pow(1.0 - normal.z, 2.0) * 0.45;
    float cloud = noise(p * 2.2 + vec2(uTime * 0.009, -uTime * 0.006));
    vec3 sky = mix(vec3(0.30, 0.48, 0.48), vec3(0.79, 0.88, 0.85), cloud);
    color.rgb = mix(color.rgb, vec3(0.055, 0.29, 0.27) * color.a, water * 0.035);
    color.rgb = mix(color.rgb, sky * color.a, water * (fresnel + cloud * 0.035));
    float sun = pow(max(dot(normal, normalize(vec3(-0.24, -0.32, 1.0))), 0.0), 100.0);
    float specular = sun * (0.015 + cloud * 0.032) * uMotion;

    vec2 q = p * 28.0 + ambient * 0.28;
    q += vec2(sin(q.y * 0.39 + uTime * 0.22), sin(q.x * 0.31 - uTime * 0.17));
    float ridge = 1.0 - abs(sin(q.x + sin(q.y)) * sin(q.y - cos(q.x * 0.7)));
    float caustic = pow(ridge, 18.0) * 0.037 * uCaustics;
    // Alternating light and dark crests give ripples relief instead of drawn rings.
    float rippleLight = dot(ripples + wakes * uMotion, vec2(-0.045, -0.065));
    color.rgb += (vec3(0.76, 0.88, 0.79) * (specular + caustic) + rippleLight) * color.a * water;
    // Leaves and stones stay above the water and occlude fish passing underneath.
    finalColor = mix(background, color, water);
}
`;

interface Ripple { x: number; y: number; age: number; strength: number }
interface WakeFish { x: number; y: number; heading: number; depth: number; currentSpeed: number; baseSpeed: number }
interface WakeSlot { fish?: WakeFish; strength: number; x: number; y: number; heading: number }

export class PondWaterSurface {
  readonly filter: Filter;
  private readonly ripples: Ripple[] = Array.from({ length: RIPPLE_COUNT }, () => ({ x: 0, y: 0, age: -1, strength: 0 }));
  private rippleCursor = 0;
  private width = 1;
  private height = 1;
  private time = 0;
  private motionStrength = 0.85;
  private causticsStrength = 0.66;
  private readonly wakes: WakeSlot[] = Array.from({ length: WAKE_COUNT }, () => ({ strength: 0, x: 0, y: 0, heading: 0 }));

  constructor(private readonly background: Texture) {
    const resources: Record<string, { value: number | Float32Array; type: string }> = {
      uTime: { value: 0, type: 'f32' },
      uViewSize: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
      uBackgroundUv: { value: new Float32Array([0, 0, 1, 1]), type: 'vec4<f32>' },
      uMotion: { value: 0.85, type: 'f32' },
      uCaustics: { value: 0.66, type: 'f32' },
    };
    for (let i = 0; i < RIPPLE_COUNT; i++) {
      resources[`uRipple${i}`] = { value: new Float32Array([0, 0, -1, 0]), type: 'vec4<f32>' };
    }
    for (let i = 0; i < WAKE_COUNT; i++) {
      resources[`uWake${i}`] = { value: new Float32Array(4), type: 'vec4<f32>' };
    }
    this.filter = Filter.from({
      gl: { vertex: defaultFilterVert, fragment: WATER_FRAGMENT, name: 'pond-water-surface' },
      resources: { waterUniforms: resources, uBackground: background.source },
      resolution: 1,
      padding: 0,
    });
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const uniforms = this.filter.resources.waterUniforms.uniforms;
    (uniforms.uViewSize as Float32Array).set([this.width, this.height]);
    const cover = Math.max(this.width / this.background.width, this.height / this.background.height);
    const sx = this.width / (this.background.width * cover);
    const sy = this.height / (this.background.height * cover);
    (uniforms.uBackgroundUv as Float32Array).set([(1 - sx) / 2, (1 - sy) / 2, sx, sy]);
  }

  setQuality(profile: QualityProfile) {
    const scale = profile.shaderQuality === 'off' ? 0.5 : profile.shaderQuality === 'light' ? 0.8 : 1;
    this.filter.resolution = profile.shaderQuality === 'off' ? 0.65 : profile.shaderQuality === 'light' ? 1 : 1.25;
    this.motionStrength = scale;
    this.causticsStrength = scale * 0.8;
  }

  addRipple(x: number, y: number) {
    const ripple = this.ripples[this.rippleCursor]!;
    ripple.x = Math.min(1, Math.max(0, x / this.width));
    ripple.y = Math.min(1, Math.max(0, y / this.height));
    ripple.age = 0;
    ripple.strength = 1;
    this.rippleCursor = (this.rippleCursor + 1) % RIPPLE_COUNT;
  }

  update(deltaMs: number, motionEnabled: boolean, causticsEnabled: boolean, fish: readonly WakeFish[]) {
    const deltaSeconds = Math.min(0.05, Math.max(0, deltaMs / 1_000));
    if (motionEnabled) this.time += deltaSeconds;
    const uniforms = this.filter.resources.waterUniforms.uniforms;
    uniforms.uTime = this.time;
    uniforms.uMotion = motionEnabled ? this.motionStrength : 0;
    uniforms.uCaustics = causticsEnabled ? this.causticsStrength : 0;
    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const ripple = this.ripples[i]!;
      if (ripple.age >= 0) {
        ripple.age += deltaSeconds;
        if (ripple.age > RIPPLE_LIFETIME) ripple.age = -1;
      }
      (uniforms[`uRipple${i}`] as Float32Array).set([ripple.x, ripple.y, ripple.age, ripple.strength]);
    }
    // Keep each swimmer's slot until its trail has faded; all shallow fish are eligible.
    for (let i = 0; i < WAKE_COUNT; i++) {
      const wake = this.wakes[i]!;
      if (!wake.fish) {
        let best: WakeFish | undefined;
        let bestStrength = 0.025;
        for (const candidate of fish) {
          if (this.wakes.some((slot) => slot.fish === candidate)) continue;
          const strength = wakeStrength(candidate);
          if (strength > bestStrength) { best = candidate; bestStrength = strength; }
        }
        if (best) {
          wake.fish = best;
          wake.x = best.x;
          wake.y = best.y;
          wake.heading = best.heading;
        }
      }
      const swimmer = wake.fish;
      const present = swimmer !== undefined && fish.includes(swimmer);
      const target = present ? wakeStrength(swimmer) : 0;
      wake.strength += (target - wake.strength) * (1 - Math.exp(-deltaSeconds * 2.8));
      if (present) {
        wake.x = swimmer.x;
        wake.y = swimmer.y;
        const turn = Math.atan2(Math.sin(swimmer.heading - wake.heading), Math.cos(swimmer.heading - wake.heading));
        wake.heading += turn * (1 - Math.exp(-deltaSeconds * 4));
      }
      const data = uniforms[`uWake${i}`] as Float32Array;
      data.set([wake.x / this.width, wake.y / this.height, wake.heading, wake.strength]);
      if (target < 0.006 && wake.strength < 0.008) wake.fish = undefined;
    }
  }

  releaseInput() {
    // Pixi's shared filter input group retains the last pooled render target.
    // Detach it before a resize clears that pool (bindings 1/2 are input/sampler).
    const inputGroup = this.filter.groups[0];
    inputGroup?.setResource(Texture.EMPTY.source, 1);
    inputGroup?.setResource(Texture.EMPTY.source.style, 2);
  }

  destroy() {
    this.releaseInput();
    this.filter.destroy();
  }
}

function wakeStrength(fish: WakeFish) {
  const surface = Math.max(0, 1 - fish.depth / 0.55);
  const effort = Math.max(0, Math.min(1.4, fish.currentSpeed / fish.baseSpeed) - 0.45);
  return surface * effort * 0.5;
}
