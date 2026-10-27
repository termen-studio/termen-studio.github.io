// Hero: the cabinet is welded together from sparks, and the cursor works on it like a real torch.
// WebGL2, no libraries. Per frame:
//   1. heat field — the cursor paints four fading channels into a texture: r the torch point (gone in a fraction of a
//      second), g the seam's peak temper (stamped in beads, like the ripples of a weld), b the seam's visibility (fades
//      over a few seconds), a the seam's own red heat as it cools (about a second);
//   2. composite — the empty studio, the cabinet revealed row by row behind the landing sparks (lamp off → on); on the
//      steel itself: heat haze above hot metal, temper colours multiplied into the brushing, beads lit from the upper
//      right like the studio, the seam cooling through white, orange and cherry, the torch's flickering light pool and
//      the vertical glint it throws along the brushing, a blue flame tip;
//   3. build sparks — one per cabinet pixel of a 640×360 grid, only during the intro: they swirl in hot and cool to steel;
//   4. smoke — thin wisps rising from the hot spot and spreading out;
//   5. embers — sparks thrown back off the torch: air drag, gravity, cooling in flight from white to dark red.
// The effect runs only with ?fx on the page URL (see index.html). Otherwise, and without WebGL2 or for the RAL variant:
// the static frame with the lamp switched on.
const root = document.documentElement;
const stage = document.querySelector('.stage');
const canvas = stage.querySelector('canvas');
const lamp = stage.querySelector('.lamp-on');
const R = '?r=20';
const GRID_W = 640, GRID_H = 360;           // one build spark per cabinet cell
const INTRO = 3.0;                           // seconds from the spark cloud to the finished cabinet
const EMBERS = 1200, SMOKE = 240;            // ring buffers
const BEAD = 0.0065;                         // spacing of the seam's ripples, in stage heights
const ASPECT = 16 / 9;

function staticFrame(delay) {
  root.classList.remove('fx');
  setTimeout(() => lamp.classList.add('on'), delay);
}

if (!root.classList.contains('fx')) staticFrame(matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600);
else start().catch(err => { console.warn('spark intro off:', err); staticFrame(0); });

function load(src) {
  return new Promise((ok, fail) => {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => ok(im); im.onerror = () => fail(new Error('image ' + src)); im.src = src;
  });
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
    const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name);
  }
  return { p, u };
}

function texture(gl, img) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (img) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  return t;
}

