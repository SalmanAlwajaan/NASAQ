/* Space Mouse cinematic stage: WebGL2 renderer with PBR shading, shadow map, planar reflection and post grading.
   Z-up world in millimetres. All geometry comes from the STEP-derived bundle (assets/parts.wasm). */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ math */
  const M4 = {
    identity() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
    mul(a, b) {
      const o = new Float32Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++)
        o[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
      return o;
    },
    perspective(fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
    },
    ortho(l, r, b, t, n, f) {
      return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0,
        -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]);
    },
    lookAt(eye, c, up) {
      const z = V3.norm(V3.sub(eye, c)), x = V3.norm(V3.cross(up, z)), y = V3.cross(z, x);
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
        -V3.dot(x, eye), -V3.dot(y, eye), -V3.dot(z, eye), 1]);
    },
    scale(sx, sy, sz) { const m = M4.identity(); m[0] = sx; m[5] = sy; m[10] = sz; return m; },
    translate(x, y, z) { const m = M4.identity(); m[12] = x; m[13] = y; m[14] = z; return m; },
    project(m, p) {
      const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
      const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
      const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
      return [x / w, y / w, w];
    }
  };
  const V3 = {
    sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
    add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
    scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; },
    dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
    cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; },
    len(a) { return Math.hypot(a[0], a[1], a[2]); },
    norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const easeInOut = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const easeOut = (x) => { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); };
  const lerp = (a, b, t) => a + (b - a) * t;
  // Catmull-Rom over keyframe arrays [{t, v:[...]}]
  function spline(keys, t) {
    t = clamp(t, keys[0].t, keys[keys.length - 1].t);
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const k0 = keys[Math.max(i - 1, 0)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(i + 2, keys.length - 1)];
    const u = (t - k1.t) / (k2.t - k1.t || 1);
    const out = [];
    for (let c = 0; c < k1.v.length; c++) {
      const p0 = k0.v[c], p1 = k1.v[c], p2 = k2.v[c], p3 = k3.v[c];
      out.push(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u));
    }
    return out;
  }

  /* ------------------------------------------------------------------ shaders */
  const PBR_VS = `#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPos;
  layout(location=1) in vec3 aNrm;
  uniform mat4 uVP, uModel, uLightVP;
  uniform vec3 uMin, uMax;
  out vec3 vP; out vec3 vN; out vec4 vShadow;
  void main(){
    vec3 p = mix(uMin, uMax, aPos);
    vec4 wp = uModel * vec4(p, 1.0);
    vP = wp.xyz;
    vN = mat3(uModel) * aNrm;
    vShadow = uLightVP * wp;
    gl_Position = uVP * wp;
  }`;

  const PBR_FS = `#version 300 es
  precision highp float;
  precision highp sampler2DShadow;
  in vec3 vP; in vec3 vN; in vec4 vShadow;
  uniform vec3 uEye, uColor, uEmissive;
  uniform float uRough, uMetal, uGhost, uHighlight, uMirror, uFloorZ, uExposureHint;
  uniform vec3 uKeyDir, uFillDir, uRimDir;
  uniform vec3 uKeyCol, uFillCol, uRimCol;
  uniform sampler2DShadow uShadow;
  uniform vec2 uShadowTexel;
  uniform vec3 uBg;
  uniform float uLight;
  out vec4 outColor;
  const float PI = 3.14159265;

  float D_GGX(float NoH, float a){ float a2 = a*a; float d = NoH*NoH*(a2-1.0)+1.0; return a2/(PI*d*d+1e-7); }
  float G_Smith(float NoV, float NoL, float a){ float k = (a+1.0)*(a+1.0)/8.0; return (NoV/(NoV*(1.0-k)+k))*(NoL/(NoL*(1.0-k)+k)); }
  vec3 F_Schlick(float VoH, vec3 F0){ return F0 + (1.0-F0)*pow(1.0-VoH, 5.0); }

  // Procedural studio environment: dark room, one large softbox above-front, a cool strip behind.
  vec3 env(vec3 d, float rough){
    float up = d.z;
    vec3 base = mix(vec3(0.015,0.016,0.02), vec3(0.06,0.062,0.07), smoothstep(-0.2, 0.4, up));
    base = mix(base, vec3(0.03,0.032,0.04), smoothstep(0.5, 1.0, up));
    if (uLight > 0.5) {
      // استوديو فاتح: أرضية بلون الصفحة، سماء بيضاء ناعمة
      base = mix(uBg * 0.8, vec3(0.70, 0.72, 0.68), smoothstep(-0.3, 0.5, up));
      base = mix(base, vec3(0.86), smoothstep(0.5, 1.0, up));
    }
    vec3 sbDir = normalize(vec3(-0.35,-0.55,0.75));
    float sbHalf = mix(0.22, 0.9, rough);
    float sb = smoothstep(cos(sbHalf+0.25), cos(sbHalf), dot(d, sbDir));
    float sbI = mix(3.2, 0.9, rough);
    vec3 rimDir = normalize(vec3(0.3, 0.95, 0.35));
    float rimHalf = mix(0.12, 0.6, rough);
    float rim = smoothstep(cos(rimHalf+0.2), cos(rimHalf), dot(d, rimDir));
    float rimI = mix(1.6, 0.5, rough);
    if (uLight > 0.5) { sbI *= 0.38; rimI *= 0.3; }
    return base + sb*sbI*vec3(1.0,0.97,0.92) + rim*rimI*vec3(0.75,0.85,1.0);
  }

  float shadowPCF(vec4 sc, float NoL){
    vec3 p = sc.xyz / sc.w * 0.5 + 0.5;
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
    float bias = mix(0.0025, 0.0006, NoL);
    float s = 0.0;
    vec2 poisson[12] = vec2[12](vec2(-0.94,-0.40),vec2(0.94,-0.77),vec2(-0.09,-0.93),vec2(0.34,0.29),vec2(-0.91,0.46),vec2(-0.82,-0.88),
                                vec2(-0.38,0.28),vec2(0.97,0.26),vec2(0.44,-0.98),vec2(0.53,0.73),vec2(-0.26,0.71),vec2(0.19,-0.37));
    for (int i = 0; i < 12; i++) {
      s += texture(uShadow, vec3(p.xy + poisson[i] * uShadowTexel * 1.8, p.z - bias));
    }
    return s / 12.0;
  }

  vec3 shade(vec3 N, vec3 V, vec3 L, vec3 lc, vec3 albedo, vec3 F0, float a, float shadow){
    vec3 H = normalize(V + L);
    float NoL = max(dot(N, L), 0.0), NoV = max(dot(N, V), 1e-4), NoH = max(dot(N, H), 0.0), VoH = max(dot(V, H), 0.0);
    vec3 F = F_Schlick(VoH, F0);
    float D = D_GGX(NoH, a), G = G_Smith(NoV, NoL, a);
    vec3 spec = F * D * G / max(4.0 * NoV * NoL, 1e-4);
    vec3 kd = (1.0 - F) * (1.0 - uMetal);
    return (kd * albedo / PI + spec) * lc * NoL * shadow;
  }

  void main(){
    if (uMirror > 0.5 && vP.z < uFloorZ) discard;
    vec3 N = normalize(vN);
    vec3 V = normalize(uEye - vP);
    if (dot(N, V) < 0.0) N = -N;
    float rough = clamp(uRough, 0.04, 1.0);
    float a = rough * rough;
    vec3 albedo = uColor;
    vec3 F0 = mix(vec3(0.04), albedo, uMetal);
    float sh = shadowPCF(vShadow, max(dot(N, uKeyDir), 0.0));
    vec3 col = vec3(0.0);
    col += shade(N, V, uKeyDir, uKeyCol, albedo, F0, a, sh);
    col += shade(N, V, uFillDir, uFillCol, albedo, F0, a, 1.0);
    col += shade(N, V, uRimDir, uRimCol, albedo, F0, a, 1.0);
    // environment: diffuse irradiance + specular reflection
    vec3 R = reflect(-V, N);
    float NoV = max(dot(N, V), 1e-4);
    vec3 Fr = F0 + (max(vec3(1.0 - rough), F0) - F0) * pow(1.0 - NoV, 5.0);
    vec3 irr = env(N, 1.0) * 0.9;
    vec3 diffuseEnv = irr * albedo * (1.0 - uMetal) * (1.0 - Fr);
    vec3 specEnv = env(R, rough) * Fr * mix(1.0, 0.55, rough);
    // horizon occlusion for reflections pointing into the floor
    specEnv *= smoothstep(-0.35, 0.15, R.z) * 0.8 + 0.2;
    col += diffuseEnv + specEnv;
    col += uEmissive;
    // highlight (accent rim) and ghosting toward background
    float fres = pow(1.0 - NoV, 3.0);
    col = mix(col, vec3(0.95, 0.45, 0.18) * (0.5 + fres * 1.6), uHighlight * (0.25 + 0.6 * fres));
    col = mix(col, uBg, uGhost);
    if (uMirror > 0.5) col *= 0.9;
    outColor = vec4(col, 1.0);
  }`;

  const DEPTH_VS = `#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPos;
  uniform mat4 uLightVP, uModel; uniform vec3 uMin, uMax;
  void main(){ gl_Position = uLightVP * uModel * vec4(mix(uMin, uMax, aPos), 1.0); }`;
  const DEPTH_FS = `#version 300 es
  precision highp float; out vec4 o; void main(){ o = vec4(1.0); }`;

  const FLOOR_VS = `#version 300 es
  precision highp float;
  layout(location=0) in vec2 aQ;
  uniform mat4 uVP, uLightVP; uniform vec3 uC; uniform float uR;
  out vec3 vP; out vec4 vShadow; out vec4 vClip;
  void main(){ vec3 p = uC + vec3(aQ * uR, 0.0); vP = p; vShadow = uLightVP * vec4(p,1.0); vClip = uVP * vec4(p, 1.0); gl_Position = vClip; }`;
  const FLOOR_FS = `#version 300 es
  precision highp float;
  precision highp sampler2DShadow;
  in vec3 vP; in vec4 vShadow; in vec4 vClip;
  uniform vec3 uEye, uKeyDir, uKeyCol, uBg, uCenter;
  uniform sampler2DShadow uShadow; uniform vec2 uShadowTexel;
  uniform sampler2D uRefl; uniform float uReflStrength, uPool, uFade, uLight;
  out vec4 outColor;
  float shadowPCF(vec4 sc){
    vec3 p = sc.xyz / sc.w * 0.5 + 0.5;
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
    float s = 0.0;
    for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++)
      s += texture(uShadow, vec3(p.xy + vec2(float(i), float(j)) * uShadowTexel * 1.6, p.z - 0.0012));
    return s / 25.0;
  }
  void main(){
    vec3 V = normalize(uEye - vP);
    float d = length(vP.xy - uCenter.xy);
    float sh = shadowPCF(vShadow);
    // soft spotlight pool under the product
    float pool = exp(-d * d / (uPool * uPool));
    vec3 base = uBg * 1.02;
    vec3 lit = base + vec3(0.030, 0.027, 0.024) * pool * (0.3 + 0.7 * sh);
    // planar reflection, blurred and faded with distance
    vec2 suv = vClip.xy / vClip.w * 0.5 + 0.5;
    vec3 refl = vec3(0.0);
    float blur = 0.0025 + 0.008 * clamp(d / 60.0, 0.0, 1.0);
    for (int i = -3; i <= 3; i++) { refl += texture(uRefl, suv + vec2(0.0, float(i) * blur)).rgb; }
    refl /= 7.0;
    float fres = pow(1.0 - max(dot(V, vec3(0.0,0.0,1.0)), 0.0), 2.0);
    float rs = uReflStrength * (0.35 + 0.65 * fres) * exp(-d * d / (uPool * uPool * 2.2));
    vec3 col = lit + refl * rs;
    // contact shadow darkening (ambient occlusion-like)
    col *= mix(1.0, 0.5 + 0.5 * sh, pool);
    float far = exp(-d * d / (260.0 * 260.0));
    col = mix(uBg * 0.9, col, uFade * far);
    if (uLight > 0.5) {
      // أرضية بلون الصفحة تماماً، ظل تلامس ناعم تحت الجهاز، وانعكاس خفيف
      vec3 lcol = uBg * (0.72 + 0.28 * sh);
      lcol = mix(lcol, uBg, 1.0 - pool * 0.9);
      lcol += (refl - uBg) * rs * 0.45;
      col = mix(uBg, lcol, uFade * far);
    }
    outColor = vec4(col, 1.0);
  }`;

  const BG_VS = `#version 300 es
  precision highp float; layout(location=0) in vec2 aQ; out vec2 vUv; void main(){ vUv = aQ*0.5+0.5; gl_Position = vec4(aQ, 0.9999, 1.0); }`;
  const BG_FS = `#version 300 es
  precision highp float; in vec2 vUv; uniform vec3 uBg; uniform vec2 uGlow; uniform float uAspect, uLight; out vec4 o;
  void main(){
    vec2 p = (vUv - uGlow) * vec2(uAspect, 1.0);
    float g = exp(-dot(p, p) * 2.2);
    vec3 col = uBg * 0.9;
    col += vec3(0.016, 0.0145, 0.013) * g;
    if (uLight > 0.5) col = uBg;
    o = vec4(col, 1.0);
  }`;

  const POST_VS = BG_VS;
  const POST_FS = `#version 300 es
  precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform float uTime, uExposure, uVignette, uGrain, uLight; out vec4 o;
  vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
  void main(){
    vec3 c = texture(uTex, vUv).rgb * uExposure;
    if (uLight > 0.5) { c = clamp(c, 0.0, 1.0); vec3 lo = c * 12.92; vec3 hi = 1.055 * pow(c, vec3(1.0/2.4)) - 0.055; c = mix(lo, hi, step(vec3(0.0031308), c)); o = vec4(c, 1.0); return; }
    // gentle lift of shadows toward cool, highlights toward warm
    c = aces(c);
    c = pow(c, vec3(1.0/2.2));
    c += vec3(-0.004, 0.0, 0.012) * (1.0 - c);
    vec2 q = vUv - 0.5;
    float v = 1.0 - uVignette * smoothstep(0.35, 0.95, length(q) * 1.15);
    c *= v;
    c += (hash(vUv * 1024.0) - 0.5) * uGrain;
    o = vec4(c, 1.0);
  }`;

  /* ------------------------------------------------------------------ gl helpers */
  function compile(gl, type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').slice(0, 5).join('\n'));
    return s;
  }
  function program(gl, vs, fs) {
    const p = gl.createProgram(); gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }

  /* ------------------------------------------------------------------ bundle */
  function loadBundle(url, onProgress) {
    return fetch(url).then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const total = +res.headers.get('content-length') || 0;
      const reader = res.body && res.body.getReader ? res.body.getReader() : null;
      if (!reader) return res.arrayBuffer();
      const chunks = []; let got = 0;
      const pump = () => reader.read().then(r => {
        if (r.done) { const all = new Uint8Array(got); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; } return all.buffer; }
        chunks.push(r.value); got += r.value.length; if (onProgress) onProgress(got, total); return pump();
      });
      return pump();
    }).then(buf => {
      const dv = new DataView(buf);
      const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
      if (magic !== 'SMB2') throw new Error('bad bundle');
      const jl = dv.getUint32(4, true);
      const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jl)));
      const bin = 8 + jl;
      for (const p of json.parts) {
        p.posArr = new Uint16Array(buf, bin + p.pos, p.vcount * 3);
        p.nrmArr = new Int8Array(buf, bin + p.nrm, p.vcount * 4);
        p.idxArr = p.itype === 'u16' ? new Uint16Array(buf, bin + p.idx, p.icount) : new Uint32Array(buf, bin + p.idx, p.icount);
        p.center = [(p.min[0] + p.max[0]) / 2, (p.min[1] + p.max[1]) / 2, (p.min[2] + p.max[2]) / 2];
        p.size = [p.max[0] - p.min[0], p.max[1] - p.min[1], p.max[2] - p.min[2]];
      }
      return json;
    });
  }

  /* ------------------------------------------------------------------ stage */
  class Stage {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.opts = Object.assign({ dpr: Math.min(window.devicePixelRatio || 1, 2), msaa: 4, shadowSize: 2048, reflScale: 0.5 }, opts || {});
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!this.opts.preserve });
      if (!gl) throw new Error('WebGL2 unavailable');
      this.gl = gl;
      this.hasFloat = !!gl.getExtension('EXT_color_buffer_float');
      this.parts = [];
      this.bg = this.opts.bg || [0.0045, 0.0050, 0.0068];   // linear; about #141720 after grading
      this.time = 0;
      this.explodeT = 0;          // 0..1 timeline
      this.highlight = {};        // id -> 0..1
      this.ghost = {};            // id -> 0..1
      this.visible = null;        // Set of ids or null for all
      this.cam = { yaw: 0.6, pitch: 0.32, dist: 300, target: [0, 0, 24], fov: 0.40, shiftX: 0, shiftY: 0 };
      this.floorZ = -8.6;
      this.floorFade = 1;
      this.exposure = 1.0;
      this.lights = this.opts.light ? {
        key: { dir: V3.norm([-0.45, -0.62, 0.78]), col: [1.1, 1.06, 1.0] },
        fill: { dir: V3.norm([0.85, 0.25, 0.35]), col: [0.24, 0.26, 0.3] },
        rim: { dir: V3.norm([0.25, 0.9, 0.45]), col: [0.28, 0.32, 0.4] }
      } : {
        key: { dir: V3.norm([-0.45, -0.62, 0.78]), col: [2.5, 2.38, 2.2] },
        fill: { dir: V3.norm([0.85, 0.25, 0.35]), col: [0.42, 0.46, 0.56] },
        rim: { dir: V3.norm([0.25, 0.9, 0.45]), col: [0.9, 1.0, 1.25] }
      };
      this._build();
    }

    _build() {
      const gl = this.gl;
      this.pPbr = program(gl, PBR_VS, PBR_FS);
      this.pDepth = program(gl, DEPTH_VS, DEPTH_FS);
      this.pFloor = program(gl, FLOOR_VS, FLOOR_FS);
      this.pBg = program(gl, BG_VS, BG_FS);
      this.pPost = program(gl, POST_VS, POST_FS);
      this.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      this.quadVao = gl.createVertexArray(); gl.bindVertexArray(this.quadVao);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
      // shadow map
      const S = this.opts.shadowSize;
      this.shadowTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, S, S, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      this.shadowFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
      gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.w = 0; this.h = 0;
    }

    setParts(parts) {
      const gl = this.gl;
      this.parts = parts;
      for (const p of parts) {
        p.vao = gl.createVertexArray(); gl.bindVertexArray(p.vao);
        const vp = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vp); gl.bufferData(gl.ARRAY_BUFFER, p.posArr, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.UNSIGNED_SHORT, true, 0, 0);
        const vn = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vn); gl.bufferData(gl.ARRAY_BUFFER, p.nrmArr, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.BYTE, true, 4, 0);
        const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, p.idxArr, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        p.glType = p.itype === 'u16' ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT;
      }
      // assembled bounds
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (const p of parts) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p.min[i]); mx[i] = Math.max(mx[i], p.max[i]); }
      this.assembledBounds = { mn, mx };
      this.floorZ = mn[2] - 0.25;
    }

    /* per-part explode progress and offsets (lowest part stays on the floor) */
    offsets() {
      const T = this.explodeT;
      const out = {};
      let minDrop = 0;
      for (const p of this.parts) {
        const e = easeInOut((T - p.t0) / p.dur);
        const o = [p.explode[0] * e, p.explode[1] * e, p.explode[2] * e];
        out[p.id] = o;
        minDrop = Math.min(minDrop, o[2]);
      }
      for (const p of this.parts) out[p.id][2] -= minDrop;
      return out;
    }
    bounds(offs) {
      offs = offs || this.offsets();
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (const p of this.parts) {
        if (this.visible && !this.visible.has(p.id)) continue;
        const o = offs[p.id];
        for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p.min[i] + o[i]); mx[i] = Math.max(mx[i], p.max[i] + o[i]); }
      }
      return { mn, mx };
    }

    /* distance so that the current bounds fit the view (fractions of the frame to use) */
    fitDistance(b, fracX, fracY, center) {
      const c = center || [(b.mn[0] + b.mx[0]) / 2, (b.mn[1] + b.mx[1]) / 2, (b.mn[2] + b.mx[2]) / 2];
      const cam = this.cam, aspect = this.w / this.h;
      const tanV = Math.tan(cam.fov / 2), tanH = tanV * aspect;
      const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const f = [cp * Math.cos(cam.yaw), cp * Math.sin(cam.yaw), sp];
      const r = V3.norm(V3.cross([0, 0, 1], f)), u = V3.cross(f, r);
      let need = 0;
      for (let i = 0; i < 8; i++) {
        const d = [(i & 1 ? b.mx[0] : b.mn[0]) - c[0], (i & 2 ? b.mx[1] : b.mn[1]) - c[1], (i & 4 ? b.mx[2] : b.mn[2]) - c[2]];
        const x = V3.dot(d, r), y = V3.dot(d, u), z = V3.dot(d, f);
        need = Math.max(need, z + Math.abs(y) / (tanV * fracY), z + Math.abs(x) / (tanH * fracX));
      }
      return { dist: need, center: c };
    }

    resize(w, h) {
      const gl = this.gl;
      if (w === this.w && h === this.h) return;
      this.w = w; this.h = h;
      this.canvas.width = w; this.canvas.height = h;
      if (this.msaaFbo) { gl.deleteFramebuffer(this.msaaFbo); gl.deleteRenderbuffer(this.msaaCol); gl.deleteRenderbuffer(this.msaaDep); gl.deleteFramebuffer(this.resolveFbo); gl.deleteTexture(this.resolveTex); gl.deleteFramebuffer(this.reflFbo); gl.deleteTexture(this.reflTex); gl.deleteRenderbuffer(this.reflDep); }
      const fmt = this.hasFloat ? gl.RGBA16F : gl.RGBA8;
      const samples = Math.min(this.opts.msaa, gl.getParameter(gl.MAX_SAMPLES));
      this.msaaFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaaFbo);
      this.msaaCol = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.msaaCol);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, fmt, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.msaaCol);
      this.msaaDep = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.msaaDep);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.msaaDep);
      this.resolveFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.resolveFbo);
      this.resolveTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.resolveTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, gl.RGBA, this.hasFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.resolveTex, 0);
      // reflection buffer (half res)
      const rw = Math.max(2, Math.floor(w * this.opts.reflScale)), rh = Math.max(2, Math.floor(h * this.opts.reflScale));
      this.reflW = rw; this.reflH = rh;
      this.reflFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.reflFbo);
      this.reflTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.reflTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, fmt, rw, rh, 0, gl.RGBA, this.hasFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.reflTex, 0);
      this.reflDep = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.reflDep);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, rw, rh);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.reflDep);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    _viewProj() {
      const cam = this.cam;
      const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const eye = [cam.target[0] + cam.dist * cp * Math.cos(cam.yaw), cam.target[1] + cam.dist * cp * Math.sin(cam.yaw), cam.target[2] + cam.dist * sp];
      const view = M4.lookAt(eye, cam.target, [0, 0, 1]);
      const proj = M4.perspective(cam.fov, this.w / this.h, Math.max(1, cam.dist * 0.05), cam.dist * 4 + 600);
      let vp = M4.mul(proj, view);
      vp = M4.mul(M4.translate(cam.shiftX, cam.shiftY, 0), vp);
      return { eye, vp, view, proj };
    }

    _lightVP(b) {
      const L = this.lights.key.dir;
      const c = [(b.mn[0] + b.mx[0]) / 2, (b.mn[1] + b.mx[1]) / 2, (b.mn[2] + b.mx[2]) / 2];
      const r = Math.hypot(b.mx[0] - b.mn[0], b.mx[1] - b.mn[1], b.mx[2] - b.mn[2]) / 2 + 6;
      const eye = V3.add(c, V3.scale(L, r * 3));
      const view = M4.lookAt(eye, c, [0, 0, 1]);
      const proj = M4.ortho(-r * 1.25, r * 1.25, -r * 1.25, r * 1.25, r * 1.2, r * 5);
      return M4.mul(proj, view);
    }

    _drawParts(prog, offs, vp, lightVP, eye, mirror) {
      const gl = this.gl;
      gl.useProgram(prog.p);
      gl.uniformMatrix4fv(prog.u.uVP, false, vp);
      if (prog.u.uLightVP) gl.uniformMatrix4fv(prog.u.uLightVP, false, lightVP);
      if (prog.u.uEye) {
        gl.uniform3fv(prog.u.uEye, eye);
        gl.uniform3fv(prog.u.uKeyDir, this.lights.key.dir); gl.uniform3fv(prog.u.uKeyCol, this.lights.key.col);
        gl.uniform3fv(prog.u.uFillDir, this.lights.fill.dir); gl.uniform3fv(prog.u.uFillCol, this.lights.fill.col);
        gl.uniform3fv(prog.u.uRimDir, this.lights.rim.dir); gl.uniform3fv(prog.u.uRimCol, this.lights.rim.col);
        gl.uniform1i(prog.u.uShadow, 0); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
        gl.uniform2f(prog.u.uShadowTexel, 1 / this.opts.shadowSize, 1 / this.opts.shadowSize);
        gl.uniform3fv(prog.u.uBg, this.bg);
        if (prog.u.uLight) gl.uniform1f(prog.u.uLight, this.opts.light ? 1 : 0);
        gl.uniform1f(prog.u.uMirror, mirror ? 1 : 0);
        gl.uniform1f(prog.u.uFloorZ, this.floorZ);
      }
      for (const p of this.parts) {
        if (this.visible && !this.visible.has(p.id)) continue;
        const o = offs[p.id];
        let model = M4.translate(o[0], o[1], o[2]);
        if (mirror) {
          // reflect across z = floorZ
          const refl = M4.identity(); refl[10] = -1; refl[14] = 2 * this.floorZ;
          model = M4.mul(refl, model);
        }
        gl.uniformMatrix4fv(prog.u.uModel, false, model);
        gl.uniform3fv(prog.u.uMin, p.min); gl.uniform3fv(prog.u.uMax, p.max);
        if (prog.u.uColor) {
          const m = p.mat;
          gl.uniform3fv(prog.u.uColor, m.color);
          gl.uniform3fv(prog.u.uEmissive, m.emissive ? V3.scale(m.emissive, this.ledGlow === undefined ? 1.0 : this.ledGlow) : [0, 0, 0]);
          gl.uniform1f(prog.u.uRough, m.rough); gl.uniform1f(prog.u.uMetal, m.metal);
          gl.uniform1f(prog.u.uGhost, this.ghost[p.id] || 0);
          gl.uniform1f(prog.u.uHighlight, this.highlight[p.id] || 0);
        }
        gl.bindVertexArray(p.vao);
        gl.drawElements(gl.TRIANGLES, p.icount, p.glType, 0);
      }
      gl.bindVertexArray(null);
    }

    render() {
      const gl = this.gl;
      if (!this.parts.length || !this.w) return;
      const offs = this.offsets();
      const b = this.bounds(offs);
      const lightVP = this._lightVP(b);
      const { eye, vp } = this._viewProj();
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.disable(gl.BLEND);

      // 1. shadow pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
      gl.viewport(0, 0, this.opts.shadowSize, this.opts.shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.cullFace(gl.FRONT);
      gl.useProgram(this.pDepth.p);
      gl.uniformMatrix4fv(this.pDepth.u.uLightVP, false, lightVP);
      for (const p of this.parts) {
        if (this.visible && !this.visible.has(p.id)) continue;
        const o = offs[p.id];
        gl.uniformMatrix4fv(this.pDepth.u.uModel, false, M4.translate(o[0], o[1], o[2]));
        gl.uniform3fv(this.pDepth.u.uMin, p.min); gl.uniform3fv(this.pDepth.u.uMax, p.max);
        gl.bindVertexArray(p.vao); gl.drawElements(gl.TRIANGLES, p.icount, p.glType, 0);
      }
      gl.bindVertexArray(null);
      gl.cullFace(gl.BACK);

      // 2. reflection pass (mirrored, front faces become back faces)
      if (this.floorFade > 0.01) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.reflFbo);
        gl.viewport(0, 0, this.reflW, this.reflH);
        gl.clearColor(this.bg[0], this.bg[1], this.bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.cullFace(gl.FRONT);
        this._drawParts(this.pPbr, offs, vp, lightVP, eye, true);
        gl.cullFace(gl.BACK);
      }

      // 3. main pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaaFbo);
      gl.viewport(0, 0, this.w, this.h);
      gl.clearColor(this.bg[0], this.bg[1], this.bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      // background
      gl.depthMask(false);
      gl.useProgram(this.pBg.p); gl.uniform3fv(this.pBg.u.uBg, this.bg); gl.uniform1f(this.pBg.u.uLight, this.opts.light ? 1 : 0);
      const glowP = M4.project(vp, [0, 0, (this.assembledBounds.mn[2] + this.assembledBounds.mx[2]) * 0.5]);
      gl.uniform2f(this.pBg.u.uGlow, glowP[0] * 0.5 + 0.5, glowP[1] * 0.5 + 0.5); gl.uniform1f(this.pBg.u.uAspect, this.w / this.h);
      gl.bindVertexArray(this.quadVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.bindVertexArray(null);
      gl.depthMask(true);
      // floor
      if (this.floorFade > 0.01) {
        gl.useProgram(this.pFloor.p);
        gl.uniformMatrix4fv(this.pFloor.u.uVP, false, vp); gl.uniformMatrix4fv(this.pFloor.u.uLightVP, false, lightVP);
        gl.uniform3f(this.pFloor.u.uC, 0, 0, this.floorZ); gl.uniform1f(this.pFloor.u.uR, 6000);
        gl.uniform3fv(this.pFloor.u.uEye, eye); gl.uniform3fv(this.pFloor.u.uKeyDir, this.lights.key.dir); gl.uniform3fv(this.pFloor.u.uKeyCol, this.lights.key.col);
        gl.uniform3fv(this.pFloor.u.uBg, this.bg); gl.uniform3f(this.pFloor.u.uCenter, 0, 0, this.floorZ);
        gl.uniform1i(this.pFloor.u.uShadow, 0); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
        gl.uniform2f(this.pFloor.u.uShadowTexel, 1 / this.opts.shadowSize, 1 / this.opts.shadowSize);
        gl.uniform1i(this.pFloor.u.uRefl, 1); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.reflTex);
        gl.uniform1f(this.pFloor.u.uReflStrength, 0.55); gl.uniform1f(this.pFloor.u.uPool, 95); gl.uniform1f(this.pFloor.u.uFade, this.floorFade);
        gl.uniform1f(this.pFloor.u.uLight, this.opts.light ? 1 : 0);
        gl.disable(gl.CULL_FACE);
        gl.bindVertexArray(this.quadVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.bindVertexArray(null);
        gl.enable(gl.CULL_FACE);
      }
      // parts
      this._drawParts(this.pPbr, offs, vp, lightVP, eye, false);

      // 4. resolve + post
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msaaFbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.resolveFbo);
      gl.blitFramebuffer(0, 0, this.w, this.h, 0, 0, this.w, this.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.w, this.h);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(this.pPost.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.resolveTex); gl.uniform1i(this.pPost.u.uTex, 0);
      gl.uniform1f(this.pPost.u.uTime, this.time); gl.uniform1f(this.pPost.u.uExposure, this.exposure);
      gl.uniform1f(this.pPost.u.uVignette, 0.55); gl.uniform1f(this.pPost.u.uGrain, 0.018); gl.uniform1f(this.pPost.u.uLight, this.opts.light ? 1 : 0);
      gl.bindVertexArray(this.quadVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.bindVertexArray(null);
      gl.enable(gl.DEPTH_TEST);
    }

    project(p) { const { vp } = this._viewProj(); const r = M4.project(vp, p); return [(r[0] * 0.5 + 0.5) * this.w, (1 - (r[1] * 0.5 + 0.5)) * this.h, r[2]]; }
  }

  global.SM = { Stage, loadBundle, M4, V3, clamp, smooth, easeInOut, easeOut, lerp, spline };
})(window);
