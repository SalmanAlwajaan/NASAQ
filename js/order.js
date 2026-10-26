/* صفحة الطلب: تحقق من الحقول، ثم إرسال إلى الخادم المحلي (server.py) */
(function () {
  'use strict';
  var form = document.getElementById('orderForm');
  var status = document.getElementById('formStatus');
  var submitBtn = document.getElementById('submitBtn');
  var qtyInput = form.querySelector('input[name=qty]');
  var P = window.PRODUCTS || {};

  /* خيارات اللون من products.js: كل لون طقم (هيكل، مقبض، مفاتيح) */
  var pick = document.getElementById('colorPick'), C = window.PRODUCT_COLORS || {};
  if (pick) Object.keys(C).forEach(function (n, i) {
    var l = document.createElement('label');
    l.innerHTML = '<input type="radio" name="color"><i class="sw"></i><span></span>';
    l.querySelector('input').value = n; if (i === 0) l.querySelector('input').checked = true;
    l.querySelector('.sw').style.setProperty('--c1', C[n].hex.body); l.querySelector('.sw').style.setProperty('--c2', C[n].hex.knob);
    l.querySelector('span').textContent = n;
    pick.appendChild(l);
  });

  /* الموديل من الرابط: order.html?model=salma */
  try {
    var m = new URLSearchParams(location.search).get('model');
    if (m && P[m]) form.querySelector('input[name=model][value=' + m + ']').checked = true;
    var c = new URLSearchParams(location.search).get('color');
    if (c) { var r = form.querySelector('input[name=color][value="' + c + '"]'); if (r) r.checked = true; }
  } catch (e) {}
  function model() { var r = form.querySelector('input[name=model]:checked'); return r ? r.value : 'madar'; }
  function updateTotal() {
    var p = P[model()], q = parseInt(qtyInput.value, 10) || 1;
    if (p) document.getElementById('total').textContent = (p.price * q) + ' ر.س';
  }
  form.querySelectorAll('input[name=model]').forEach(function (r) { r.addEventListener('change', updateTotal); });
  qtyInput.addEventListener('input', updateTotal);
  updateTotal();

  form.querySelectorAll('.qty button').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = parseInt(qtyInput.value, 10) || 1;
      v = Math.max(1, Math.min(20, v + parseInt(b.getAttribute('data-step'), 10)));
      qtyInput.value = v; updateTotal();
    });
  });

  function field(name) { return form.querySelector('[name=' + name + ']').closest('.field'); }
  function setBad(name, bad) { field(name).classList.toggle('bad', bad); }

  function validate() {
    var d = data(), ok = true;
    setBad('name', d.name.length < 2); ok = ok && d.name.length >= 2;
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email);
    setBad('email', !emailOk); ok = ok && emailOk;
    var qOk = d.qty >= 1 && d.qty <= 20;
    setBad('qty', !qOk); ok = ok && qOk;
    return ok;
  }
  function data() {
    var f = new FormData(form);
    return {
      model: model(),
      name: (f.get('name') || '').trim(),
      phone: (f.get('phone') || '').trim(),
      email: (f.get('email') || '').trim(),
      qty: parseInt(f.get('qty'), 10) || 0,
      color: f.get('color') || '',
      notes: (f.get('notes') || '').trim()
    };
  }
  function firstName(n) { return n.split(/\s+/)[0]; }
  function qtyWords(q) { return q === 1 ? 'قطعة وحدة' : q === 2 ? 'قطعتين' : q <= 10 ? q + ' قطع' : q + ' قطعة'; }

  function orderRef() { var t = Date.now().toString(36).toUpperCase(); return 'NSQ-' + t.slice(-6); }
  function fmtDate() { try { return new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()); } catch (e) { return new Date().toLocaleString(); } }
  function siteUrl() { var CFG = window.SITE_CONFIG || {}; if (CFG.siteUrl) return CFG.siteUrl.replace(/\/$/, ''); return location.origin + location.pathname.replace(/\/[^\/]*$/, ''); }
  /* بيانات القالب: نفس الأسماء في email/customer.html */
  function templateParams(d, ref) {
    var p = P[d.model] || {}, CFG = window.SITE_CONFIG || {};
    var colorLabel = (window.PRODUCT_COLORS[d.color] || {}).label || d.color;
    return {
      order_ref: ref, name: d.name, first_name: firstName(d.name), email: d.email, phone: d.phone || 'ما كتب',
      model: p.name || d.model, model_key: d.model, tagline: p.tag || '', color: colorLabel, qty: String(d.qty),
      unit_price: String(p.price || ''), total: String((p.price || 0) * d.qty), notes: d.notes || 'لا يوجد', date: fmtDate(),
      site_url: siteUrl(), image_url: siteUrl() + '/img/product-' + d.model + '-light.png', owner_name: CFG.ownerName || '',
      subject: 'طلبك وصلني يا ' + firstName(d.name) + ' (' + ref + ')'
    };
  }
  /* مراجعة الطلب على الصفحة: نفس تصميم الإيميل */
  function showReview(t, emailed) {
    var box = document.getElementById('done');
    box.innerHTML = '' +
      '<div class="rv-head"><div class="rv-k">تأكيد الطلب · <span dir="ltr">' + t.order_ref + '</span></div><h2>طلبك وصلني يا ' + t.first_name + '</h2>' +
      '<p>' + (emailed ? 'أرسلت لك نسخة من هذي المراجعة على <span dir="ltr">' + t.email + '</span>، وأرد عليك على نفس الإيميل أول ما أبدأ على الطلب.' : 'سجلت طلبك، وأتواصل معك على <span dir="ltr">' + t.email + '</span> أول ما أبدأ عليه. تقدر تحفظ هذي الصفحة أو تطبعها.') + '</p></div>' +
      '<div class="rv-prod"><img src="img/product-' + t.model_key + '-light.png" class="light" alt=""><img src="img/product-' + t.model_key + '-dark.png" class="dark" alt="">' +
      '<div><h3>' + t.model + '</h3><div class="rv-tag">' + t.tagline + '</div><ul><li>اللون: <b>' + t.color + '</b></li><li>العدد: <b>' + t.qty + '</b></li><li>سعر القطعة: <b>' + t.unit_price + ' ر.س</b></li></ul></div></div>' +
      '<table class="rv-table"><tr><td>الاسم</td><td>' + t.name + '</td></tr><tr><td>الإيميل</td><td dir="ltr">' + t.email + '</td></tr><tr><td>الجوال</td><td dir="ltr">' + t.phone + '</td></tr><tr><td>ملاحظاتك</td><td>' + t.notes + '</td></tr><tr><td>التاريخ</td><td>' + t.date + '</td></tr></table>' +
      '<div class="rv-total"><span>الإجمالي</span><b>' + t.total + ' ر.س</b></div>' +
      '<div class="rv-actions"><button class="btn" type="button" onclick="window.print()">احفظ المراجعة (PDF)</button><a class="btn ghost" href="index.html">ارجع للصفحة الرئيسية</a></div>';
    document.body.classList.add('sent');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function esc(x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.className = 'status'; status.textContent = '';
    if (!validate()) { var bad = form.querySelector('.field.bad input'); if (bad) bad.focus(); return; }
    var d = data();
    submitBtn.disabled = true; submitBtn.textContent = 'جارٍ الإرسال';
    var CFG = window.SITE_CONFIG || {};
    var ref = orderRef();
    var t = templateParams(d, ref);
    Object.keys(t).forEach(function (k) { t[k] = esc(t[k]); });
    var pname = P[d.model] ? P[d.model].name : d.model;
    /* 1) الخادم المحلي: قاعدة البيانات + إيميل العميل (لما يكون الموقع شغالاً من server.py) */
    var local = fetch('api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ ref: ref }, d)) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.ok, err: j.error, via: j.email_via, id: j.order_id }; }); })
      .catch(function (e) { return { ok: false, err: e.message }; });
    /* 2) Web3Forms: إشعار لك على إيميلك */
    var remote = !CFG.web3formsKey ? Promise.resolve({ ok: false, skipped: true }) :
      fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ access_key: CFG.web3formsKey, subject: 'طلب جديد ' + ref + ': ' + pname + ' × ' + d.qty + ' (' + d.name + ')', from_name: 'نَسَق',
          'رقم الطلب': ref, 'الاسم': d.name, 'الإيميل': d.email, 'الجوال': d.phone || 'ما كتب', 'الموديل': pname, 'العدد': d.qty, 'اللون': d.color,
          'الإجمالي': ((P[d.model] ? P[d.model].price : 0) * d.qty) + ' ر.س', 'ملاحظات': d.notes || 'لا يوجد', replyto: d.email, botcheck: '' }) })
      .then(function (r) { return r.json(); }).then(function (j) { return { ok: !!j.success, err: j.message }; })
      .catch(function (e) { return { ok: false, err: e.message }; });
    /* 3) EmailJS: إيميل التأكيد المصمّم للعميل (اختياري) */
    var ej = CFG.emailjs || {};
    var customer = !(ej.publicKey && ej.serviceId && ej.templateId) ? Promise.resolve({ ok: false, skipped: true }) :
      fetch('https://api.emailjs.com/api/v1.0/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: ej.serviceId, template_id: ej.templateId, user_id: ej.publicKey, template_params: t }) })
      .then(function (r) { return { ok: r.ok }; }).catch(function (e) { return { ok: false, err: e.message }; });
    Promise.all([local, remote, customer])
      .then(function (rs) {
        var ok = rs[0].ok || rs[1].ok;
        if (!ok) throw new Error(rs[0].err || rs[1].err || 'server');
        var emailed = rs[0].via === 'smtp' || rs[2].ok;
        showReview(t, emailed);
      })
      .catch(function (err) {
        status.className = 'status err';
        status.textContent = err.message === 'Failed to fetch'
          ? 'ما قدرت أرسل الطلب. تأكد من اتصالك بالإنترنت وجرّب مرة ثانية.'
          : 'ما انحفظ الطلب: ' + err.message + '. جرّب مرة ثانية، وإذا تكرر راسلني مباشرة.';
        submitBtn.disabled = false; submitBtn.textContent = 'أرسل الطلب';
      });
  });
})();