const QUAD_VS = `#version 300 es
layout(location = 0) in vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

// each channel: last frame times a decay (minus a floor, so 8-bit values reach zero) or a running max, plus a soft
// capsule along this frame's stroke
const FIELD_FS = `#version 300 es
precision highp float;
uniform sampler2D uPrev; uniform vec2 uSize; uniform vec4 uSeg; uniform float uHeat, uMark, uRad, uAspect, uPulse;
out vec4 o;
void main() {
  vec2 uv = vec2(gl_FragCoord.x / uSize.x, 1.0 - gl_FragCoord.y / uSize.y);
  vec4 prev = texture(uPrev, gl_FragCoord.xy / uSize);
  vec2 a = uSeg.xy * vec2(uAspect, 1.0), b = uSeg.zw * vec2(uAspect, 1.0), p = uv * vec2(uAspect, 1.0);
  vec2 ab = b - a; float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-9), 0.0, 1.0);
  float d2 = dot(p - a - ab * t, p - a - ab * t), r2 = uRad * uRad;
  float heat = clamp(prev.r * 0.9 - 0.004 + uHeat * exp(-d2 / r2), 0.0, 1.0);
  // beads: the stamp swells and shrinks with the distance travelled, so the seam is a row of overlapping ripples
  float peak = max(prev.g * 0.9995, uMark * 0.95 * (0.78 + 0.22 * uPulse) * exp(-d2 / (r2 * (1.1 + 0.6 * uPulse))));
  float seen = max(prev.b * 0.995 - 0.0009, uMark * exp(-d2 / (r2 * 2.2)));
  float hot = max(prev.a * 0.962 - 0.002, uMark * exp(-d2 / (r2 * 1.2)));
  o = vec4(heat, peak, clamp(seen, 0.0, 1.0), clamp(hot, 0.0, 1.0));
}`;

const COMP_FS = `#version 300 es
precision highp float;
uniform sampler2D uPlate, uOff, uOn, uMask, uField;
uniform vec2 uRes, uTorchPos, uFieldTexel; uniform float uShow, uLamp, uIntro, uTime, uTorch, uAspect;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
vec4 F(vec2 uv) { return texture(uField, vec2(uv.x, 1.0 - uv.y)); }
// temper colours of steel, from the seam's edge to its centre: straw, brown, purple, blue, then dark oxide
vec3 temper(float g) {
  vec3 c = mix(vec3(1.0), vec3(1.08, 0.98, 0.78), smoothstep(0.0, 0.18, g));
  c = mix(c, vec3(0.98, 0.72, 0.46), smoothstep(0.18, 0.36, g));
  c = mix(c, vec3(0.76, 0.55, 0.82), smoothstep(0.36, 0.54, g));
  c = mix(c, vec3(0.5, 0.6, 1.0), smoothstep(0.54, 0.72, g));
  return mix(c, vec3(0.24, 0.25, 0.32), smoothstep(0.72, 0.95, g));
}
// incandescence: dull red, cherry, orange, yellow, white
vec3 glow(float h) {
  vec3 c = mix(vec3(0.5, 0.05, 0.0), vec3(1.0, 0.35, 0.04), smoothstep(0.1, 0.45, h));
  c = mix(c, vec3(1.0, 0.8, 0.35), smoothstep(0.45, 0.75, h));
  return mix(c, vec3(1.0, 0.97, 0.9), smoothstep(0.75, 1.0, h));
}
void main() {
  vec2 uv = vec2(gl_FragCoord.x / uRes.x, 1.0 - gl_FragCoord.y / uRes.y);
  // heat haze: hot air rising off the torch and the fresh seam bends the light, so the steel above it shimmers
  float hz = F(uv + vec2(0.0, 0.012)).r * 0.6 + F(uv + vec2(0.0, 0.03)).r * 0.4 + F(uv + vec2(0.0, 0.015)).a * 0.35;
  vec2 q = uv * vec2(70.0, 34.0) + vec2(0.0, uTime * 2.6);
  vec2 wob = vec2(noise(q), noise(q + vec2(5.2, 1.7))) - 0.5;
  vec2 suv = uv + wob * 0.006 * clamp(hz, 0.0, 1.0);
  vec3 plate = texture(uPlate, suv).rgb;
  vec3 cab = mix(texture(uOff, suv).rgb, texture(uOn, suv).rgb, uLamp);
  float m = texture(uMask, uv).r;
  // the cabinet is welded from the bottom up: each row turns crisp just behind the landing sparks
  float t0 = (1.0 - uv.y) * 0.55 + 0.075;
  float rowShow = smoothstep(t0 + 0.27, t0 + 0.36, uIntro);
  float front = 1.0 - (uIntro - 0.34) / 0.55;                   // the seam rides the landing wave
  float seam = m * exp(-pow((uv.y - front) * 70.0, 2.0)) * step(uIntro, 0.999);
  vec3 col = mix(plate, cab, mix(uShow, rowShow, m));           // outside the cabinet the frame appears at the end
  vec4 f = F(uv);
  float on = m * rowShow;
  float grain = 0.7 + 0.6 * noise(vec2(uv.x * 1400.0, uv.y * 60.0));   // heat tint runs along the vertical grain
  float lum = dot(cab, vec3(0.3, 0.59, 0.11));
  // the seam: temper colours multiplied into the steel; its beads lit from the upper right like the studio
  col *= mix(vec3(1.0), temper(clamp(f.g * grain, 0.0, 1.0)), f.b * on);
  float gx = F(uv + vec2(uFieldTexel.x, 0.0)).g - F(uv - vec2(uFieldTexel.x, 0.0)).g;
  float gy = F(uv + vec2(0.0, uFieldTexel.y)).g - F(uv - vec2(0.0, uFieldTexel.y)).g;
  vec3 nrm = normalize(vec3(-gx * 5.0, gy * 5.0, 1.0));         // uv.y runs down the screen
  vec3 L = normalize(vec3(0.8, 0.8, 1.0));
  col *= 1.0 + (dot(nrm, L) / L.z - 1.0) * 0.9 * f.b * on;
  // the seam's own heat as it cools behind the torch: white, yellow, orange, cherry, dark red
  float hot = f.a * on;
  col += glow(hot) * pow(hot, 1.6) * (1.0 + 0.8 * lum);
  // the torch point
  float h = f.r * on;
  col += glow(h) * h * h * (1.1 + 1.2 * lum) * (0.85 + 0.3 * grain);
  // the torch's light on the steel: a warm flickering pool, the vertical glint along the brushing, a blue flame tip
  vec2 dp = (uv - uTorchPos) * vec2(uAspect, 1.0);
  float pool = exp(-dot(dp, dp) / 0.0049) * uTorch * m;
  col += cab * vec3(1.0, 0.62, 0.32) * pool * 0.9;
  float glint = exp(-pow(dp.x / 0.003, 2.0)) * exp(-pow(dp.y / 0.12, 2.0)) * uTorch * m;
  col += vec3(1.0, 0.8, 0.55) * glint * (0.45 + 0.55 * grain) * 0.5;
  col += vec3(0.45, 0.65, 1.0) * exp(-dot(dp, dp) / 0.000036) * uTorch * 0.5;
  col += vec3(1.0, 0.8, 0.35) * seam * 1.3;                     // the welding seam of the intro
  o = vec4(col, 1.0);
}`;

const BUILD_VS = `#version 300 es
precision highp float;
in vec2 aHome; in vec3 aColor; in float aSeed;
uniform float uTime, uIntro, uPointPx, uAspect;
out vec3 vColor; out float vHeat, vAlpha, vSeed;
void main() {
  float s = aSeed;
  float t0 = (1.0 - aHome.y) * 0.55 + s * 0.15;                 // bottom rows land first
  float p = clamp((uIntro - t0) / 0.3, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - p, 3.0);
  float r = 0.16 + 0.44 * fract(s * 13.7);                      // a swirling arc of sparks round the cabinet
  float ang = s * 43.98 + uTime * (0.5 + 1.6 * fract(s * 7.13)) * (1.0 - e * 0.9);
  vec2 cloud = vec2(0.5, 0.47) + vec2(cos(ang) * r / uAspect, sin(ang) * r * 0.82);
  cloud += 0.018 * vec2(sin(uTime * 1.7 + s * 91.0), cos(uTime * 1.3 + s * 67.0));
  vec2 pos = mix(cloud, aHome, e);
  vHeat = 1.0 - smoothstep(0.72, 1.0, p);                       // hot in flight, cooling to steel on arrival
  float rowShow = smoothstep((1.0 - aHome.y) * 0.55 + 0.345, (1.0 - aHome.y) * 0.55 + 0.435, uIntro);
  vAlpha = (1.0 - rowShow) * smoothstep(0.0, 0.08, uIntro + s * 0.05);
  vColor = aColor; vSeed = s;
  gl_Position = vec4(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0);
  gl_PointSize = uPointPx * mix(0.55, 1.4, e);                  // settled ones close up into a surface
}`;

const BUILD_FS = `#version 300 es
precision highp float;
in vec3 vColor; in float vHeat, vAlpha, vSeed;
out vec4 o;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float square = 1.0 - smoothstep(0.4, 0.5, max(abs(q.x), abs(q.y)));   // a settled spark is a pixel of the steel
  float soft = exp(-dot(q, q) * 26.0);                                  // a hot one is a soft point of light
  float a = mix(square, soft, vHeat) * vAlpha;
  vec3 spark = mix(vec3(1.0, 0.76, 0.22), vec3(1.0, 0.96, 0.82), fract(vSeed * 9.31)) * 1.7;
  o = vec4(mix(vColor, spark, vHeat * 0.92) * a, a);
}`;

// smoke: soft grey puffs that rise, wander, swell and thin out
const SMOKE_VS = `#version 300 es
precision highp float;
in vec2 aOrigin; in vec3 aBls;                                  // birth, life, seed
uniform float uTime, uPointPx, uAspect;
out float vA;
void main() {
  float age = uTime - aBls.x, life = aBls.y, s = aBls.z;
  if (age < 0.0 || age > life) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  float k = age / life;
  vec2 drift = vec2(sin(age * 1.7 + s * 30.0) * 0.012 + (s - 0.5) * 0.05 * k, -0.07 * age - 0.025 * age * age);
  vec2 pos = aOrigin + drift * vec2(1.0 / uAspect, 1.0);
  vA = 0.045 * smoothstep(0.0, 0.2, k) * (1.0 - k) * (1.0 - k);   // a thin wisp, not steam
  gl_Position = vec4(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0);
  gl_PointSize = uPointPx * (0.35 + 1.6 * k);
}`;

const SMOKE_FS = `#version 300 es
precision highp float;
in float vA;
out vec4 o;
void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.1, r) * vA; o = vec4(vec3(0.5, 0.51, 0.54) * a, a); }`;

// embers thrown off the torch: air drag and gravity in closed form, cooling in flight; drawn five times with a lag
const EMBER_VS = `#version 300 es
precision highp float;
in vec2 aOrigin; in vec2 aVel; in vec3 aBls;                    // birth, life, seed
uniform float uTime, uLag, uPointPx, uAspect;
out vec3 vC; out float vA;
void main() {
  float age = uTime - aBls.x - uLag, life = aBls.y;
  if (age < 0.0 || age > life) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); gl_PointSize = 0.0; vA = 0.0; vC = vec3(0.0); return; }
  float kd = 2.2, ea = (1.0 - exp(-kd * age)) / kd;
  vec2 disp = aVel * ea + vec2(0.0, 2.6) * (age - ea) / kd;
  vec2 pos = aOrigin + disp * vec2(1.0 / uAspect, 1.0);
  float k = age / life;
  vA = (1.0 - k) * (1.0 - 0.3 * k);
  vC = mix(mix(vec3(1.0, 0.92, 0.7), vec3(1.0, 0.45, 0.08), smoothstep(0.0, 0.45, k)), vec3(0.6, 0.08, 0.02), smoothstep(0.45, 1.0, k));
  gl_Position = vec4(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0);
  gl_PointSize = uPointPx * (0.6 + 0.6 * fract(aBls.z * 7.3)) * (1.0 - 0.45 * k);
}`;

const EMBER_FS = `#version 300 es
precision highp float;
in vec3 vC; in float vA; uniform float uFade;
out vec4 o;
void main() { vec2 q = gl_PointCoord - 0.5; float a = exp(-dot(q, q) * 20.0) * vA * uFade; o = vec4(vC * a * 1.6, a); }`;

async function start() {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: true });
  if (!gl) throw new Error('no webgl2');
  const big = stage.getBoundingClientRect().width * Math.min(devicePixelRatio || 1, 2) > 1700;
  const suffix = big ? '' : '-1600';
  const [off, on, plate, mask] = await Promise.all([
    load(`img/hero-steel${suffix}.jpg${R}`), load(`img/hero-steel-on${suffix}.jpg${R}`),
    load(`img/plate-steel${suffix}.jpg${R}`), load(`img/mask-steel.png${R}`)]);

  // build sparks: one per cabinet cell, coloured by the unlit frame; the same grid tells where the steel is
  const c2 = document.createElement('canvas'); c2.width = GRID_W; c2.height = GRID_H;
  const x2 = c2.getContext('2d', { willReadFrequently: true });
  x2.drawImage(mask, 0, 0, GRID_W, GRID_H); const mk = x2.getImageData(0, 0, GRID_W, GRID_H).data;
  x2.drawImage(off, 0, 0, GRID_W, GRID_H); const px = x2.getImageData(0, 0, GRID_W, GRID_H).data;
  const home = [], color = [], seed = [];
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
    const i = (y * GRID_W + x) * 4;
    if (mk[i] < 128) continue;
    home.push((x + 0.5) / GRID_W, (y + 0.5) / GRID_H);
    color.push(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
    seed.push(Math.random());
  }
  const COUNT = seed.length;
  const onSteel = ([u, v]) => u > 0 && u < 1 && v > 0 && v < 1 && mk[(Math.floor(v * GRID_H) * GRID_W + Math.floor(u * GRID_W)) * 4] > 128;

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const fieldP = program(gl, QUAD_VS, FIELD_FS), compP = program(gl, QUAD_VS, COMP_FS);
  const buildP = program(gl, BUILD_VS, BUILD_FS), smokeP = program(gl, SMOKE_VS, SMOKE_FS), emberP = program(gl, EMBER_VS, EMBER_FS);

  const quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function attribs(prog, list, usage) {          // list: [name, Float32Array, size]; returns the vao and buffers
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const bufs = list.map(([name, data, size]) => {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage);
      const loc = gl.getAttribLocation(prog.p, name);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return b;
    });
    gl.bindVertexArray(null);
    return { vao, bufs, arrays: list.map(l => l[1]), dirty: false, next: 0 };
  }
  const build = attribs(buildP, [['aHome', new Float32Array(home), 2], ['aColor', new Float32Array(color), 3], ['aSeed', new Float32Array(seed), 1]], gl.STATIC_DRAW);
  const ember = attribs(emberP, [['aOrigin', new Float32Array(EMBERS * 2), 2], ['aVel', new Float32Array(EMBERS * 2), 2], ['aBls', new Float32Array(EMBERS * 3).fill(-99), 3]], gl.DYNAMIC_DRAW);
  const smoke = attribs(smokeP, [['aOrigin', new Float32Array(SMOKE * 2), 2], ['aBls', new Float32Array(SMOKE * 3).fill(-99), 3]], gl.DYNAMIC_DRAW);
  function upload(ring) {
    if (!ring.dirty) return;
    ring.arrays.forEach((arr, k) => { gl.bindBuffer(gl.ARRAY_BUFFER, ring.bufs[k]); gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr); });
    ring.dirty = false;
  }
  function throwSparks(at, motion, n, t) {
    const [o, v, bls] = ember.arrays;
    const len = Math.hypot(motion[0] * ASPECT, motion[1]);
    const base = len > 1e-5 ? Math.atan2(-motion[1], -motion[0] * ASPECT) : -Math.PI / 2;   // back against the stroke
    for (let k = 0; k < n; k++) {
      const i = ember.next; ember.next = (ember.next + 1) % EMBERS;
      const a = base + (Math.random() - 0.5) * 1.2, s = 0.8 + 1.4 * Math.random();
      o[i * 2] = at[0]; o[i * 2 + 1] = at[1];
      v[i * 2] = Math.cos(a) * s; v[i * 2 + 1] = Math.sin(a) * s - 0.4;                  // a little lift, then gravity
      bls[i * 3] = t; bls[i * 3 + 1] = 0.25 + 0.4 * Math.random(); bls[i * 3 + 2] = Math.random();
    }
    ember.dirty = true;
  }
  function puff(at, t) {
    const [o, bls] = smoke.arrays, i = smoke.next; smoke.next = (smoke.next + 1) % SMOKE;
    o[i * 2] = at[0]; o[i * 2 + 1] = at[1] - 0.004;
    bls[i * 3] = t; bls[i * 3 + 1] = 1.1 + 0.8 * Math.random(); bls[i * 3 + 2] = Math.random();
    smoke.dirty = true;
  }

  const tex = { plate: texture(gl, plate), off: texture(gl, off), on: texture(gl, on), mask: texture(gl, mask) };
  const FW = 1280, FH = 720, fields = [];              // the four heat channels, ping-ponged
  for (let i = 0; i < 2; i++) {
    const t = texture(gl, null);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, FW, FH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    fields.push({ t, fb });
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  let W = 0, H = 0;
  const resize = () => {
    const r = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.width = Math.round(r.width * dpr); H = canvas.height = Math.round(r.height * dpr);
  };
  resize(); addEventListener('resize', () => { resize(); wake(); });

  // the cursor, in stage coordinates (0..1 from the top left)
  let cur = null, last = null, lastMove = -1e9, activeUntil = 0;
  addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect();
    cur = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    if (!last) last = cur;
    lastMove = performance.now();
    wake();
  }, { passive: true });

  let read = 0, raf = 0, prevT = 0, beadPhase = 0, torch = 0;
  const t0 = performance.now();
  function bind(unit, t, loc) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); }
  function frame(now) {
    raf = 0;
    const t = (now - t0) / 1000, dt = Math.max(1 / 240, Math.min(0.1, t - prevT)); prevT = t;
    const intro = Math.min(1, t / INTRO);
    const show = Math.min(1, Math.max(0, (intro - 0.9) / 0.1));    // the rest of the frame (floor, shadows) at the end
    const lampK = Math.min(1, Math.max(0, (t - INTRO - 0.25) / 0.18));
    if (lampK > 0) lamp.classList.add('on');            // the faint halo follows the lamp

    // the torch heats only the steel, only once the cabinet stands, and only while the hand moves (or just stopped)
    const heating = show > 0.99 && cur && last && onSteel(cur) && now - lastMove < 220;
    const motion = cur && last ? [cur[0] - last[0], cur[1] - last[1]] : [0, 0];
    const moved = Math.hypot(motion[0] * ASPECT, motion[1]);
    torch += ((heating ? 1 : 0) - torch) * Math.min(1, dt * 14);
    const flicker = torch * (0.8 + 0.2 * (0.5 + 0.5 * Math.sin(t * 53)) * (0.6 + 0.4 * Math.random()));
    if (heating) {
      beadPhase += moved / BEAD * Math.PI * 2;
      throwSparks(cur, motion, Math.min(7, Math.round(moved / dt * 5 + Math.random())), t);
      if (Math.random() < 0.35) puff(cur, t);
    }

    // 1. heat field
    const src = fields[read], dst = fields[1 - read];
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, FW, FH);
    gl.disable(gl.BLEND); gl.useProgram(fieldP.p); gl.bindVertexArray(quadVao);
    bind(0, src.t, fieldP.u.uPrev);
    gl.uniform2f(fieldP.u.uSize, FW, FH); gl.uniform1f(fieldP.u.uAspect, ASPECT);
    gl.uniform4f(fieldP.u.uSeg, ...(last || [0, 0]), ...(cur || [0, 0]));
    gl.uniform1f(fieldP.u.uHeat, heating ? 0.45 : 0); gl.uniform1f(fieldP.u.uMark, heating ? 1 : 0);
    gl.uniform1f(fieldP.u.uRad, 0.0045);                   // a torch point, smaller than the cursor
    gl.uniform1f(fieldP.u.uPulse, 0.5 + 0.5 * Math.cos(beadPhase));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (cur) last = cur;
    read = 1 - read;

    // 2. studio, cabinet, the torch on the steel
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    gl.useProgram(compP.p);
    bind(0, tex.plate, compP.u.uPlate); bind(1, tex.off, compP.u.uOff); bind(2, tex.on, compP.u.uOn);
    bind(3, tex.mask, compP.u.uMask); bind(4, dst.t, compP.u.uField);
    gl.uniform2f(compP.u.uRes, W, H); gl.uniform1f(compP.u.uShow, show); gl.uniform1f(compP.u.uLamp, lampK);
    gl.uniform1f(compP.u.uIntro, intro); gl.uniform1f(compP.u.uTime, t); gl.uniform1f(compP.u.uAspect, ASPECT);
    gl.uniform2f(compP.u.uTorchPos, ...(cur || [-1, -1])); gl.uniform1f(compP.u.uTorch, flicker);
    gl.uniform2f(compP.u.uFieldTexel, 1 / FW, 1 / FH);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 3. build sparks, during the intro only (premultiplied, so hot ones glow brighter than the steel)
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (intro < 1) {
      gl.useProgram(buildP.p); gl.bindVertexArray(build.vao);
      gl.uniform1f(buildP.u.uTime, t); gl.uniform1f(buildP.u.uIntro, intro);
      gl.uniform1f(buildP.u.uPointPx, W / GRID_W * 1.15); gl.uniform1f(buildP.u.uAspect, ASPECT);
      gl.drawArrays(gl.POINTS, 0, COUNT);
    }

    // 4. smoke
    gl.useProgram(smokeP.p); gl.bindVertexArray(smoke.vao); upload(smoke);
    gl.uniform1f(smokeP.u.uTime, t); gl.uniform1f(smokeP.u.uPointPx, W / 1440 * 44); gl.uniform1f(smokeP.u.uAspect, ASPECT);
    gl.drawArrays(gl.POINTS, 0, SMOKE);

    // 5. embers, added as light, with lagged copies for streaks
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(emberP.p); gl.bindVertexArray(ember.vao); upload(ember);
    gl.uniform1f(emberP.u.uTime, t); gl.uniform1f(emberP.u.uPointPx, W / 1440 * 3.2); gl.uniform1f(emberP.u.uAspect, ASPECT);
    for (const [lag, fade] of [[0, 1], [0.007, 0.7], [0.014, 0.5], [0.021, 0.33], [0.028, 0.2]]) {
      gl.uniform1f(emberP.u.uLag, lag); gl.uniform1f(emberP.u.uFade, fade);
      gl.drawArrays(gl.POINTS, 0, EMBERS);
    }

    if (t < INTRO + 0.6 || now < activeUntil || torch > 0.01) raf = requestAnimationFrame(frame);
  }
  function wake() {
    activeUntil = performance.now() + 9000;              // the seam takes a few seconds to cool away
    if (!raf) raf = requestAnimationFrame(frame);
  }
  root.classList.add('fx-ready');
  wake();
}
