#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
الخادم المحلي لموقع الفأرة ثلاثية الأبعاد.

يشغّل الموقع، ويستقبل الطلبات من صفحة الطلب، ويحفظها في قاعدة بيانات SQLite،
ويرسل إيميلاً شخصياً للعميل وإشعاراً لك. بدون أي مكتبات خارجية.

التشغيل:
    python3 server.py
ثم افتح:  http://localhost:8000

الإعدادات في ملف .env بجانب هذا الملف (انسخ .env.example وعدّله).
إذا ما ضبطت SMTP، الرسائل تنحفظ كملفات .eml داخل data/outbox/ بدل ما تنرسل،
عشان تشوف شكلها وتجرب بدون إيميل حقيقي.
"""
import json, os, re, sqlite3, smtplib, hashlib, sys, html, ssl, urllib.request
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, 'data')
OUTBOX = os.path.join(DATA, 'outbox')
DB_PATH = os.path.join(DATA, 'orders.db')
os.makedirs(OUTBOX, exist_ok=True)

# ---------------------------------------------------------------- الإعدادات
def load_env():
    env = {}
    p = os.path.join(ROOT, '.env')
    if os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    env.update({k: v for k, v in os.environ.items() if k in (
        'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'SMTP_SECURITY',
        'OWNER_EMAIL', 'OWNER_NAME', 'ADMIN_TOKEN', 'PORT', 'SITE_NAME', 'WEB3FORMS_KEY', 'SITE_URL')})
    return env

ENV = load_env()
OWNER_NAME = ENV.get('OWNER_NAME', 'سلمان')
OWNER_EMAIL = ENV.get('OWNER_EMAIL', 'Salman.k.alwajaan@gmail.com')
SITE_NAME = ENV.get('SITE_NAME', 'نَسَق')
PORT = int(ENV.get('PORT', '8000'))
ADMIN_TOKEN = ENV.get('ADMIN_TOKEN', '')
WEB3FORMS_KEY = ENV.get('WEB3FORMS_KEY', '')
SMTP_ON = bool(ENV.get('SMTP_HOST'))

def email_status():
    """وصف حالة الإيميل بسطر واحد (يطبع عند التشغيل وفي صفحة الطلبات)."""
    if SMTP_ON and WEB3FORMS_KEY:
        return f'SMTP عبر {ENV["SMTP_HOST"]} + إشعار Web3Forms'
    if SMTP_ON:
        return f'SMTP عبر {ENV["SMTP_HOST"]} (العميل وأنت)'
    if WEB3FORMS_KEY:
        return 'Web3Forms: إشعار لك فقط، والعميل ما يوصله إيميل (اضبط SMTP عشان يوصله)'
    return 'غير مضبوط! ما ينرسل أي إيميل. الطلبات تنحفظ في data/orders.db وdata/outbox/ فقط. شغّل: python3 setup_email.py'

# ---------------------------------------------------------------- قاعدة البيانات
def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    with db() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(name, email)
        );
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            model TEXT NOT NULL DEFAULT 'madar',
            model_name TEXT NOT NULL DEFAULT 'مدار',
            unit_price INTEGER NOT NULL DEFAULT 0,
            qty INTEGER NOT NULL,
            color TEXT NOT NULL,
            notes TEXT,
            status TEXT NOT NULL DEFAULT 'جديد',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY,
            order_id INTEGER NOT NULL REFERENCES orders(id),
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            kind TEXT NOT NULL,            -- customer | owner
            to_email TEXT NOT NULL,
            subject TEXT NOT NULL,
            body_text TEXT NOT NULL,
            sent_via TEXT NOT NULL,        -- smtp | outbox | failed
            error TEXT,
            created_at TEXT NOT NULL
        );
        """)

def ensure_columns():
    with db() as con:
        cols = [r[1] for r in con.execute('PRAGMA table_info(orders)')]
        if 'ref' not in cols:
            con.execute("ALTER TABLE orders ADD COLUMN ref TEXT NOT NULL DEFAULT ''")

def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec='seconds')

