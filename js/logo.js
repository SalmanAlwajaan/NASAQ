/* شعار نَسَق التفاعلي: فأرة صغيرة تدور في مدار حول المركز.
   تدور دائماً ببطء، وتسرع لما يمر الماوس فوق الشعار، ويميل المدار مع حركة المؤشر.
   يُطبَّق على كل عنصر .brand فيه svg.orbit-mark. */
(function () {
  'use strict';
  function init(brand) {
    var svg = brand.querySelector('.orbit-mark'), sat = brand.querySelector('.sat'), ring = brand.querySelector('.ring');
    if (!svg || !sat) return;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var anim = null;
    if (!reduced && sat.animate) {
      // المسار: نفس القطع الناقص المرسوم في الشعار. الجزء السفلي أمام الكوكب (أكبر وأوضح)، والعلوي خلفه.
      anim = sat.animate([
        { offsetDistance: '0%', transform: 'scale(1.05)', opacity: 1 },
        { offsetDistance: '25%', transform: 'scale(1.25)', opacity: 1 },
        { offsetDistance: '50%', transform: 'scale(1.05)', opacity: 1 },
        { offsetDistance: '55%', transform: 'scale(.9)', opacity: .45 },
        { offsetDistance: '75%', transform: 'scale(.72)', opacity: .45 },
        { offsetDistance: '95%', transform: 'scale(.9)', opacity: .45 },
        { offsetDistance: '100%', transform: 'scale(1.05)', opacity: 1 }
      ], { duration: 6000, iterations: Infinity, easing: 'linear' });
    }
    var target = 1, rate = 1, raf = 0;
    function tick() {
      rate += (target - rate) * 0.08;
      if (anim) anim.playbackRate = rate;
      if (Math.abs(target - rate) > 0.01) raf = requestAnimationFrame(tick); else { if (anim) anim.playbackRate = target; raf = 0; }
    }
    function speed(v) { target = v; if (!raf) raf = requestAnimationFrame(tick); }
    brand.addEventListener('pointerenter', function () { speed(3.2); });
    brand.addEventListener('pointerleave', function () { speed(1); svg.style.transform = ''; });
    brand.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect(), dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
      svg.style.transform = 'perspective(120px) rotateX(' + (-dy * 28).toFixed(1) + 'deg) rotateY(' + (dx * 28).toFixed(1) + 'deg)';
    });
    brand.addEventListener('focus', function () { speed(3.2); });
    brand.addEventListener('blur', function () { speed(1); });
  }
  document.addEventListener('DOMContentLoaded', function () { document.querySelectorAll('.brand').forEach(init); });
})();
