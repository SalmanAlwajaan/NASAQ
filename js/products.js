/* المنتجات: الأسماء والأسعار والوصف والمواصفات. نفس الملف تستخدمه صفحة المتجر وصفحة الطلب.
   الأسعار هنا للعرض فقط؛ الخادم (server.py) عنده نسخته من الأسعار ويعتمدها هو. */
window.PRODUCTS = {
  madar: {
    name: 'مدار',
    price: 249,
    image: 'img/product-madar',       // يُضاف -light.png أو -dark.png حسب الوضع
    bundle: 'assets/parts.wasm',
    tag: 'للمصممين والطلاب',
    desc: 'الإصدار الأساسي. مقبض واحد يتحكم بالدوران والتحريك والتقريب في لحظة وحدة، ومفتاحان جانبيان تبرمجهما على الأوامر اللي تستخدمها أكثر.',
    specs: [
      ['التحكم', 'متعدد المحاور، 6 اتجاهات بيد وحدة'],
      ['المفاتيح', 'مفتاحان جانبيان قابلان للبرمجة'],
      ['الاتصال', 'USB أو بلوتوث'],
      ['البطارية', 'داخلية قابلة للشحن، حتى 12 ساعة استخدام'],
      ['الهيكل', 'PLA مطبوع بتشطيب ناعم، وحلقة قاعدة من TPU'],
      ['الألوان', 'طبيعي، رمادي، أسود']
    ],
    /* مجموعات القطع اللي تتلون: الهيكل، المقبض، المفاتيح. كل لون في PRODUCT_COLORS طقم للثلاثة معاً */
    colorGroups: { body: ['body', 'base', 'cap', 'support', 'snapcaps'], knob: ['knob'], keys: ['keyL', 'keyR', 'slider'] },
    yaw: 0.3,
    en: {
      name: 'Madar', tag: 'For designers and students',
      desc: 'The essential. One knob controls rotate, pan and zoom at once, plus two side keys you map to the commands you use most.',
      specs: [
        ['Control', 'Multi-axis, 6 degrees of freedom with one hand'],
        ['Keys', 'Two programmable side keys'],
        ['Connection', 'USB or Bluetooth'],
        ['Battery', 'Internal, rechargeable, up to 12 hours of use'],
        ['Body', 'PLA with a smooth finish, TPU base ring'],
        ['Colors', 'Natural, Gray, Black']
      ]
    }
  },
  salma: {
    name: 'سلمى',
    price: 399,
    image: 'img/product-salma',
    bundle: 'assets/salma.wasm',
    tag: 'للمصممين المحترفين',
    desc: 'الإصدار الاحترافي. حساسات أكثر وأدق تلتقط أصغر حركة في اليد، وبطارية أكبر، واستجابة أسرع في كل البرامج.',
    specs: [
      ['التحكم', 'متعدد المحاور بحساسات أكثر ودقة أعلى'],
      ['المفاتيح', 'مفتاحان جانبيان قابلان للبرمجة وحلقة إضاءة'],
      ['الاتصال', 'USB-C أو بلوتوث'],
      ['البطارية', 'أكبر من مدار، حتى 60 ساعة استخدام'],
      ['الهيكل', 'غطاء PLA ووسادة كف، وقاعدة معدنية اللون مع شرائط TPU مانعة للانزلاق'],
      ['الألوان', 'طبيعي، رمادي، أسود']
    ],
    colorGroups: { body: ['top', 'pad'], knob: ['knob'], keys: ['btnR', 'btnL', 'cap', 'caps'] },
    yaw: 0.35,
    en: {
      name: 'Salma', tag: 'For professional designers',
      desc: 'The professional. More, finer sensors that catch the smallest motion of your hand, a bigger battery, and a faster response in every app.',
      specs: [
        ['Control', 'Multi-axis with more sensors and higher precision'],
        ['Keys', 'Two programmable side keys and a light ring'],
        ['Connection', 'USB-C or Bluetooth'],
        ['Battery', 'Bigger than Madar, up to 60 hours of use'],
        ['Body', 'PLA top cover and palm pad, metal-colored base with anti-slip TPU strips'],
        ['Colors', 'Natural, Gray, Black']
      ]
    }
  }
};
/* الألوان المطروحة: اللون نفسه للهيكل والمقبض والمفاتيح (طقم موحّد).
   القيم الخطية (linear) يستخدمها محرك العرض ثلاثي الأبعاد، وقيم hex للعينات في الصفحة. */
window.PRODUCT_COLORS = {
  'طبيعي': { body: [0.79, 0.87, 0.76], knob: [0.79, 0.87, 0.76], keys: [0.79, 0.87, 0.76], hex: { body: '#E6F0E2', knob: '#E6F0E2', keys: '#E6F0E2' }, label: 'الطبيعي', en: 'Natural' },
  'رمادي': { body: [0.25, 0.26, 0.27], knob: [0.25, 0.26, 0.27], keys: [0.25, 0.26, 0.27], hex: { body: '#8A8D8F', knob: '#8A8D8F', keys: '#8A8D8F' }, label: 'الرمادي', en: 'Gray' },
  'أسود':  { body: [0.024, 0.024, 0.024], knob: [0.024, 0.024, 0.024], keys: [0.024, 0.024, 0.024], hex: { body: '#2B2B2B', knob: '#2B2B2B', keys: '#2B2B2B' }, label: 'الأسود', en: 'Black' }
};
/* نصوص المنتج واللون باللغة الحالية (عربي أو English) */
window.productL = function (key) {
  var p = window.PRODUCTS[key]; if (!p) return null;
  var en = window.I18N && window.I18N.lang === 'en';
  return Object.assign({}, p, en && p.en ? p.en : {});
};
window.colorLabel = function (name, definite) {
  var c = window.PRODUCT_COLORS[name]; if (!c) return name;
  var en = window.I18N && window.I18N.lang === 'en';
  return en ? c.en : (definite ? c.label : name);
};
