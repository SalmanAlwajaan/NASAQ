/* عرض المنتج الحي داخل نافذة التفاصيل: الجهاز مجمّعاً يلف ببطء، وتقدر تسحبه،
   ولما تختار لوناً يتغير لون الهيكل مباشرة. يعتمد على js/stage.js. */
(function () {
  'use strict';
  var SM = window.SM; if (!SM) return;
  function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function cssBg(el) {
    var s = getComputedStyle(el).backgroundColor;
    var c = document.createElement('canvas').getContext('2d'); c.fillStyle = s; var h = c.fillStyle;
    if (h[0] === '#' && h.length === 7) return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255].map(srgbToLinear);
    return [1, 1, 1];
  }
  var bundles = {};
  function bundle(url) { return bundles[url] || (bundles[url] = SM.loadBundle(url)); }

  window.ProductView = function (host) {
    var canvas = document.createElement('canvas'); host.innerHTML = ''; host.appendChild(canvas);
    var stage;
    try { stage = new SM.Stage(canvas, { light: true, bg: cssBg(host), msaa: 4, shadowSize: 1024, reflScale: 0.5 }); }
    catch (e) { host.classList.add('failed'); return null; }
    var parts = [], running = false, last = 0, yaw = 0, pitch = 0.34, product = null;
    var drag = { on: false, x: 0, y: 0, yaw: 0, pitch: 0, last: -1e9 };
    canvas.addEventListener('pointerdown', function (e) { drag.on = true; drag.x = e.clientX; drag.y = e.clientY; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag.on) return;
      drag.yaw -= (e.clientX - drag.x) * 0.007; drag.pitch = SM.clamp(drag.pitch + (e.clientY - drag.y) * 0.004, -0.3, 0.5);
      drag.x = e.clientX; drag.y = e.clientY; drag.last = performance.now();
    });
    canvas.addEventListener('pointerup', function () { drag.on = false; });
    canvas.addEventListener('pointercancel', function () { drag.on = false; });

    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.1, (now - last) / 1000 || 0.016); last = now;
      if (!drag.on && now - drag.last > 2000) { drag.yaw *= Math.exp(-dt * 0.8); drag.pitch *= Math.exp(-dt * 0.8); }
      // انتقال ناعم بين ألوان الطقم
      var k = 1 - Math.exp(-dt * 7);
      parts.forEach(function (q) { if (q.target) { var m = q.mat.color; for (var i = 0; i < 3; i++) m[i] += (q.target[i] - m[i]) * k; } });
      yaw += dt * 0.35;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      stage.resize(Math.floor(canvas.clientWidth * dpr), Math.floor(canvas.clientHeight * dpr));
      stage.explodeT = 0;
      stage.cam.yaw = yaw + drag.yaw; stage.cam.pitch = pitch + drag.pitch; stage.cam.shiftX = 0; stage.cam.shiftY = 0.04;
      var b = stage.bounds();
      var fit = stage.fitDistance(b, 0.8, 0.8);
      stage.cam.dist = fit.dist; stage.cam.target = fit.center;
      stage.time = now * 0.001; stage.exposure = 1; stage.floorFade = 1;
      stage.render();
      requestAnimationFrame(frame);
    }
    var api = {
      show: function (p) {
        product = p; yaw = p.yaw || 0.3; stage.bg = cssBg(host);
        bundle(p.bundle).then(function (json) {
          // بدون قطعة الإضاءة (LED) في معاينة المتجر
          parts = json.parts.filter(function (q) { return q.id !== 'leds'; })
            .map(function (q) { return Object.assign({}, q, { mat: Object.assign({}, q.mat, { color: q.mat.color.slice() }) }); });
          stage.setParts(parts);
          if (api.color) api.setColor(api.color);
          if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
        }).catch(function () { host.classList.add('failed'); });
      },
      /* تغيير اللون: طقم كامل، الهيكل والمقبض والمفاتيح معاً، والانتقال تدريجي */
      setColor: function (name) {
        api.color = name;
        var c = window.PRODUCT_COLORS[name]; if (!c || !product) return;
        var groups = product.colorGroups || {};
        Object.keys(groups).forEach(function (g) {
          groups[g].forEach(function (id) {
            parts.forEach(function (q) { if (q.id === id) { q.target = c[g];  } });
          });
        });
      },
      stop: function () { running = false; },
      retheme: function () { stage.bg = cssBg(host); }
    };
    return api;
  };
})();
