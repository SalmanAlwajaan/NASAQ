/* الوضع الليلي والنهاري + قائمة الجوال + حركة الظهور.
   يُحمَّل في <head> عشان ما يومض اللون عند فتح الصفحة. */
(function () {
  var root = document.documentElement;
  function saved() { try { return localStorage.getItem('sm-theme'); } catch (e) { return null; } }
  function system() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  function apply(t) { root.setAttribute('data-theme', t); try { document.dispatchEvent(new CustomEvent('themechange', { detail: t })); } catch (e) {} }
  apply(saved() || system());

  document.addEventListener('DOMContentLoaded', function () {
    var tb = document.getElementById('themeBtn');
    if (tb) tb.addEventListener('click', function () {
      var t = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(t); try { localStorage.setItem('sm-theme', t); } catch (e) {}
    });
    var mb = document.getElementById('menuBtn'), nav = document.querySelector('.nav');
    if (mb && nav) {
      mb.addEventListener('click', function () { var o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o ? 'true' : 'false'); });
      nav.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { nav.classList.remove('open'); }); });
    }
    /* الظهور عند التمرير */
    var els = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.12 });
      els.forEach(function (el) { io.observe(el); });
    } else { els.forEach(function (el) { el.classList.add('in'); }); }
  });
})();
