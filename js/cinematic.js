/* العرض السينمائي: نفس توقيت الفيلم (تجميع، تفكيك تدريجي، ثبات، تجميع) يتكرر بلا توقف،
   على خلفية الصفحة بدون إطار. كل عنصر .stage في الصفحة يصير مشهداً مستقلاً.
   <div class="stage" data-bundle="assets/parts.wasm" data-yaw="0.3"><canvas></canvas><div class="copy">..</div></div>
   النص (.copy) داخل المشهد نفسه ويتحرك مع التفكيك: المتغير --t على العنصر يساوي درجة التفكيك (0 إلى 1)،
   والكاميرا تزيح الجهاز لليسار بنفس المقدار عشان يصير الاسم والجهاز جنب بعض. */
(function () {
  'use strict';
  var SM = window.SM;
  if (!SM) return;
  var clamp = SM.clamp, easeInOut = SM.easeInOut, easeOut = SM.easeOut, lerp = SM.lerp, spline = SM.spline;

  var CAM_KEYS = [
    { t: 0.00, v: [0.00, 0.30, 1.00, 0.50] },
    { t: 0.25, v: [0.35, 0.22, 1.02, 0.62] },
    { t: 0.55, v: [0.85, 0.16, 1.06, 0.52] },
    { t: 0.80, v: [1.25, 0.22, 1.08, 0.46] },
    { t: 1.00, v: [1.60, 0.30, 1.10, 0.50] }
  ];
  var FILM_SECONDS = 25;
  var SPEED = 1.25;   // سرعة تشغيل الفيلم (1 = التوقيت الأصلي 25 ثانية)
  // 0-3.5 مجمّع مع اقتراب، 3.5-15.5 تفكيك، 15.5-19.5 ثبات، 19.5-23.5 تجميع، 23.5-25 مجمّع
  function filmState(s) {
    var T = 0, yaw = 0.35, pitch = 0.3, dm = 1.0, tzw = 0.5, fx = 0.78, fy = 0.80, p, k;
    if (s < 3.5) { p = s / 3.5; T = 0; yaw = 0.25 + 0.25 * p; pitch = 0.36 - 0.08 * p; dm = lerp(1.25, 1.0, easeOut(p)); }
    else if (s < 15.5) { p = (s - 3.5) / 12; T = easeInOut(p); k = spline(CAM_KEYS, T); yaw = 0.5 + k[0] * 0.9; pitch = k[1]; dm = k[2] * lerp(1.0, 0.84, T); tzw = k[3]; fx = 0.85; fy = 0.94; }
    else if (s < 19.5) { p = (s - 15.5) / 4; T = 1; k = spline(CAM_KEYS, 1); yaw = 0.5 + k[0] * 0.9 + p * 0.35; pitch = k[1] + 0.04 * p; dm = k[2] * 0.84; tzw = k[3]; fx = 0.85; fy = 0.94; }
    else if (s < 23.5) { p = easeInOut((s - 19.5) / 4); T = 1 - p; k = spline(CAM_KEYS, T); yaw = 0.5 + 1.6 * 0.9 + 0.35 + p * 0.5; pitch = lerp(k[1] + 0.04, 0.3, p); dm = lerp(k[2] * 0.84, 1.0, p); tzw = k[3]; fx = lerp(0.85, 0.78, p); fy = lerp(0.94, 0.80, p); }
    else { p = (s - 23.5) / 1.5; T = 0; yaw = 0.5 + 1.6 * 0.9 + 0.85 + p * 0.12; pitch = 0.3; dm = 1.0; }
    return { T: T, yaw: yaw, pitch: pitch, dm: dm, tzw: tzw, fx: fx, fy: fy };
  }

  function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function cssBg(el) {
    var s = getComputedStyle(el).getPropertyValue('--stage-bg').trim() || getComputedStyle(document.body).backgroundColor;
    var c = document.createElement('canvas').getContext('2d'); c.fillStyle = s; var h = c.fillStyle;
    if (h[0] === '#' && h.length === 7) return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255].map(srgbToLinear);
    return [0.88, 0.96, 0.86];
  }

  var bundles = {};
  function bundle(url) { return bundles[url] || (bundles[url] = SM.loadBundle(url)); }

  function Cinema(root, index) {
    var canvas = root.querySelector('canvas');
    var yawOff = +(root.getAttribute('data-yaw') || 0);
    var dir = +(root.getAttribute('data-dir') || 1);
    var still = root.hasAttribute('data-still');
    var stage;
    try { stage = new SM.Stage(canvas, { light: true, bg: cssBg(root), msaa: 4, shadowSize: 1024, reflScale: 0.5, preserve: still }); }
    catch (e) { root.classList.add('failed'); return; }
    var parts = [], running = false, visible = true, lastFrame = 0, t = 0;
    var drag = { on: false, x: 0, y: 0, yaw: 0, pitch: 0, last: -1e9 };
    var sm = { yaw: 0, pitch: 0.3, dist: 400, tz: 24 };
    var scale = 1, slow = 0, lastT = -1, layout = { shift: 0, fitx: 1 };
    function readLayout() {
      var cs = getComputedStyle(root);
      layout.shift = parseFloat(cs.getPropertyValue('--shift')) || 0;   // إزاحة الجهاز عند التفكيك (وحدات الشاشة، 0.3 = 15% من العرض)
      layout.fitx = parseFloat(cs.getPropertyValue('--fitx')) || 1;     // نسبة العرض المتاحة للجهاز عند التفكيك
      layout.fity = parseFloat(cs.getPropertyValue('--fity')) || 1;     // نسبة الارتفاع المتاحة عند التفكيك (الجوال أقل لأن النص فوق)
      layout.shifty = parseFloat(cs.getPropertyValue('--shifty')) || 0; // إزاحة رأسية عند التفكيك (الجوال: الجهاز ينزل تحت النص)
    }
    readLayout();
    window.addEventListener('resize', readLayout);

    canvas.addEventListener('pointerdown', function (e) { drag.on = true; drag.x = e.clientX; drag.y = e.clientY; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag.on) return;
      drag.yaw -= (e.clientX - drag.x) * 0.006; drag.pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.004, -0.4, 0.5);
      drag.x = e.clientX; drag.y = e.clientY; drag.last = performance.now();
    });
    canvas.addEventListener('pointerup', function () { drag.on = false; });
    canvas.addEventListener('pointercancel', function () { drag.on = false; });

    function apply(s, k) {
      var st = filmState(s);
      stage.explodeT = st.T;
      var wantYaw = yawOff + st.yaw * dir + drag.yaw, wantPitch = st.pitch + drag.pitch;
      sm.yaw += (wantYaw - sm.yaw) * k; sm.pitch += (wantPitch - sm.pitch) * k;
      var T = st.T;
      // الاسم يروح يمين (RTL) والجهاز يروح يسار: الإزاحة تسبق التفكيك شوي عشان ما يتداخلان
      var tc = easeInOut(clamp(T * 1.6, 0, 1));
      stage.cam.yaw = sm.yaw; stage.cam.pitch = sm.pitch; stage.cam.shiftX = -layout.shift * tc; stage.cam.shiftY = still ? 0.02 : lerp(-0.26, -0.04 + layout.shifty, tc);
      if (Math.abs(tc - lastT) > 0.002) { lastT = tc; root.style.setProperty('--t', tc.toFixed(3)); }
      var b = stage.bounds();
      var tz = lerp(b.mn[2], b.mx[2], st.tzw);
      var fit = stage.fitDistance(b, st.fx * lerp(1, layout.fitx, tc), st.fy * (still ? 1.1 : lerp(0.64, 0.86 * layout.fity, tc)), [0, 0, tz]);
      sm.dist += (fit.dist * st.dm - sm.dist) * k; sm.tz += (tz - sm.tz) * k;
      stage.cam.dist = sm.dist; stage.cam.target = [0, 0, sm.tz];
      stage.time = s; stage.exposure = 1; stage.floorFade = 1;
    }
    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.1, (now - lastFrame) / 1000 || 0.016); lastFrame = now;
      if (visible && !document.hidden) {
        t = (t + dt * SPEED) % FILM_SECONDS; root.__t = t;
        if (!drag.on && performance.now() - drag.last > 2500) { drag.yaw *= Math.exp(-dt * 0.8); drag.pitch *= Math.exp(-dt * 0.8); }
        var dpr = Math.min(window.devicePixelRatio || 1, 1.75) * scale;
        stage.resize(Math.floor(canvas.clientWidth * dpr), Math.floor(canvas.clientHeight * dpr));
        apply(t, 1 - Math.exp(-dt * 6));
        var r0 = performance.now(); stage.render(); var rt = performance.now() - r0;
        if (rt > 45) { if (++slow > 2 && scale > 0.45) { scale = Math.max(0.45, scale - 0.2); slow = 0; } }
        else if (rt < 14 && scale < 1) { if (--slow < -90) { scale = Math.min(1, scale + 0.2); slow = 0; } }
      }
      requestAnimationFrame(frame);
    }
    try { new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { rootMargin: '80px' }).observe(root); } catch (e) {}
    document.addEventListener('themechange', function () { setTimeout(function () { stage.bg = cssBg(root); }, 60); });

    bundle(root.getAttribute('data-bundle') || 'assets/parts.wasm').then(function (json) {
      parts = json.parts.map(function (p) { return Object.assign({}, p); });
      stage.setParts(parts);
      root.classList.add('ready');
      if (still) {
        var s0 = +(root.getAttribute('data-time') || 1.5);
        var dpr = 1; stage.resize(Math.floor(canvas.clientWidth * dpr), Math.floor(canvas.clientHeight * dpr));
        sm.yaw = yawOff + filmState(s0).yaw * dir; sm.pitch = filmState(s0).pitch;
        apply(s0, 1); apply(s0, 1); stage.render(); apply(s0, 1); stage.render();
        root.setAttribute('data-ready', '1'); return;
      }
      t = index * 6.5 % FILM_SECONDS;  // المشهد الثاني يبدأ من نقطة مختلفة عشان ما يتطابقان
      try { var f0 = new URLSearchParams(location.search).get('film'); if (f0 !== null) t = +f0 % FILM_SECONDS; } catch (e) {}  // للمعاينة: ?film=12 يبدأ من الثانية 12
      sm.yaw = yawOff + filmState(t).yaw * dir; sm.pitch = filmState(t).pitch;
      if (f0 !== null) { stage.resize(Math.floor(canvas.clientWidth), Math.floor(canvas.clientHeight)); apply(t, 1); apply(t, 1); }
      running = true; lastFrame = performance.now();
      requestAnimationFrame(frame);
    }).catch(function (err) { root.classList.add('failed'); root.setAttribute('data-error', err.message); });
  }

  document.querySelectorAll('.stage').forEach(function (el, i) { new Cinema(el, i); });
})();
