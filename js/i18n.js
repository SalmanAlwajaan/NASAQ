/* اللغة: عربي / English.
   يُحمَّل في <head> بعد theme.js عشان يضبط اتجاه الصفحة قبل الرسم.
   - النصوص القصيرة: عنصر عليه data-i18n="key" (أو data-i18n-html / data-i18n-placeholder / data-i18n-aria).
   - الكتل الطويلة: عنصران متطابقان، واحد عليه data-lang="ar" والآخر data-lang="en"، ويظهر المناسب فقط.
   - الزر #langBtn يبدّل اللغة ويحفظها في localStorage (sm-lang). */
(function () {
  'use strict';
  var AR = {
    'title.home': 'نَسَق، مدار وسلمى', 'title.shop': 'نَسَق، المتجر', 'title.order': 'اطلب الجهاز، فأرة ثلاثية الأبعاد', 'title.terms': 'الشروط والأحكام', 'title.privacy': 'سياسة الخصوصية',
    'brand.aria': 'نَسَق، الصفحة الرئيسية', 'nav.madar': 'مدار', 'nav.salma': 'سلمى', 'nav.journey': 'الرحلة', 'nav.software': 'البرامج', 'nav.shop': 'المتجر',
    'theme.aria': 'تبديل الوضع الليلي', 'menu.aria': 'القائمة', 'lang.btn': 'EN', 'lang.aria': 'Switch to English',
    'footer.tag': 'نَسَق: مدار وسلمى، فأرتان ثلاثيتا الأبعاد.', 'footer.terms': 'الشروط والأحكام', 'footer.privacy': 'سياسة الخصوصية', 'footer.shop': 'المتجر', 'footer.home': 'الصفحة الرئيسية', 'footer.order': 'اطلب',
    'show.aria': 'مجالات الاستخدام', 'show.prev': 'التالي', 'show.next': 'السابق',
    'stage.k.madar': 'الإصدار الأساسي', 'stage.name.madar': 'مدار', 'stage.p.madar': 'كل ما تحتاجه عشان تتحرك داخل التصميم بدون ما تلمس لوحة المفاتيح. مقبض واحد، ست حركات، ومفتاحان تبرمجهما على ما تبي.',
    'spec.m1': '6 اتجاهات بيد وحدة', 'spec.m2': 'USB أو بلوتوث', 'spec.m3': 'بطارية حتى 12 ساعة', 'spec.m4': 'هيكل PLA وحلقة TPU',
    'stage.k.salma': 'الإصدار الاحترافي', 'stage.name.salma': 'سلمى', 'stage.p.salma': 'حساسات أكثر وأدق تلتقط أصغر حركة في اليد، وبطارية أكبر، وحلقة إضاءة، واستجابة أسرع في كل البرامج.',
    'spec.s1': 'حساسات أكثر وأدق', 'spec.s2': 'USB-C أو بلوتوث', 'spec.s3': 'بطارية حتى 60 ساعة', 'spec.s4': 'حلقة إضاءة',
    'stage.btn': 'التفاصيل والطلب', 'stage.fail': 'متصفحك ما قدر يشغّل العرض ثلاثي الأبعاد. جرّب متصفحاً أحدث أو فعّل تسريع الرسوميات.', 'stage.aria.madar': 'عرض سينمائي لجهاز مدار', 'stage.aria.salma': 'عرض سينمائي لجهاز سلمى',
    'sw.h2': 'يشتغل مع البَـــرامج اللي تعرفها', 'sw.p': 'نفس البرامج اللي تدعمها الأجهزة العالمية، من التصميم الهندسي إلى الألعاب والتصوير.',
    'cta.h2': 'اطلُب نسخَـــتك', 'cta.p': 'مدار وسلمى، اختر اللي يناسبك ويوصلك رد مني على إيميلك.', 'cta.btn': 'شوف الجهازين واطلب',
    'shop.h1': 'اطلُب نسخَـــتك', 'shop.lead': 'اختر الجهاز اللي يناسبك، واضغط عليه تشوف تفاصيله، ثم اطلب ويوصلك رد مني على إيميلك.', 'shop.more': 'التفاصيل والطلب', 'shop.hint': 'اسحب للدوران', 'shop.color': 'اللون', 'shop.order': 'اطلب', 'shop.close': 'إغلاق', 'shop.img.madar': 'جهاز مدار', 'shop.img.salma': 'جهاز سلمى',
    'order.h1': 'اطلُب نسخَـــتك', 'order.lead': 'الجهاز ينطبع ويتجمّع حسب الطلب، واحد واحد. اكتب بياناتك، وأول ما يوصلني الطلب يوصلك رد على إيميلك بتفاصيله.',
    'order.a1b': 'وش يصير بعد الإرسال', 'order.a1': 'الطلب يوصلني أنا مباشرة، ويوصلك إيميل باسمك وتفاصيل طلبك في نفس اللحظة.', 'order.a2b': 'التعديل على الطلب', 'order.a2': 'رد على الإيميل اللي يوصلك وقل وش تبي تغير، ما يحتاج تعبي النموذج مرة ثانية.', 'order.a3b': 'بياناتك', 'order.a3': 'الاسم والإيميل يُستخدمان للتواصل حول طلبك فقط. التفاصيل في <a href="privacy.html">سياسة الخصوصية</a>.',
    'order.device': 'الجهاز', 'order.you': 'بياناتك', 'order.name': 'الاسم الكامل', 'order.name.err': 'اكتب اسمك عشان نعرف نخاطبك.', 'order.phone': 'رقم الجوال (اختياري)', 'order.email': 'البريد الإلكتروني', 'order.email.help': 'نرسل تأكيد الطلب على هذا البريد مباشرة بعد الإرسال.', 'order.email.err': 'البريد غير مكتمل. تأكد إنه بصيغة name@example.com.',
    'order.sec': 'الطلب', 'order.qty': 'عدد القطع', 'order.qty.minus': 'أنقص واحد', 'order.qty.plus': 'زد واحد', 'order.qty.err': 'العدد لازم يكون بين 1 و20. للكميات الأكبر راسلني مباشرة.', 'order.color': 'اللون', 'order.color.help': 'اللون نفسه للهيكل والمقبض والمفاتيح، كما شفته في المتجر.',
    'order.notes': 'ملاحظات (اختياري)', 'order.notes.ph': 'أي شي تبيني أعرفه عن طلبك.', 'order.total': 'الإجمالي', 'order.submit': 'أرسل الطلب', 'order.sending': 'جارٍ الإرسال', 'order.note': 'بالإرسال توافق على <a href="terms.html">الشروط والأحكام</a>.',
    'rv.k': 'تأكيد الطلب', 'rv.title': 'طلبك وصلني يا {name}', 'rv.emailed': 'أرسلت لك نسخة من هذي المراجعة على {email}، وأرد عليك على نفس الإيميل أول ما أبدأ على الطلب.', 'rv.saved': 'سجلت طلبك، وأتواصل معك على {email} أول ما أبدأ عليه. تقدر تحفظ هذي الصفحة أو تطبعها.',
    'rv.color': 'اللون', 'rv.qty': 'العدد', 'rv.unit': 'سعر القطعة', 'rv.name': 'الاسم', 'rv.email': 'الإيميل', 'rv.phone': 'الجوال', 'rv.notes': 'ملاحظاتك', 'rv.date': 'التاريخ', 'rv.total': 'الإجمالي', 'rv.pdf': 'احفظ المراجعة (PDF)', 'rv.home': 'ارجع للصفحة الرئيسية',
    'rv.nophone': 'ما كتب', 'rv.nonotes': 'لا يوجد', 'rv.subject': 'طلبك وصلني يا {name} ({ref})',
    'err.net': 'ما قدرت أرسل الطلب. تأكد من اتصالك بالإنترنت وجرّب مرة ثانية.', 'err.save': 'ما انحفظ الطلب: {msg}. جرّب مرة ثانية، وإذا تكرر راسلني مباشرة.',
    'cur': 'ر.س', 'legal.date': 'آخر تحديث: 24 أكتوبر 2026'
  };
  var EN = {
    'title.home': 'Nasaq, Madar and Salma', 'title.shop': 'Nasaq, Shop', 'title.order': 'Order a 3D mouse', 'title.terms': 'Terms and Conditions', 'title.privacy': 'Privacy Policy',
    'brand.aria': 'Nasaq, home page', 'nav.madar': 'Madar', 'nav.salma': 'Salma', 'nav.journey': 'The journey', 'nav.software': 'Software', 'nav.shop': 'Shop',
    'theme.aria': 'Toggle dark mode', 'menu.aria': 'Menu', 'lang.btn': 'ع', 'lang.aria': 'التبديل إلى العربية',
    'footer.tag': 'Nasaq: Madar and Salma, two 3D mice.', 'footer.terms': 'Terms', 'footer.privacy': 'Privacy', 'footer.shop': 'Shop', 'footer.home': 'Home', 'footer.order': 'Order',
    'show.aria': 'Use cases', 'show.prev': 'Next', 'show.next': 'Previous',
    'stage.k.madar': 'The essential', 'stage.name.madar': 'Madar', 'stage.p.madar': 'Everything you need to move inside your design without touching the keyboard. One knob, six motions, and two keys you map to whatever you like.',
    'spec.m1': '6 degrees of freedom', 'spec.m2': 'USB or Bluetooth', 'spec.m3': 'Up to 12 h battery', 'spec.m4': 'PLA body, TPU ring',
    'stage.k.salma': 'The professional', 'stage.name.salma': 'Salma', 'stage.p.salma': 'More, finer sensors that catch the smallest motion of your hand, a bigger battery, a light ring, and a faster response in every app.',
    'spec.s1': 'More, finer sensors', 'spec.s2': 'USB-C or Bluetooth', 'spec.s3': 'Up to 60 h battery', 'spec.s4': 'Light ring',
    'stage.btn': 'Details and order', 'stage.fail': 'Your browser could not start the 3D view. Try a newer browser or enable graphics acceleration.', 'stage.aria.madar': 'Cinematic view of Madar', 'stage.aria.salma': 'Cinematic view of Salma',
    'sw.h2': 'Works with the software you already use', 'sw.p': 'The same applications the global devices support, from engineering CAD to games and film.',
    'cta.h2': 'Order yours', 'cta.p': 'Madar or Salma: pick the one that fits you, and I reply to you by email.', 'cta.btn': 'See both and order',
    'shop.h1': 'Order yours', 'shop.lead': 'Pick the device that fits you, tap it to see the details, then order and I reply to you by email.', 'shop.more': 'Details and order', 'shop.hint': 'Drag to rotate', 'shop.color': 'Color', 'shop.order': 'Order', 'shop.close': 'Close', 'shop.img.madar': 'Madar device', 'shop.img.salma': 'Salma device',
    'order.h1': 'Order yours', 'order.lead': 'Each device is printed and assembled to order, one at a time. Fill in your details, and as soon as the order reaches me you get a reply by email with everything in it.',
    'order.a1b': 'What happens after you send', 'order.a1': 'The order comes straight to me, and you get an email with your name and the details at the same moment.', 'order.a2b': 'Changing the order', 'order.a2': 'Reply to the email you receive and say what you want to change; no need to fill the form again.', 'order.a3b': 'Your data', 'order.a3': 'Your name and email are used only to communicate about your order. Details in the <a href="privacy.html">privacy policy</a>.',
    'order.device': 'Device', 'order.you': 'Your details', 'order.name': 'Full name', 'order.name.err': 'Write your name so we know how to address you.', 'order.phone': 'Phone (optional)', 'order.email': 'Email', 'order.email.help': 'We send the order confirmation to this address right after you submit.', 'order.email.err': 'The email looks incomplete. Use the form name@example.com.',
    'order.sec': 'Order', 'order.qty': 'Quantity', 'order.qty.minus': 'One less', 'order.qty.plus': 'One more', 'order.qty.err': 'Quantity must be between 1 and 20. For larger quantities contact me directly.', 'order.color': 'Color', 'order.color.help': 'Same color for the body, the knob and the keys, as shown in the shop.',
    'order.notes': 'Notes (optional)', 'order.notes.ph': 'Anything you want me to know about your order.', 'order.total': 'Total', 'order.submit': 'Send order', 'order.sending': 'Sending', 'order.note': 'By sending you agree to the <a href="terms.html">terms and conditions</a>.',
    'rv.k': 'Order confirmation', 'rv.title': 'Got your order, {name}', 'rv.emailed': 'I sent a copy of this review to {email}, and I will reply on the same email as soon as I start on your order.', 'rv.saved': 'Your order is recorded. I will contact you at {email} as soon as I start on it. You can save or print this page.',
    'rv.color': 'Color', 'rv.qty': 'Quantity', 'rv.unit': 'Unit price', 'rv.name': 'Name', 'rv.email': 'Email', 'rv.phone': 'Phone', 'rv.notes': 'Your notes', 'rv.date': 'Date', 'rv.total': 'Total', 'rv.pdf': 'Save review (PDF)', 'rv.home': 'Back to home',
    'rv.nophone': 'Not given', 'rv.nonotes': 'None', 'rv.subject': 'Got your order, {name} ({ref})',
    'err.net': 'Could not send the order. Check your connection and try again.', 'err.save': 'The order was not saved: {msg}. Try again, and if it repeats contact me directly.',
    'cur': 'SAR', 'legal.date': 'Last updated: 24 October 2026'
  };
  var DICT = { ar: AR, en: EN };
  var root = document.documentElement;
  function saved() { try { return localStorage.getItem('sm-lang'); } catch (e) { return null; } }
  var lang = saved() || 'ar';
  function set(l) {
    lang = DICT[l] ? l : 'ar';
    root.setAttribute('lang', lang); root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }
  set(lang);
  function t(key, vars) {
    var s = (DICT[lang] && DICT[lang][key]) || AR[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function fmt(s, vars) { Object.keys(vars || {}).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); }); return s; }
  function apply() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'))); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) { el.setAttribute('alt', t(el.getAttribute('data-i18n-alt'))); });
    document.querySelectorAll('[data-lang]').forEach(function (el) { el.hidden = el.getAttribute('data-lang') !== lang; });
    var tk = document.body && document.body.getAttribute('data-title'); if (tk) document.title = t(tk);
    var b = document.getElementById('langBtn'); if (b) { b.textContent = t('lang.btn'); b.setAttribute('aria-label', t('lang.aria')); }
  }
  window.I18N = { t: t, fmt: fmt, get lang() { return lang; }, apply: apply, set: function (l) { set(l); try { localStorage.setItem('sm-lang', lang); } catch (e) {} apply(); try { document.dispatchEvent(new CustomEvent('langchange', { detail: lang })); } catch (e) {} } };
  document.addEventListener('DOMContentLoaded', function () {
    apply();
    var b = document.getElementById('langBtn');
    if (b) b.addEventListener('click', function () { window.I18N.set(lang === 'ar' ? 'en' : 'ar'); });
  });
})();