# ---------------------------------------------------------------- نص الإيميل
def first_name(name):
    return name.strip().split()[0] if name.strip() else name

def qty_words(q):
    if q == 1: return 'قطعة وحدة'
    if q == 2: return 'قطعتين'
    if q <= 10: return f'{q} قطع'
    return f'{q} قطعة'

def pick(options, seed):
    h = int(hashlib.sha256(seed.encode('utf-8')).hexdigest(), 16)
    return options[h % len(options)]

def customer_email(order, cust):
    fn = first_name(cust['name'])
    seed = cust['name'] + cust['email']
    greet = pick([f'يا هلا {fn}، شلونك؟', f'هلا {fn}، كيف الحال؟', f'مرحبا {fn}، شخبارك؟', f'{fn}، يا هلا والله.'], seed)
    open_line = pick([
        'وصلني طلبك الحين، وسجلته باسمك.',
        'طلبك وصل عندي قبل شوي وسجلته باسمك.',
        'أكتب لك عشان أأكد لك إن طلبك وصل وانحفظ عندي.',
    ], seed + '1')
    color_ar = {'طبيعي': 'الطبيعي (العاجي)', 'رمادي': 'الرمادي', 'أسود': 'الأسود'}.get(order['color'], order['color'])
    details = f'طلبت {qty_words(order["qty"])} من {order["model_name"]} باللون {color_ar}، والإجمالي {order["total"]} ر.س.'
    notes_line = ''
    if order.get('notes'):
        notes_line = pick(['وقرأت ملاحظتك، وبأخذها بالحسبان.', 'شفت ملاحظتك وبأرد عليك فيها.'], seed + '2') + '\n\n'
    work = pick([
        'الجهاز ينطبع ويتجمّع يدوياً، فبرجع لك على هذا الإيميل أول ما أبدأ عليه أو إذا احتجت أسألك عن شي.',
        'كل جهاز ينطبع ويتجمّع بيدي، فراح أرسل لك تحديث على هذا الإيميل وقت ما يبدأ الشغل عليه.',
        'أنا شغال على الطلبات بالترتيب، وأول ما يجي دور طلبك أعلمك على هذا الإيميل.',
    ], seed + '3')
    change = 'وإذا تبي تغير العدد أو اللون أو عندك أي سؤال، رد على هذي الرسالة مباشرة.'
    close = pick(['تحياتي،', 'شكراً لك،', 'سلام،'], seed + '4')
    subject = pick([f'طلبك وصلني يا {fn}', f'وصل طلبك، {fn}', f'{fn}، طلبك عندي'], seed + '5')
    text = f"{greet}\n\n{open_line} {details}\n\n{notes_line}{work}\n\n{change}\n\n{close}\n{OWNER_NAME}\n"
    return subject, text

def owner_email(order, cust):
    subject = f'طلب جديد رقم {order["id"]}: {cust["name"]}، {order["model_name"]} × {order["qty"]}، {order["color"]}'
    lines = [
        f'طلب جديد وصل من الموقع.',
        f'رقم الطلب: {order.get("ref") or order["id"]}',
        '',
        f'الاسم: {cust["name"]}',
        f'الإيميل: {cust["email"]}',
        f'الجوال: {cust["phone"] or "ما كتب"}',
        f'الموديل: {order["model_name"]} ({order["unit_price"]} ر.س)',
        f'العدد: {order["qty"]}',
        f'الإجمالي: {order["total"]} ر.س',
        f'اللون: {order["color"]}',
        f'ملاحظات: {order["notes"] or "لا يوجد"}',
        f'الوقت: {order["created_at"]}',
        '',
        f'قاعدة البيانات: {DB_PATH}',
    ]
    return subject, '\n'.join(lines) + '\n'

TEMPLATE_PATH = os.path.join(ROOT, 'email', 'customer.html')
PRODUCT_TAG = {'madar': 'للمصممين والطلاب', 'salma': 'للمصممين المحترفين'}

