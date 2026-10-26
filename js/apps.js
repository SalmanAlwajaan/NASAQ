/* البرامج المدعومة: صفّان متصلان بلا توقف، الأول برامج التصميم والهندسة (يمشي يسار)،
   والثاني بقية البرامج (يمشي يمين). الحركة CSS (keyframes) على نسختين متتاليتين من القائمة،
   فما تنقطع ولا تختفي أبداً. لما يقرب الماوس يبطئ الصف تدريجياً.
   الشعارات من img/apps/<slug>.svg (شعارات Simple Icons، أحادية اللون وتتلون بلون الموقع). */
(function () {
  'use strict';
  var ROW1 = [['AutoCAD', 'autocad'], ['Fusion', 'autodesk'], ['Blender', 'blender'], ['Rhinoceros', 'rhinoceros'], ['SketchUp', 'sketchup'], ['Revit', 'autodeskrevit'], ['Maya', 'autodeskmaya'],
    ['FreeCAD', 'freecad'], ['Cinema 4D', 'cinema4d'], ['Archicad', 'archicad'], ['Vectorworks', 'vectorworks'], ['Unreal Engine', 'unrealengine'], ['KiCad', 'kicad'], ['Dassault Systèmes', 'dassaultsystemes'],
    ['Siemens NX', 'siemens'], ['Houdini', 'houdini'], ['OpenSCAD', 'openscad'], ['Ansys', 'ansys'], ['Twinmotion', 'twinmotion'], ['Tinkercad', 'tinkercad'], ['Sketchfab', 'sketchfab']];
  var ROW2 = [['Unity', 'unity'], ['Godot', 'godotengine'], ['Google Earth', 'googleearth'], ['DaVinci Resolve', 'davinciresolve'], ['Nuke', 'nuke'], ['Figma', 'figma'], ['GIMP', 'gimp'],
    ['Inkscape', 'inkscape'], ['Krita', 'krita'], ['Bambu Studio', 'bambulab'], ['Arduino', 'arduino'], ['Raspberry Pi', 'raspberrypi'], ['three.js', 'threedotjs'], ['Babylon.js', 'babylondotjs'],
    ['PlayCanvas', 'playcanvas'], ['NVIDIA', 'nvidia'], ['Notion', 'notion'], ['Zoom', 'zoom'], ['Safari', 'safari'], ['Chrome', 'googlechrome'], ['Firefox', 'firefox']];
  var SPEED = 70; // بكسل في الثانية

  function cell(a) {
    var li = document.createElement('div'); li.className = 'app'; li.title = a[0];
    var i = document.createElement('i'); i.style.setProperty('--logo', 'url(img/apps/' + a[1] + '.svg)');
    var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = a[0];
    li.appendChild(i); li.appendChild(nm); return li;
  }
  function marquee(id, list) {
    var t = document.getElementById(id); if (!t) return;
    list.concat(list).forEach(function (a) { t.appendChild(cell(a)); });
    // مدة الدورة من طول نصف الشريط عشان تكون السرعة نفسها في الصفين مهما اختلف عددهما
    function dur() { var half = t.scrollWidth / 2; t.style.setProperty('--dur', (half / SPEED).toFixed(1) + 's'); }
    dur(); window.addEventListener('resize', dur);
    // الإبطاء عند التمرير: نغير سرعة التشغيل (playbackRate) تدريجياً بدل ما نوقف الحركة
    var wrap = t.parentElement, target = 1, rate = 1, raf = 0;
    function anim() { var as = t.getAnimations ? t.getAnimations() : []; return as[0]; }
    function tick() {
      rate += (target - rate) * 0.08; var a = anim(); if (a) a.playbackRate = rate;
      if (Math.abs(target - rate) > 0.01) raf = requestAnimationFrame(tick); else { if (a) a.playbackRate = target; raf = 0; }
    }
    function set(v) { target = v; if (!raf) raf = requestAnimationFrame(tick); }
    wrap.addEventListener('pointerenter', function () { set(0.2); });
    wrap.addEventListener('pointerleave', function () { set(1); });
  }
  document.addEventListener('DOMContentLoaded', function () { marquee('row1', ROW1); marquee('row2', ROW2); });
})();
