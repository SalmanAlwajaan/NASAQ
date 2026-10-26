/* عرض مجالات الاستخدام: 10 شرائح بعرض الشاشة، كل شريحة 5 ثوانٍ.
   كل شريحة: رسمة خطية متحركة في الخلفية (بلون الموقع)، وفوقها إطار نافذة فيه الصورة img/slides/NN.jpg،
   والعنوان في الزاوية. الصورة تظهر كما هي داخل الإطار، فما تحتاج أي تصميم مسبق. */
(function () {
  'use strict';
  var SLIDES_AR = [
    { t: 'نمذجة ثلاثية الأبعاد', s: 'تدور حول المجسم وتدخل في تفاصيله بحركة يد وحدة.', app: 'Modeling' },
    { t: 'شخصيات الألعاب', s: 'تحريك الكاميرا داخل المشهد وأنت تبني الشخصية وتختبرها.', app: 'Game asset' },
    { t: 'التكييف والسباكة', s: 'تتبع المواسير والمجاري بين الطوابق بدون ما تضيع في المقاطع.', app: 'BIM' },
    { t: 'تصميم الشخصيات', s: 'من الرسمة الأولى إلى النحت الرقمي، بيد على المقبض ويد على القلم.', app: 'Character' },
    { t: 'العمارة والمدن', s: 'تطلع فوق المبنى وتنزل داخله في ثوانٍ.', app: 'Interior' },
    { t: 'تصميم المنتجات', s: 'تفحص كل زاوية وكل حافة قبل ما تروح للطابعة.', app: 'Product' },
    { t: 'الآلات والمحركات', s: 'تفكك المحرك قطعة قطعة وتدور داخله.', app: 'Assembly' },
    { t: 'الرسوم المتحركة', s: 'كاميرا تلف حول الشخصية بسلاسة وأنت تضبط كل إطار.', app: 'Animation' },
    { t: 'لوحات الإلكترونيات', s: 'تقلّب اللوحة وتتأكد من كل عنصر في مكانه.', app: 'KiCad' },
    { t: 'الألعاب والمحاكاة', s: 'تطير فوق العالم اللي تبنيه كأنك داخله.', app: 'Godot' }
  ];
  var SLIDES_EN = [
    { t: '3D modeling', s: 'Orbit the model and dive into its details with one hand motion.', app: 'Modeling' },
    { t: 'Game characters', s: 'Move the camera through the scene while you build and test the character.', app: 'Game asset' },
    { t: 'HVAC and plumbing', s: 'Follow ducts and pipes between floors without getting lost in sections.', app: 'BIM' },
    { t: 'Character design', s: 'From the first sketch to digital sculpting, one hand on the knob, one on the pen.', app: 'Character' },
    { t: 'Architecture and cities', s: 'Fly over the building and step inside it in seconds.', app: 'Interior' },
    { t: 'Product design', s: 'Inspect every angle and every edge before it goes to the printer.', app: 'Product' },
    { t: 'Machines and engines', s: 'Take the engine apart piece by piece and orbit inside it.', app: 'Assembly' },
    { t: 'Animation', s: 'A camera that glides around the character while you set every frame.', app: 'Animation' },
    { t: 'Electronics boards', s: 'Flip the board and check every component in its place.', app: 'KiCad' },
    { t: 'Games and simulation', s: 'Fly over the world you are building as if you were inside it.', app: 'Godot' }
  ];
  function SL() { return window.I18N && window.I18N.lang === 'en' ? SLIDES_EN : SLIDES_AR; }
  var SLIDES = SL();

  var INK = 'currentColor';

  /* رسومات متحركة لكل مجال (SVG) */
  function art(i) {
    var W = 1600, H = 900, g = '';
    switch (i) {
      case 0: // مكعبات أيزومترية
        for (var r = 0; r < 5; r++) for (var c = 0; c < 9; c++) {
          var x = 100 + c * 180 + (r % 2) * 90, y = 120 + r * 160, s = 60;
          g += '<g transform="translate(' + x + ' ' + y + ')" opacity="' + (0.25 + 0.08 * ((r + c) % 4)) + '"><path d="M0 -' + s + ' L' + (s * 0.87) + ' -' + (s / 2) + ' L' + (s * 0.87) + ' ' + (s / 2) + ' L0 ' + s + ' L-' + (s * 0.87) + ' ' + (s / 2) + ' L-' + (s * 0.87) + ' -' + (s / 2) + 'Z M0 -' + s + ' L0 0 L' + (s * 0.87) + ' ' + (s / 2) + ' M0 0 L-' + (s * 0.87) + ' ' + (s / 2) + '" fill="none" stroke="' + INK + '" stroke-width="3"/></g>';
        }
        return wrap(g, 'drift');
      case 1: // هيكل تحريك (نقاط وعظام)
        var J = [[800, 160], [800, 300], [800, 470], [680, 330], [920, 330], [600, 470], [1000, 470], [740, 640], [860, 640], [720, 820], [880, 820]];
        var B = [[0, 1], [1, 2], [1, 3], [1, 4], [3, 5], [4, 6], [2, 7], [2, 8], [7, 9], [8, 10]];
        B.forEach(function (b) { g += '<line x1="' + J[b[0]][0] + '" y1="' + J[b[0]][1] + '" x2="' + J[b[1]][0] + '" y2="' + J[b[1]][1] + '" stroke="' + INK + '" stroke-width="10" stroke-linecap="round" opacity=".55"/>'; });
        J.forEach(function (j, k) { g += '<circle cx="' + j[0] + '" cy="' + j[1] + '" r="' + (k === 0 ? 46 : 20) + '" fill="none" stroke="' + INK + '" stroke-width="6" opacity=".8"/>'; });
        for (var k2 = 0; k2 < 12; k2++) g += '<circle cx="' + (120 + k2 * 125) + '" cy="860" r="6" fill="' + INK + '" opacity=".5"/>';
        return wrap(g, 'sway');
      case 2: // شبكة مواسير
        var P = ['M100 200 H600 V500 H1100 V250 H1500', 'M200 800 V450 H450 V150', 'M1300 850 V600 H900 V700 H700', 'M1500 700 H1250 V400 H1050'];
        P.forEach(function (d, k) { g += '<path d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="' + (26 - k * 4) + '" stroke-linejoin="round" stroke-linecap="round" opacity="' + (0.55 - k * 0.08) + '"/>'; });
        [[600, 500], [1100, 250], [450, 150], [900, 700], [1250, 400]].forEach(function (p) { g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="30" fill="none" stroke="' + INK + '" stroke-width="8" opacity=".7"/>'; });
        return wrap(g, 'drift');
      case 3: // خطوط كنتور
        for (var n = 0; n < 9; n++) { var rx = 120 + n * 70, ry = 70 + n * 45; g += '<ellipse cx="800" cy="450" rx="' + rx + '" ry="' + ry + '" fill="none" stroke="' + INK + '" stroke-width="4" opacity="' + (0.7 - n * 0.06) + '" transform="rotate(' + (n * 7 - 25) + ' 800 450)"/>'; }
        return wrap(g, 'spin');
      case 4: // واجهات مبانٍ
        for (var b2 = 0; b2 < 7; b2++) { var bx = 60 + b2 * 220, bh = 300 + ((b2 * 137) % 400), bw = 170; g += '<rect x="' + bx + '" y="' + (880 - bh) + '" width="' + bw + '" height="' + bh + '" fill="none" stroke="' + INK + '" stroke-width="5" opacity=".7"/>'; for (var f = 1; f < bh / 60; f++) g += '<line x1="' + bx + '" y1="' + (880 - f * 60) + '" x2="' + (bx + bw) + '" y2="' + (880 - f * 60) + '" stroke="' + INK + '" stroke-width="2" opacity=".35"/>'; }
        g += '<line x1="0" y1="880" x2="1600" y2="880" stroke="' + INK + '" stroke-width="6" opacity=".8"/>';
        return wrap(g, 'rise');
      case 5: // منتج مفكك (دوائر ومستطيلات)
        g += '<g transform="translate(800 450)">';
        [[-260, 300, 180, 28], [-200, 190, 140, 24], [-230, 60, 150, 36], [-120, -110, 90, 50], [-150, -300, 110, 60]].forEach(function (q, k) { g += '<rect x="' + q[0] + '" y="' + q[1] + '" width="' + (-q[0] * 2) + '" height="' + q[3] + '" rx="' + q[3] / 2 + '" fill="none" stroke="' + INK + '" stroke-width="6" opacity="' + (0.85 - k * 0.1) + '"/>'; });
        g += '<line x1="0" y1="-320" x2="0" y2="340" stroke="' + INK + '" stroke-width="2" stroke-dasharray="10 14" opacity=".5"/></g>';
        return wrap(g, 'float');
      case 6: // طبقات طباعة
        for (var L = 0; L < 40; L++) { var w = 300 + 500 * Math.sin((L / 40) * Math.PI); g += '<line x1="' + (800 - w / 2) + '" y1="' + (120 + L * 18) + '" x2="' + (800 + w / 2) + '" y2="' + (120 + L * 18) + '" stroke="' + INK + '" stroke-width="8" stroke-linecap="round" opacity="' + (0.25 + 0.5 * (L / 40)) + '"/>'; }
        return wrap(g, 'rise');
      case 7: // مسارات حركة
        ['M100 700 C 400 100, 800 900, 1500 300', 'M100 500 C 500 800, 900 100, 1500 600', 'M150 300 C 600 500, 1000 400, 1450 800'].forEach(function (d, k) { g += '<path d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="' + (8 - k * 2) + '" opacity="' + (0.7 - k * 0.15) + '"/>'; });
        for (var m = 0; m < 8; m++) g += '<rect x="' + (160 + m * 180) + '" y="' + (420 + Math.sin(m) * 120) + '" width="22" height="22" transform="rotate(45 ' + (171 + m * 180) + ' ' + (431 + Math.sin(m) * 120) + ')" fill="' + INK + '" opacity=".7"/>';
        return wrap(g, 'drift');
      case 8: // مسارات لوحة إلكترونية
        for (var t = 0; t < 14; t++) { var y0 = 120 + t * 50, xm = 300 + (t * 97) % 900; g += '<path d="M60 ' + y0 + ' H' + xm + ' L' + (xm + 60) + ' ' + (y0 + 60) + ' H1540" fill="none" stroke="' + INK + '" stroke-width="4" opacity=".45"/><circle cx="' + xm + '" cy="' + y0 + '" r="9" fill="' + INK + '" opacity=".8"/>'; }
        for (var c3 = 0; c3 < 5; c3++) g += '<rect x="' + (260 + c3 * 240) + '" y="330" width="120" height="120" fill="none" stroke="' + INK + '" stroke-width="6" opacity=".8"/>';
        return wrap(g, 'pulse');
      default: // شبكة منظورية
        for (var v = 0; v <= 16; v++) { var fx = 800 + (v - 8) * 30, tx = 800 + (v - 8) * 260; g += '<line x1="' + fx + '" y1="380" x2="' + tx + '" y2="900" stroke="' + INK + '" stroke-width="3" opacity=".5"/>'; }
        for (var hz = 0; hz < 10; hz++) { var yy = 380 + Math.pow(hz / 9, 1.8) * 520; g += '<line x1="0" y1="' + yy + '" x2="1600" y2="' + yy + '" stroke="' + INK + '" stroke-width="3" opacity="' + (0.25 + hz * 0.05) + '"/>'; }
        g += '<circle cx="800" cy="300" r="90" fill="none" stroke="' + INK + '" stroke-width="8" opacity=".8"/>';
        return wrap(g, 'rise');
    }
    function wrap(inner, anim) { return '<svg class="art ' + anim + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + inner + '</svg>'; }
  }

  var root = document.getElementById('showcase');
  if (!root) return;
  var track = root.querySelector('.slides'), dots = root.querySelector('.dots');
  SLIDES.forEach(function (sl, i) {
    var n = ('0' + (i + 1)).slice(-2);
    var el = document.createElement('div'); el.className = 'slide' + (i % 2 ? ' alt' : '');
    el.innerHTML = art(i) +
      '<div class="win"><div class="bar"><i></i><i></i><i></i><span></span></div><div class="ph"><img class="photo" alt=""></div></div>' +
      '<div class="cap"><div class="n">' + n + ' / 10</div><h2>' + sl.t + '</h2><p>' + sl.s + '</p></div>';
    el.querySelector('.bar span').textContent = sl.app;
    var img = el.querySelector('img');
    img.onerror = function () { el.classList.add('no-photo'); };
    img.src = 'img/slides/' + n + '.jpg';
    track.appendChild(el);
    var d = document.createElement('button'); d.type = 'button'; d.setAttribute('aria-label', sl.t); d.addEventListener('click', function () { go(i, true); });
    dots.appendChild(d);
  });
  document.addEventListener('langchange', function () {
    var L = SL();
    Array.prototype.forEach.call(track.children, function (el, i) {
      el.querySelector('.cap h2').textContent = L[i].t; el.querySelector('.cap p').textContent = L[i].s;
      dots.children[i].setAttribute('aria-label', L[i].t);
    });
  });
  var slides = track.children, cur = 0, timer = null, visible = true, reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function go(i, manual) {
    slides[cur].classList.remove('active'); dots.children[cur].classList.remove('on');
    cur = (i + slides.length) % slides.length;
    slides[cur].classList.add('active'); dots.children[cur].classList.add('on');
    if (manual) restart();
  }
  function restart() { clearInterval(timer); timer = setInterval(function () { if (visible && !document.hidden) go(cur + 1); }, 5000); }
  go(0); if (!reduced) restart();
  try { new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(root); } catch (e) {}
  root.querySelector('.prev').addEventListener('click', function () { go(cur + 1, true); });
  root.querySelector('.next').addEventListener('click', function () { go(cur - 1, true); });
})();