def customer_html(order, cust):
    """إيميل العميل بنفس تصميم الموقع من القالب email/customer.html"""
    try:
        tpl = open(TEMPLATE_PATH, encoding='utf-8').read()
    except OSError:
        return None
    site = ENV.get('SITE_URL', '').rstrip('/') or f'http://localhost:{PORT}'
    color_ar = {'طبيعي': 'الطبيعي', 'رمادي': 'الرمادي', 'أسود': 'الأسود'}.get(order['color'], order['color'])
    vals = {
        'order_ref': order.get('ref') or f'#{order["id"]}', 'name': cust['name'], 'first_name': first_name(cust['name']), 'email': cust['email'],
        'phone': cust['phone'] or 'ما كتب', 'model': order['model_name'], 'model_key': order['model'], 'tagline': PRODUCT_TAG.get(order['model'], ''),
        'color': color_ar, 'qty': str(order['qty']), 'unit_price': str(order['unit_price']), 'total': str(order['total']),
        'notes': order['notes'] or 'لا يوجد', 'date': datetime.now().strftime('%Y-%m-%d %H:%M'), 'site_url': site,
        'image_url': f'{site}/img/product-{order["model"]}-light.png', 'owner_name': OWNER_NAME,
    }
    for k, v in vals.items():
        tpl = tpl.replace('{{' + k + '}}', html.escape(str(v)))
    return tpl

def text_to_html(text):
    paras = [p.strip() for p in text.strip().split('\n\n')]
    body = ''.join(f'<p style="margin:0 0 16px">{html.escape(p).replace(chr(10), "<br>")}</p>' for p in paras)
    return f"""<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#F5EBE0;padding:28px 12px">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #D6CCC2;border-radius:8px;padding:28px 30px;
font-family:'Thmanyah Sans','Segoe UI',Tahoma,Arial,sans-serif;font-size:16px;line-height:1.8;color:#354F52">
{body}
<p style="margin:26px 0 0;padding-top:14px;border-top:1px solid #D6CCC2;font-size:13px;color:#52796F">{html.escape(SITE_NAME)}: مدار وسلمى، فأرتان ثلاثيتا الأبعاد</p>
</div></body></html>"""

# ---------------------------------------------------------------- الإرسال
def send_email(to_email, to_name, subject, text, html_body=None):
    msg = EmailMessage()
    from_addr = ENV.get('SMTP_FROM') or ENV.get('SMTP_USER') or 'no-reply@localhost'
    msg['From'] = formataddr((OWNER_NAME, from_addr))
    msg['To'] = formataddr((to_name, to_email)) if to_name else to_email
    msg['Subject'] = subject
    msg['Message-ID'] = make_msgid()
    if OWNER_EMAIL:
        msg['Reply-To'] = formataddr((OWNER_NAME, OWNER_EMAIL))
    msg.set_content(text)
    msg.add_alternative(html_body or text_to_html(text), subtype='html')

    host = ENV.get('SMTP_HOST')
    if not host:
        fname = datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + re.sub(r'[^a-z0-9]+', '-', to_email.lower()) + '.eml'
        with open(os.path.join(OUTBOX, fname), 'wb') as f:
            f.write(bytes(msg))
        return 'outbox', None
    port = int(ENV.get('SMTP_PORT', '587'))
    security = ENV.get('SMTP_SECURITY', 'starttls').lower()
    try:
        if security == 'ssl':
            s = smtplib.SMTP_SSL(host, port, timeout=20)
        else:
            s = smtplib.SMTP(host, port, timeout=20)
            s.ehlo()
            if security == 'starttls':
                s.starttls(); s.ehlo()
        if ENV.get('SMTP_USER'):
            # كلمة مرور تطبيقات Gmail تجي بمسافات (xxxx xxxx xxxx xxxx)، نشيلها
            s.login(ENV['SMTP_USER'], ENV.get('SMTP_PASS', '').replace(' ', ''))
        s.send_message(msg)
        s.quit()
        return 'smtp', None
    except Exception as e:  # نحفظ نسخة في الصندوق الصادر عشان ما يضيع شي
        fname = datetime.now().strftime('%Y%m%d-%H%M%S') + '-FAILED-' + re.sub(r'[^a-z0-9]+', '-', to_email.lower()) + '.eml'
        with open(os.path.join(OUTBOX, fname), 'wb') as f:
            f.write(bytes(msg))
        return 'failed', str(e)

