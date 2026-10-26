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

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.className = 'status'; status.textContent = '';
    if (!validate()) { var bad = form.querySelector('.field.bad input'); if (bad) bad.focus(); return; }
    var d = data();
    submitBtn.disabled = true; submitBtn.textContent = 'جارٍ الإرسال';
    var CFG = window.SITE_CONFIG || {};
    var pname = P[d.model] ? P[d.model].name : d.model;
    /* 1) الخادم المحلي: قاعدة البيانات + إيميل العميل */
    var local = fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.ok, err: j.error, via: j.email_via, id: j.order_id }; }); })
      .catch(function (e) { return { ok: false, err: e.message }; });
    /* 2) Web3Forms: إشعار مباشر على إيميل صاحب الموقع */
    var remote = !CFG.web3formsKey ? Promise.resolve({ ok: false, skipped: true }) :
      fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ access_key: CFG.web3formsKey, subject: 'طلب جديد من نَسَق: ' + pname + ' × ' + d.qty + ' (' + d.name + ')', from_name: 'نَسَق',
          name: d.name, email: d.email, phone: d.phone, model: pname, qty: d.qty, color: d.color, notes: d.notes, replyto: d.email, botcheck: '' }) })
      .then(function (r) { return r.json(); }).then(function (j) { return { ok: !!j.success, err: j.message }; })
      .catch(function (e) { return { ok: false, err: e.message }; });
    Promise.all([local, remote])
      .then(function (rs) {
        var res = { ok: rs[0].ok || rs[1].ok, j: { ok: rs[0].ok || rs[1].ok, error: rs[0].err || rs[1].err } };
        if (!res.ok || !res.j.ok) throw new Error(res.j && res.j.error ? res.j.error : 'server');
        document.getElementById('doneTitle').textContent = 'وصلني طلبك يا ' + firstName(d.name);
        var pn = P[d.model] ? P[d.model].name : '';
        var emailed = rs[0].via === 'smtp';   // إيميل العميل ينرسل فقط لما يكون SMTP مضبوط
        var idTxt = rs[0].id ? ' رقم طلبك ' + rs[0].id + '.' : '';
        document.getElementById('doneText').textContent = 'سجلت ' + qtyWords(d.qty) + ' من ' + pn + ' باللون ' + ({'طبيعي':'الطبيعي','رمادي':'الرمادي','أسود':'الأسود'}[d.color] || d.color) + ' باسمك.' + idTxt +
          (emailed ? ' أرسلت لك التفاصيل على ' + d.email + '، وأرد عليك على نفس الإيميل أول ما أبدأ على الطلب.' : ' أتواصل معك على ' + d.email + ' أول ما أبدأ على الطلب.');
        document.getElementById('doneNote').style.display = emailed ? '' : 'none';
        document.body.classList.add('sent');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function (err) {
        status.className = 'status err';
        status.textContent = err.message === 'Failed to fetch'
          ? 'ما قدرت أوصل للخادم. تأكد إن الموقع شغال من server.py مو من الملف مباشرة، وجرّب مرة ثانية.'
          : 'ما انحفظ الطلب: ' + err.message + '. جرّب مرة ثانية، وإذا تكرر راسلني مباشرة.';
        submitBtn.disabled = false; submitBtn.textContent = 'أرسل الطلب';
      });
  });
})();
