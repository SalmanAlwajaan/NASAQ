# نَسَق (مدار وسلمى): موقع المشروع

## التشغيل محلياً (Ubuntu)

```bash
cd ~/Desktop/mouse-site
python3 server.py
```

ثم افتح http://localhost:8000 ، وصفحة الطلبات http://localhost:8000/admin

لا تفتح index.html مباشرة من الملف: النموذج الحي وصفحة الطلب يحتاجان الخادم.

## الإيميل: عشان الطلبات توصلك فعلاً (مرة وحدة)

بدون هذي الخطوة ما ينرسل أي إيميل: الطلبات تنحفظ في قاعدة البيانات وصفحة /admin فقط، والخادم يطبع تنبيهاً عند التشغيل.

```bash
cd ~/Desktop/mouse-site
python3 setup_email.py
```

يسألك عن حساب Gmail وكلمة مرور التطبيقات، ويرسل رسالة تجريبية لإيميلك فوراً، وإذا وصلت يحفظ الإعدادات في `.env`.
كلمة مرور التطبيقات تجيبها من https://myaccount.google.com/apppasswords (يلزم تفعيل التحقق بخطوتين أولاً)، وهي 16 حرفاً، مو كلمة مرور الحساب.

للتأكد في أي وقت: `python3 server.py --test-email` يرسل رسالة تجريبية ويطبع النتيجة.

بديل أو إضافة: Web3Forms (إشعار لك فقط، ما يوصل العميل إيميل). سجّل في https://web3forms.com بإيميلك، يوصلك مفتاح، حطه في `.env` في `WEB3FORMS_KEY` (ويشتغل من الخادم)، أو في `js/config.js` (يشتغل من المتصفح حتى على استضافة ثابتة).

## الملفات

- index.html: الصفحة الأولى (العرض السينمائي لمدار وسلمى، الرحلة، المواصفات، البرامج، زر المتجر)
- shop.html: المتجر (الجهازان، التفاصيل، ثم الطلب)
- order.html: صفحة الطلب
- terms.html و privacy.html: الشروط والخصوصية
- server.py: الخادم المحلي، قاعدة البيانات، الإيميل التلقائي (`--test-email` للتجربة)
- setup_email.py: معالج ضبط الإيميل بخطوة وحدة
- data/orders.db: قاعدة بيانات الطلبات والعملاء والرسائل (تنشأ تلقائياً)
- data/outbox/: الرسائل بصيغة .eml إذا ما ضبطت SMTP أو فشل الإرسال
- fonts/: خطوط ثمانية كما هي، بدون تعديل
- assets/parts.wasm: هندسة مدار (22 قطعة، مراجعة C) من ملفات STEP
- assets/salma.wasm: هندسة سلمى (17 قطعة) مولّدة من 3D_SpaceMouse_final.step بأداة tools/step2bundle.py
- js/stage.js: محرك العرض السينمائي (من حزمة revC) مع وضع الخلفية الفاتحة
- js/cinematic.js: توقيت الفيلم والكاميرا للمشاهد
- img/: صور المنتجين مرسومة من النموذج نفسه، و img/apps/ لشعارات البرامج، و img/slides/ لصور مجالات الاستخدام (اقرأ README.txt داخل كل مجلد)
- js/showcase.js: عرض المجالات (10 شرائح، 5 ثوانٍ لكل وحدة؛ الصور في img/slides داخل إطار نافذة فوق رسمة متحركة)
- js/logo.js: شعار نَسَق التفاعلي (فأرة تدور في مدار)
- js/apps.js: صفّا البرامج (شعارات Simple Icons في img/apps)
- js/productview.js: العرض الحي للمنتج داخل نافذة التفاصيل مع تغيير طقم اللون (هيكل، مقبض، مفاتيح)
- js/config.js: مفتاح Web3Forms وإيميل صاحب الموقع
- js/theme.js: الوضع الليلي والنهاري وقائمة الجوال وحركة الظهور
- js/i18n.js: اللغة (عربي / English): النصوص القصيرة بالمفاتيح، والكتل الطويلة بعنصرين data-lang="ar" و data-lang="en"
- js/products.js: أسماء المنتجين وأسعارهما ووصفهما (الأسعار المعتمدة في server.py أيضاً)
- _render.html: صفحة داخلية لتوليد صور القطع، ما تظهر للزوار

## إيميل تأكيد مصمّم للعميل من الموقع المرفوع (EmailJS، مجاني)

القالب في `email/customer.html` (نفس تصميم الموقع). على الاستضافة الثابتة (GitHub Pages) يُرسل عبر EmailJS:
1. سجّل في https://www.emailjs.com ثم Email Services → Add New Service → Gmail → اربط حسابك → انسخ Service ID.
2. Email Templates → Create New Template: في To Email اكتب `{{email}}`، وفي Subject اكتب `{{subject}}`، ثم افتح Code Editor والصق محتوى `email/customer.html` → Save → انسخ Template ID.
3. Account → General → انسخ Public Key.
4. حط القيم الثلاث في `js/config.js` داخل `emailjs`، وحط رابط موقعك في `siteUrl`.
محلياً مع server.py يُرسل نفس القالب عبر SMTP تلقائياً (حط SITE_URL في .env عشان تظهر صورة المنتج داخل الإيميل).

## صفحة الطلبات

http://localhost:8000/admin مفتوحة لك على جهازك (الخادم يسمع على جهازك فقط). إذا تبيها بكلمة سر ضع ADMIN_TOKEN في .env وافتح /admin?token=القيمة

## تحديث مجسم من ملف STEP جديد

```bash
python3 tools/step2bundle.py "3D_SpaceMouse_final.step" assets/salma.wasm --parts tools/salma_parts.json
```

ملف `tools/salma_parts.json` يحدد القطع (بداية اسم المكوّن في التجميعة)، واتجاه تفكيك كل قطعة وتوقيتها وخامتها.
الأداة تحتاج python3 مع numpy و scipy و matplotlib فقط.