def notify_web3forms(order, cust):
    """إشعار فوري لإيميلك عبر Web3Forms (يحتاج WEB3FORMS_KEY في .env). يرجع (نجح؟, رسالة)."""
    if not WEB3FORMS_KEY:
        return False, 'no key'
    subj, text = owner_email(order, cust)
    data = json.dumps({'access_key': WEB3FORMS_KEY, 'subject': subj, 'from_name': SITE_NAME, 'name': cust['name'],
                       'email': cust['email'], 'replyto': cust['email'], 'message': text, 'botcheck': ''}).encode('utf-8')
    req = urllib.request.Request('https://api.web3forms.com/submit', data=data,
                                 headers={'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            j = json.loads(r.read().decode('utf-8'))
            return bool(j.get('success')), j.get('message', '')
    except Exception as e:
        return False, str(e)

# ---------------------------------------------------------------- الطلب
EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')
COLORS = {'طبيعي', 'رمادي', 'أسود'}
# الموديلات والأسعار المعتمدة (بالريال). غيّرها هنا وفي js/products.js معاً.
MODELS = {'madar': ('مدار', 249), 'salma': ('سلمى', 399)}

def handle_order(payload):
    name = str(payload.get('name', '')).strip()[:80]
    email = str(payload.get('email', '')).strip()[:120]
    phone = str(payload.get('phone', '')).strip()[:20]
    notes = str(payload.get('notes', '')).strip()[:600]
    color = str(payload.get('color', '')).strip()
    ref = re.sub(r'[^A-Z0-9-]', '', str(payload.get('ref', '')).upper())[:16]
    model_key = str(payload.get('model', 'madar')).strip()
    if model_key not in MODELS: return None, 'الموديل غير معروف'
    model_name, unit_price = MODELS[model_key]
    try:
        qty = int(payload.get('qty', 0))
    except (TypeError, ValueError):
        qty = 0
    if len(name) < 2: return None, 'الاسم ناقص'
    if not EMAIL_RE.match(email): return None, 'البريد غير صحيح'
    if not 1 <= qty <= 20: return None, 'العدد لازم يكون بين 1 و20'
    if color not in COLORS: return None, 'اللون غير معروف'

    ts = now_iso()
    with db() as con:
        cur = con.execute('SELECT id FROM customers WHERE name=? AND email=?', (name, email))
        row = cur.fetchone()
        if row:
            cust_id = row['id']
            con.execute('UPDATE customers SET phone=COALESCE(NULLIF(?, ""), phone) WHERE id=?', (phone, cust_id))
        else:
            cust_id = con.execute('INSERT INTO customers(name,email,phone,created_at) VALUES(?,?,?,?)', (name, email, phone, ts)).lastrowid
        order_id = con.execute('INSERT INTO orders(customer_id,model,model_name,unit_price,qty,color,notes,created_at,ref) VALUES(?,?,?,?,?,?,?,?,?)',
                               (cust_id, model_key, model_name, unit_price, qty, color, notes, ts, ref)).lastrowid
    order = {'id': order_id, 'ref': ref, 'model': model_key, 'model_name': model_name, 'unit_price': unit_price, 'total': unit_price * qty,
             'qty': qty, 'color': color, 'notes': notes, 'created_at': ts}
    cust = {'id': cust_id, 'name': name, 'email': email, 'phone': phone}

    # إيميل العميل
    subj, text = customer_email(order, cust)
    via, err = send_email(email, name, subj, text, customer_html(order, cust))
    with db() as con:
        con.execute('INSERT INTO messages(order_id,customer_id,kind,to_email,subject,body_text,sent_via,error,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
                    (order_id, cust_id, 'customer', email, subj, text, via, err, now_iso()))
    # إشعارك أنت: عبر SMTP إذا مضبوط، وعبر Web3Forms إذا فيه مفتاح (أو الاثنين)
    ovia = 'none'
    if OWNER_EMAIL:
        osubj, otext = owner_email(order, cust)
        ovia, oerr = send_email(OWNER_EMAIL, OWNER_NAME, osubj, otext)
        if WEB3FORMS_KEY:
            ok3, msg3 = notify_web3forms(order, cust)
            if ok3:
                ovia = 'web3forms' if ovia != 'smtp' else 'smtp+web3forms'
            else:
                oerr = (oerr + ' | ' if oerr else '') + 'web3forms: ' + msg3
        with db() as con:
            con.execute('INSERT INTO messages(order_id,customer_id,kind,to_email,subject,body_text,sent_via,error,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
                        (order_id, cust_id, 'owner', OWNER_EMAIL, osubj, otext, ovia, oerr, now_iso()))
    print(f'[{ts}] طلب #{order_id}: {name} <{email}> {model_name} × {qty} {color} | إيميل العميل: {via} | إشعارك: {ovia}' + (f' ({err})' if err else ''))
    if via == 'outbox' and ovia in ('outbox', 'none'):
        print('   تنبيه: الإيميل غير مضبوط، ما انرسل شي. الطلب محفوظ في data/orders.db. شغّل python3 setup_email.py')
    return {'ok': True, 'order_id': order_id, 'email_via': via, 'owner_via': ovia}, None

# ---------------------------------------------------------------- لوحة الطلبات
def admin_page():
    with db() as con:
        orders = con.execute("""SELECT o.id,o.ref,o.model_name,o.unit_price,o.qty,o.color,o.notes,o.status,o.created_at,c.name,c.email,c.phone,
                                (SELECT sent_via FROM messages m WHERE m.order_id=o.id AND m.kind='customer' ORDER BY m.id DESC LIMIT 1) AS via,
                                (SELECT sent_via FROM messages m WHERE m.order_id=o.id AND m.kind='owner' ORDER BY m.id DESC LIMIT 1) AS ovia
                                FROM orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.id DESC""").fetchall()
    rows = ''.join(
        f"<tr><td>{o['id']}<br><small dir=ltr>{html.escape(o['ref'] or '')}</small></td><td>{html.escape(o['name'])}<br><small dir=ltr>{html.escape(o['email'])}</small><br><small dir=ltr>{html.escape(o['phone'] or '')}</small></td>"
        f"<td>{html.escape(o['model_name'])}</td><td>{o['qty']}</td><td>{o['unit_price'] * o['qty']}</td><td>{html.escape(o['color'])}</td><td>{html.escape(o['notes'] or '')}</td><td>{html.escape(o['status'])}</td>"
        f"<td><small>العميل: {html.escape(o['via'] or '')}<br>أنت: {html.escape(o['ovia'] or '')}</small></td><td dir=ltr><small>{html.escape(o['created_at'])}</small></td></tr>" for o in orders)
    return f"""<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>الطلبات</title>
<link rel="stylesheet" href="/css/site.css"><style>main{{padding:40px 0}}table{{width:100%;border-collapse:collapse;font-family:var(--sans);font-size:15px}}
th,td{{text-align:right;padding:10px;border-bottom:1px solid var(--line);vertical-align:top}}th{{font-size:13.5px;color:var(--fg-2)}}</style></head>
<body><main><div class="wrap"><h1 style="font-size:40px;font-weight:700;margin-bottom:8px">الطلبات</h1>
<p class="muted">{len(orders)} طلب. قاعدة البيانات: <code dir=ltr>{html.escape(DB_PATH)}</code>. الرسائل غير المرسلة في <code dir=ltr>data/outbox/</code>.</p>
<p class="muted">حالة الإيميل: {html.escape(email_status())}</p>
<table><thead><tr><th>#</th><th>العميل</th><th>الموديل</th><th>العدد</th><th>الإجمالي</th><th>اللون</th><th>ملاحظات</th><th>الحالة</th><th>الإيميل</th><th>الوقت</th></tr></thead>
<tbody>{rows or '<tr><td colspan=10>ما فيه طلبات بعد.</td></tr>'}</tbody></table></div></main></body></html>"""

# ---------------------------------------------------------------- HTTP
HIDDEN = ('server.py', '.env', '.env.example', 'data', '_render.html', 'README.md')

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        if self.path.startswith('/api/') or self.path.startswith('/admin'):
            super().log_message(fmt, *args)

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def _html(self, code, text):
        body = text.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        first = u.path.strip('/').split('/')[0]
        if first in HIDDEN:
            self.send_error(404); return
        if u.path == '/admin':
            # الخادم يسمع على جهازك فقط (127.0.0.1)، فصفحة الطلبات مفتوحة لك بدون كلمة سر.
            # إذا حطيت ADMIN_TOKEN في .env تصير تحتاج /admin?token=القيمة
            token = parse_qs(u.query).get('token', [''])[0]
            if ADMIN_TOKEN and token != ADMIN_TOKEN:
                self._html(403, '<!doctype html><meta charset="utf-8"><p dir="rtl">صفحة الطلبات محمية بـ ADMIN_TOKEN. افتح /admin?token=القيمة</p>'); return
            self._html(200, admin_page()); return
        super().do_GET()

    def do_POST(self):
        if self.path != '/api/order':
            self._json(404, {'ok': False, 'error': 'غير موجود'}); return
        try:
            n = int(self.headers.get('Content-Length', '0'))
            if n > 20000: raise ValueError('كبير')
            payload = json.loads(self.rfile.read(n).decode('utf-8'))
        except Exception:
            self._json(400, {'ok': False, 'error': 'بيانات غير مقروءة'}); return
        try:
            res, err = handle_order(payload)
        except Exception as e:
            print('خطأ:', e, file=sys.stderr)
            self._json(500, {'ok': False, 'error': 'خطأ داخلي في الخادم'}); return
        if err:
            self._json(400, {'ok': False, 'error': err}); return
        self._json(200, res)

    def end_headers(self):
        if self.path.endswith('.wasm'):
            self.send_header('Content-Type', 'application/octet-stream')
        super().end_headers()

def send_test_email():
    """python3 server.py --test-email : يرسل رسالة تجريبية لإيميلك ويطبع النتيجة."""
    print('حالة الإيميل:', email_status())
    if not SMTP_ON and not WEB3FORMS_KEY:
        print('ما فيه طريقة إرسال مضبوطة. شغّل: python3 setup_email.py'); return 1
    ok_any = False
    if SMTP_ON:
        via, err = send_email(OWNER_EMAIL, OWNER_NAME, f'تجربة من {SITE_NAME}: الإيميل شغال',
                              f'هلا {OWNER_NAME}،\n\nهذي رسالة تجريبية من موقع {SITE_NAME}. إذا وصلتك فالإرسال عبر SMTP شغال، وكل طلب جديد بيوصلك هنا وبيوصل العميل تأكيد باسمه.\n\n{OWNER_NAME}\n')
        print('SMTP:', 'انرسلت إلى ' + OWNER_EMAIL if via == 'smtp' else f'فشل: {err}')
        ok_any = ok_any or via == 'smtp'
    if WEB3FORMS_KEY:
        order = {'id': 0, 'model_name': 'تجربة', 'unit_price': 0, 'total': 0, 'qty': 1, 'color': 'تجربة', 'notes': 'رسالة تجريبية من server.py --test-email', 'created_at': now_iso()}
        ok3, msg3 = notify_web3forms(order, {'name': OWNER_NAME, 'email': OWNER_EMAIL, 'phone': ''})
        print('Web3Forms:', 'انرسلت إلى إيميلك المسجل في Web3Forms' if ok3 else f'فشل: {msg3}')
        ok_any = ok_any or ok3
    return 0 if ok_any else 1

if __name__ == '__main__':
    init_db()
    ensure_columns()
    if '--test-email' in sys.argv:
        sys.exit(send_test_email())
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    print(f'الموقع شغال على http://localhost:{PORT}   |   الطلبات: http://localhost:{PORT}/admin   |   إيقاف: Ctrl+C')
    print('الإيميل:', email_status())
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\nتوقف.')
