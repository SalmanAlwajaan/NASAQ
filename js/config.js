/* إعدادات الموقع من جهة المتصفح (تشتغل على GitHub Pages بدون خادم).

   1) WEB3FORMS: إشعار لك بكل طلب على إيميلك.
      افتح https://web3forms.com، أنشئ نموذجاً بإيميلك، وانسخ الـ Access Key هنا.

   2) EMAILJS (اختياري): إيميل تأكيد مصمّم يوصل العميل باسمه وتفاصيل طلبه.
      افتح https://www.emailjs.com (مجاني حتى 200 رسالة بالشهر):
      - Email Services → Add New Service → Gmail → اربط حسابك → انسخ Service ID
      - Email Templates → Create New Template → في "To Email" اكتب {{email}} وفي "Subject" اكتب {{subject}}
        ثم افتح Code Editor (علامة <>) والصق محتوى الملف email/customer.html → Save → انسخ Template ID
      - Account → General → انسخ Public Key
      وحط القيم الثلاث هنا.

   3) siteUrl: رابط موقعك بعد الرفع (يُستخدم لصور المنتج داخل الإيميل). */
window.SITE_CONFIG = {
  web3formsKey: '',
  ownerEmail: 'Salman.k.alwajaan@gmail.com',
  ownerName: 'سلمان',
  siteUrl: '',
  emailjs: { publicKey: '', serviceId: '', templateId: '' }
};
