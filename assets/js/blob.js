/* The home page blob: a noise-displaced sphere drawn with plain WebGL.
   It drifts and turns on its own, leans toward the cursor, squashes when
   pressed, stretches toward the pointer when dragged, and wobbles back.
   Hovering a nav button nudges its shape and hue. No library needed. */
(function () {
  var VERT = [
    'attribute vec3 aPos;',
    'uniform mat3 uRot;',
    'uniform float uTime, uAmp, uFreq, uSquash;',
    'uniform vec3 uPull, uGrab;',
    'varying vec3 vN;',
    'varying vec3 vV;',
    'varying float vH;',
    'vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }',
    'vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }',
    'vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }',
    'vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }',
    'float snoise(vec3 v) {',
    '  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);',
    '  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);',
    '  vec3 i = floor(v + dot(v, C.yyy));',
    '  vec3 x0 = v - i + dot(i, C.xxx);',
    '  vec3 g = step(x0.yzx, x0.xyz);',
    '  vec3 l = 1.0 - g;',
    '  vec3 i1 = min(g.xyz, l.zxy);',
    '  vec3 i2 = max(g.xyz, l.zxy);',
    '  vec3 x1 = x0 - i1 + C.xxx;',
    '  vec3 x2 = x0 - i2 + C.yyy;',
    '  vec3 x3 = x0 - D.yyy;',
    '  i = mod289(i);',
    '  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));',
    '  float n_ = 0.142857142857;',
    '  vec3 ns = n_ * D.wyz - D.xzx;',
    '  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);',
    '  vec4 x_ = floor(j * ns.z);',
    '  vec4 y_ = floor(j - 7.0 * x_);',
    '  vec4 x = x_ * ns.x + ns.yyyy;',
    '  vec4 y = y_ * ns.x + ns.yyyy;',
    '  vec4 h = 1.0 - abs(x) - abs(y);',
    '  vec4 b0 = vec4(x.xy, y.xy);',
    '  vec4 b1 = vec4(x.zw, y.zw);',
    '  vec4 s0 = floor(b0) * 2.0 + 1.0;',
    '  vec4 s1 = floor(b1) * 2.0 + 1.0;',
    '  vec4 sh = -step(h, vec4(0.0));',
    '  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;',
    '  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;',
    '  vec3 p0 = vec3(a0.xy, h.x);',
    '  vec3 p1 = vec3(a0.zw, h.y);',
    '  vec3 p2 = vec3(a1.xy, h.z);',
    '  vec3 p3 = vec3(a1.zw, h.w);',
    '  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));',
    '  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;',
    '  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);',
    '  m = m * m;',
    '  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));',
    '}',
    'float field(vec3 p) {',
    '  vec3 q = p * uFreq;',
    '  return 0.86 * snoise(q + vec3(0.0, 0.0, uTime * 0.35)) + 0.14 * snoise(q * 2.0 + vec3(uTime * 0.5, 3.1, 0.0));',
    '}',
    'vec3 surf(vec3 n) { return n * (1.0 + uAmp * field(n)); }',
    'vec3 deform(vec3 n) {',
    '  vec3 p = uRot * surf(n);',
    '  p.y *= 1.0 - uSquash;',
    '  p.xz *= 1.0 + 0.5 * uSquash;',
    '  float w = pow(max(dot(normalize(p), uGrab), 0.0), 2.5);',
    '  return p + uPull * (0.12 + 0.88 * w);',
    '}',
    'void main() {',
    '  vec3 n = normalize(aPos);',
    '  vec3 up = abs(n.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);',
    '  vec3 t = normalize(cross(n, up));',
    '  vec3 b = cross(n, t);',
    '  float e = 0.012;',
    '  vec3 p0 = deform(n);',
    '  vec3 p1 = deform(normalize(n + t * e));',
    '  vec3 p2 = deform(normalize(n + b * e));',
    '  vec3 vp = p0 + vec3(0.0, 0.0, -4.6);',
    '  vN = normalize(cross(p1 - p0, p2 - p0));',
    '  vV = vp;',
    '  vH = field(n);',
    '  float f = 2.2654;',
    '  float near = 0.1, far = 20.0;',
    '  gl_Position = vec4(vp.x * f, vp.y * f, (far + near) / (near - far) * vp.z + 2.0 * far * near / (near - far), -vp.z);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform float uHue, uTime;',
    'varying vec3 vN;',
    'varying vec3 vV;',
    'varying float vH;',
    '// A loop of seven colors: pink, magenta, violet, blue, cyan, yellow, peach.',
    'vec3 palette(float t) {',
    '  float x = fract(t) * 7.0;',
    '  vec3 c = vec3(0.98, 0.39, 0.62);',
    '  c = mix(c, vec3(0.86, 0.14, 0.64), smoothstep(0.0, 1.0, x));',
    '  c = mix(c, vec3(0.52, 0.24, 0.92), smoothstep(1.0, 2.0, x));',
    '  c = mix(c, vec3(0.18, 0.45, 0.95), smoothstep(2.0, 3.0, x));',
    '  c = mix(c, vec3(0.40, 0.86, 0.82), smoothstep(3.0, 4.0, x));',
    '  c = mix(c, vec3(0.97, 0.88, 0.42), smoothstep(4.0, 5.0, x));',
    '  c = mix(c, vec3(1.00, 0.66, 0.44), smoothstep(5.0, 6.0, x));',
    '  c = mix(c, vec3(0.98, 0.39, 0.62), smoothstep(6.0, 7.0, x));',
    '  return c;',
    '}',
    'void main() {',
    '  vec3 N = normalize(vN);',
    '  vec3 V = normalize(-vV);',
    '  float ndv = max(dot(N, V), 0.0);',
    '  float fres = pow(1.0 - ndv, 2.2);',
    '  float t = uHue + 1.06 + vH * 0.3 + fres * 0.4 + N.y * 0.22 + N.x * 0.1 + uTime * 0.012;',
    '  vec3 base = palette(t);',
    '  vec3 L1 = normalize(vec3(-0.5, 0.8, 0.6));',
    '  vec3 L2 = normalize(vec3(0.7, -0.2, 0.5));',
    '  float wrap = 0.5 + 0.5 * dot(N, L1);',
    '  vec3 col = base * (0.56 + 0.5 * wrap);',
    '  col += palette(t + 0.35) * 0.18 * max(dot(N, L2), 0.0);',
    '  float s1 = pow(max(dot(N, normalize(L1 + V)), 0.0), 70.0);',
    '  float s2 = pow(max(dot(N, normalize(L2 + V)), 0.0), 24.0);',
    '  col += vec3(1.0) * s1 * 0.75 + vec3(1.0) * s2 * 0.12;',
    '  col = mix(col, vec3(1.0), fres * 0.22);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var canvas = document.getElementById('blob');
  var stage = document.getElementById('stage');
  var grabEl = document.getElementById('grab');
  if (!canvas || !stage || !grabEl) return;

  function fallback() { stage.classList.add('no-gl'); document.documentElement.classList.add('no-blob'); }

  var gl = null;
  try { gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }); } catch (e) { gl = null; }
  if (!gl) { fallback(); return; }

  function compile(type, source) {
    var s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.log('[blob] ' + gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { fallback(); return; }
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { fallback(); return; }
  gl.useProgram(prog);

  // Icosphere: detail 6 on larger screens, 5 on small ones.
  function icosphere(detail) {
    var t = (1 + Math.sqrt(5)) / 2;
    var v = [-1,t,0, 1,t,0, -1,-t,0, 1,-t,0, 0,-1,t, 0,1,t, 0,-1,-t, 0,1,-t, t,0,-1, t,0,1, -t,0,-1, -t,0,1];
    var f = [0,11,5, 0,5,1, 0,1,7, 0,7,10, 0,10,11, 1,5,9, 5,11,4, 11,10,2, 10,7,6, 7,1,8, 3,9,4, 3,4,2, 3,2,6, 3,6,8, 3,8,9, 4,9,5, 2,4,11, 6,2,10, 8,6,7, 9,8,1];
    function norm(i) { var x = v[i*3], y = v[i*3+1], z = v[i*3+2], l = Math.sqrt(x*x + y*y + z*z); v[i*3] = x/l; v[i*3+1] = y/l; v[i*3+2] = z/l; }
    for (var i = 0; i < 12; i++) norm(i);
    for (var d = 0; d < detail; d++) {
      var cache = {}, nf = [];
      var mid = function (a, b) {
        var key = a < b ? a + '_' + b : b + '_' + a;
        if (cache[key] !== undefined) return cache[key];
        var idx = v.length / 3;
        v.push((v[a*3] + v[b*3]) / 2, (v[a*3+1] + v[b*3+1]) / 2, (v[a*3+2] + v[b*3+2]) / 2);
        norm(idx); cache[key] = idx; return idx;
      };
      for (var k = 0; k < f.length; k += 3) {
        var a = f[k], b = f[k+1], c = f[k+2], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
        nf.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
      }
      f = nf;
    }
    return { v: new Float32Array(v), f: new Uint16Array(f) };
  }
  var small = Math.min(window.innerWidth, window.innerHeight) < 700;
  var mesh = icosphere(small ? 5 : 6);
  var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, mesh.v, gl.STATIC_DRAW);
  var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.f, gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
  var U = {};
  ['uRot', 'uTime', 'uAmp', 'uFreq', 'uSquash', 'uPull', 'uGrab', 'uHue'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.clearColor(0, 0, 0, 0);

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Each nav button gives the blob a slightly different shape and hue while hovered.
  var moods = {
    rest:     { hue: 0.00, amp: 0.30, freq: 0.95 },
    resume:   { hue: 0.10, amp: 0.22, freq: 0.85 },
    projects: { hue: -0.12, amp: 0.34, freq: 1.08 },
    blog:     { hue: 0.22, amp: 0.24, freq: 1.18 },
    notes:    { hue: -0.22, amp: 0.27, freq: 1.02 },
    contact:  { hue: 0.34, amp: 0.26, freq: 0.92 }
  };
  var target = moods.rest, cur = { hue: 0, amp: 0.30, freq: 0.95 };
  var energy = 0;
  var yaw = 0.4, pitch = 0.15, vyaw = 0, vpitch = 0, tiltX = 0, tiltY = 0, tx = 0, ty = 0;
  var time = 0, last = 0, visible = true, running = false;
  var sq = 0, sqv = 0, sqT = 0, pull = [0, 0], pv = [0, 0], pT = [0, 0], grab = [0, 0, 1], held = false, downW = [0, 0];
  var bob = 0;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    if (canvas.width !== w) { canvas.width = w; canvas.height = w; }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  function draw() {
    resize();
    var y = yaw + tiltX, p = pitch + tiltY;
    var cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p);
    // Rx(p) * Ry(y), column-major
    gl.uniformMatrix3fv(U.uRot, false, [cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy]);
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uAmp, cur.amp + energy * 0.12);
    gl.uniform1f(U.uFreq, cur.freq);
    gl.uniform1f(U.uSquash, sq);
    // A slow vertical bob makes it float; pulls ride on top of it.
    gl.uniform3f(U.uPull, pull[0], pull[1] + bob, 0.25 * Math.sqrt(pull[0] * pull[0] + pull[1] * pull[1]));
    gl.uniform3f(U.uGrab, grab[0], grab[1], grab[2]);
    gl.uniform1f(U.uHue, cur.hue);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, mesh.f.length, gl.UNSIGNED_SHORT, 0);
  }
  function step(dt) {
    var k = 1 - Math.pow(0.02, dt);
    cur.hue += (target.hue - cur.hue) * k;
    cur.amp += (target.amp - cur.amp) * k;
    cur.freq += (target.freq - cur.freq) * k;
    tiltX += (tx - tiltX) * k; tiltY += (ty - tiltY) * k;
    yaw += vyaw + (reduced ? 0 : dt * 0.12); pitch += vpitch; vyaw *= 0.94; vpitch *= 0.94;
    // Jelly springs: squash and pull overshoot and wobble back.
    sqv += (-140 * (sq - sqT) - 8 * sqv) * dt; sq += sqv * dt;
    sq = Math.max(-0.45, Math.min(0.45, sq));
    for (var i = 0; i < 2; i++) { pv[i] += (-140 * (pull[i] - pT[i]) - 8 * pv[i]) * dt; pull[i] += pv[i] * dt; }
    pitch = Math.max(-1.2, Math.min(1.2, pitch));
    energy *= Math.pow(0.15, dt);
    if (!reduced) { time += dt * (1 + energy * 1.5); bob = 0.045 * Math.sin(time * 0.9); }
  }
  function frame(now) {
    if (!visible || document.hidden) { running = false; return; }
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    step(dt); draw();
    requestAnimationFrame(frame);
  }
  function wake() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }

  // Pause when the blob is off screen or the tab is hidden.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) wake(); }).observe(canvas);
  }
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('resize', wake);

  // Pointer: lean toward the cursor, press to squeeze, drag to pull.
  function toWorld(e) {
    var r = canvas.getBoundingClientRect();
    var u = 2 * (4.6 / 2.2654) / r.height;
    return [(e.clientX - (r.left + r.width / 2)) * u, -(e.clientY - (r.top + r.height / 2)) * u];
  }
  window.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect();
    var nx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
    var ny = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
    tx = Math.max(-0.5, Math.min(0.5, nx * 0.9)); ty = Math.max(-0.4, Math.min(0.4, ny * 0.7));
    if (held) {
      var w = toWorld(e), dx = w[0] - downW[0], dy = w[1] - downW[1];
      var len = Math.sqrt(dx * dx + dy * dy);
      var k = len > 0 ? 1.1 * Math.tanh(len / 1.1) / len : 0;
      pT = [dx * k, dy * k];
      var far = Math.min(1, len);
      sqT = 0.2 * (1 - far) - 0.1 * far;
      energy = Math.min(1, energy + len * 0.02);
    }
  }, { passive: true });
  grabEl.addEventListener('pointerdown', function (e) {
    held = true; downW = toWorld(e);
    var gx = downW[0] / 1.3, gy = downW[1] / 1.3, l = Math.sqrt(gx * gx + gy * gy);
    if (l > 0.95) { gx *= 0.95 / l; gy *= 0.95 / l; l = 0.95; }
    grab = [gx, gy, Math.sqrt(1 - l * l)];
    pT = [0, 0]; sqT = 0.2;
    grabEl.classList.add('dragging');
    try { grabEl.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
    wake();
  });
  function release() { if (!held) return; held = false; pT = [0, 0]; sqT = 0; grabEl.classList.remove('dragging'); }
  grabEl.addEventListener('pointerup', release);
  grabEl.addEventListener('pointercancel', release);
  window.addEventListener('blur', release);
  grabEl.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { vyaw = -0.05; } else if (e.key === 'ArrowRight') { vyaw = 0.05; }
    else if (e.key === 'ArrowUp') { vpitch = -0.05; e.preventDefault(); } else if (e.key === 'ArrowDown') { vpitch = 0.05; e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { sqv += 5; e.preventDefault(); }
  });

  // Nav buttons change the blob's mood while hovered or focused.
  Array.prototype.forEach.call(document.querySelectorAll('[data-mood]'), function (a) {
    var m = moods[a.getAttribute('data-mood')];
    if (!m) return;
    a.addEventListener('pointerenter', function () { target = m; });
    a.addEventListener('focus', function () { target = m; });
    a.addEventListener('pointerleave', function () { target = moods.rest; });
    a.addEventListener('blur', function () { target = moods.rest; });
  });

  // Test hook: lets a script advance and redraw the blob deterministically.
  window.__blob = { draw: draw, step: step, state: function () { return { sq: sq, pull: pull.slice(), held: held }; } };
  wake();
})();
