/* Q-Detailing «Лак»: a WebGL pass over the hero film. The studio's hexagon lamps are already mirrored in the paint;
   near the cursor those reflections ignite and bloom, and only on the car: the car mask comes
   from 12 rembg keyframes packed in media/h-u9-mask.png (4 x 3 tiles, 480 x 270 each, one per 10 film frames).
   If WebGL or the video texture is not available, the canvas removes itself and qceil.js draws the film. */
(() => {
  const scene = document.querySelector('[data-ceil]');
  const canvas = scene && scene.querySelector('[data-lac]');
  if (!canvas) return;
  const video = scene.querySelector('video');
  const root = document.documentElement;
  const calm = root.classList.contains('calm');
  const FWD = 112 / 30;   // the film runs forward for 112 frames, then plays back reversed

  const fail = () => { scene.dataset.gl = '0'; canvas.remove(); };
  let gl = null;
  try { gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false }); } catch (e) { gl = null; }
  if (!gl) { fail(); return; }

  const VS = 'attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uVideo, uMask;
uniform vec2 uRes, uVid, uMouse;
uniform float uLight;
uniform vec3 uKey;
varying vec2 vUv;

float luma(vec2 uv) { return dot(texture2D(uVideo, uv).rgb, vec3(0.299, 0.587, 0.114)); }
vec2 tile(float k, vec2 uv) { return vec2((mod(k, 4.0) + uv.x) / 4.0, (2.0 - floor(k / 4.0) + uv.y) / 3.0); }
float hot(vec2 uv) { return smoothstep(0.55, 0.95, luma(uv)); }

void main() {
  vec2 frag = vUv * uRes;
  float s = max(uRes.x / uVid.x, uRes.y / uVid.y);
  vec2 size = uVid * s;
  vec2 uv = (frag - (uRes - size) * 0.5) / size;            // film coordinates, like object-fit: cover
  vec3 col = texture2D(uVideo, uv).rgb;
  float car = mix(texture2D(uMask, tile(uKey.x, uv)).r, texture2D(uMask, tile(uKey.y, uv)).r, uKey.z);

  // the lamps' reflections are already in the paint: find them, and their glow on two rings around each pixel
  float hi = hot(uv);
  vec2 r1 = 5.0 / uVid, r2 = 13.0 / uVid;
  float halo = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7853982 + 0.39;
    vec2 o = vec2(cos(a), sin(a));
    halo += hot(uv + o * r1) * 0.62 + hot(uv + o * r2) * 0.38;
  }
  halo /= 8.0;

  // the inspection lamp: a soft hexagon of light, pointy-top like the studio's lamps
  vec2 d = (vUv - uMouse) * vec2(uRes.x / uRes.y, 1.0);
  vec2 q = abs(vec2(d.y, d.x));
  float hx = max(dot(q, vec2(0.8660254, 0.5)), q.y);       // hexagon "radius"
  float pool = 1.0 - smoothstep(0.15, 0.24, hx);           // where the lamp is pointed
  float core = 1.0 - smoothstep(0.0, 0.2, hx);
  float wide = 1.0 - smoothstep(0.16, 0.46, hx);

  float a = uLight;
  col *= mix(1.0, 0.4 + 0.6 * wide, a);                     // the rest of the studio falls into half-light
  col *= 1.0 + 0.42 * a * pool * car;                       // details come up under the lamp
  vec3 cold = vec3(0.62, 0.84, 1.0), white = vec3(0.92, 0.97, 1.0);
  col += white * a * pool * car * hi * 0.45;                // the lamps' reflections ignite...
  col += cold * a * (0.35 + 0.65 * pool) * core * car * halo * 1.5;   // ...and bloom in the lamp's colour
  col += cold * a * pool * car * 0.035;
  gl_FragColor = vec4(col, 1.0);
}`;

  const shader = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  };
  const vs = shader(gl.VERTEX_SHADER, VS), fs = shader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { fail(); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { fail(); return; }
  gl.useProgram(prog);
  scene.dataset.gl = 'pending';   // qceil.js shows the poster until the first film frame is on the GPU

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one triangle covers the screen
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const name of ['uVideo', 'uMask', 'uRes', 'uVid', 'uMouse', 'uLight', 'uKey']) U[name] = gl.getUniformLocation(prog, name);
  const texture = (unit) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    return t;
  };
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const vidTex = texture(0), maskTex = texture(1);
  gl.uniform1i(U.uVideo, 0); gl.uniform1i(U.uMask, 1);

  const mask = new Image();
  mask.onload = () => { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask); };
  mask.src = scene.dataset.mask;

  let W = 0, H = 0;
  const size = () => {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = scene.clientWidth; H = scene.clientHeight;
    const k = Math.min(dpr, Math.sqrt(3.2e6 / Math.max(1, W * H)));   // keep the pass under ~3 megapixels
    canvas.width = Math.round(W * k); canvas.height = Math.round(H * k);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  size();
  addEventListener('resize', size);

  let fresh = true;
  const upload = () => {
    if (video.readyState < 2) return;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, vidTex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); } catch (e) { fail(); return; }
    if (fresh) { fresh = false; scene.dataset.gl = '1'; }
  };
  if ('requestVideoFrameCallback' in video) {
    const onFrame = () => { upload(); video.requestVideoFrameCallback(onFrame); };
    video.requestVideoFrameCallback(onFrame);
  }

  // the light: follows the pointer; when nobody holds it, it sweeps slowly over the car
  let mx = 0.5, my = 0.6, tx = 0.5, ty = 0.6, light = 0, lastMove = -1e9, seen = true;
  const t0 = performance.now();
  const aim = (e) => {
    const b = scene.getBoundingClientRect();
    tx = (e.clientX - b.left) / b.width; ty = 1 - (e.clientY - b.top) / b.height;
    lastMove = performance.now();
  };
  scene.addEventListener('pointermove', aim);
  scene.addEventListener('pointerdown', aim);
  new IntersectionObserver((es) => { seen = es[0].isIntersecting; }).observe(scene);

  const draw = (now) => {
    requestAnimationFrame(draw);
    if (!seen || !canvas.isConnected) return;
    if (!('requestVideoFrameCallback' in video)) upload();
    if (!canvas.isConnected) return;
    const held = now - lastMove < 2600;
    const wave = Math.min(1, Math.max(0, (now - t0 - 1700) / 1200));   // after the lamps have switched on
    let target = 0;
    if (held) target = 1;
    else if (!calm) {
      const s = (now - t0) / 1000;
      tx = 0.5 + 0.3 * Math.sin(s * 0.5); ty = 0.6 + 0.08 * Math.sin(s * 0.83 + 0.6);
      target = 0.42 * wave;   // a gentle pass while nobody holds the lamp; the full lamp comes with the cursor
    }
    light += (target - light) * 0.06;
    mx += (tx - mx) * (held ? 0.18 : 0.05); my += (ty - my) * (held ? 0.18 : 0.05);
    const t = video.currentTime || 0;
    const sfwd = t < FWD ? t : Math.max(0, 2 * FWD - t);
    const fk = Math.min(11, Math.max(0, sfwd * 3));
    const k0 = Math.floor(fk);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform2f(U.uVid, video.videoWidth || 1920, video.videoHeight || 1080);
    gl.uniform2f(U.uMouse, mx, my);
    gl.uniform1f(U.uLight, light);
    gl.uniform3f(U.uKey, k0, Math.min(11, k0 + 1), fk - k0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  requestAnimationFrame(draw);
})();
