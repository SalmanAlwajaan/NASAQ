#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ضبط الإيميل بخطوة وحدة:   python3 setup_email.py

يسألك عن إيميل Gmail وكلمة مرور التطبيقات، يجرب يرسل رسالة حقيقية لإيميلك،
وإذا وصلت يحفظ الإعدادات في ملف .env. بعدها كل طلب من الموقع يوصلك على إيميلك
ويوصل العميل تأكيد باسمه.

كلمة مرور التطبيقات (App Password) من Google، مو كلمة مرور حسابك:
  1) فعّل التحقق بخطوتين على حسابك: https://myaccount.google.com/security
  2) افتح https://myaccount.google.com/apppasswords واكتب أي اسم (مثلاً: nasaq) واضغط إنشاء
  3) تطلع لك 16 حرف (مثل: abcd efgh ijkl mnop)، انسخها كاملة
"""
import os, re, sys, smtplib, getpass
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

ROOT = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(ROOT, '.env')

def read_env():
    env = {}
    if os.path.exists(ENV_PATH):
        for line in open(ENV_PATH, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1); env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def write_env(values):
    lines = []
    if os.path.exists(ENV_PATH):
        lines = open(ENV_PATH, encoding='utf-8').read().splitlines()
    elif os.path.exists(os.path.join(ROOT, '.env.example')):
        lines = open(os.path.join(ROOT, '.env.example'), encoding='utf-8').read().splitlines()
    done = set()
    out = []
    for line in lines:
        m = re.match(r'^([A-Z_]+)=', line)
        if m and m.group(1) in values:
            out.append(f'{m.group(1)}={values[m.group(1)]}'); done.add(m.group(1))
        else:
            out.append(line)
    for k, v in values.items():
        if k not in done: out.append(f'{k}={v}')
    with open(ENV_PATH, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out) + '\n')

def ask(label, default=''):
    v = input(f'{label}' + (f' [{default}]' if default else '') + ': ').strip()
    return v or default

def try_send(host, port, user, password, to_email, owner_name, site):
    msg = EmailMessage()
    msg['From'] = formataddr((owner_name, user)); msg['To'] = to_email
    msg['Subject'] = f'تجربة من {site}: الإيميل شغال'; msg['Message-ID'] = make_msgid()
    msg.set_content(f'هلا {owner_name}،\n\nهذي رسالة تجريبية من موقع {site}. إذا وصلتك فالإرسال شغال، وكل طلب جديد بيوصلك هنا وبيوصل العميل تأكيد باسمه.\n\n{owner_name}\n')
    s = smtplib.SMTP(host, port, timeout=25); s.ehlo(); s.starttls(); s.ehlo()
    s.login(user, password); s.send_message(msg); s.quit()

def main():
    env = read_env()
    print('ضبط إيميل الطلبات لموقع نَسَق')
    print('--------------------------------')
    owner_name = ask('اسمك كما يظهر في توقيع الرسائل', env.get('OWNER_NAME', 'سلمان'))
    owner_email = ask('إيميلك اللي تبي توصلك عليه الطلبات', env.get('OWNER_EMAIL', 'Salman.k.alwajaan@gmail.com'))
    print()
    print('الإرسال يكون من حساب Gmail بكلمة مرور تطبيقات (مو كلمة مرور الحساب).')
    print('تجيبها من: https://myaccount.google.com/apppasswords  (يحتاج التحقق بخطوتين مفعّل)')
    user = ask('حساب Gmail اللي يرسل منه الموقع', env.get('SMTP_USER') or owner_email)
    password = getpass.getpass('كلمة مرور التطبيقات (16 حرف، ما تظهر وأنت تكتب): ').replace(' ', '').strip()
    if len(password) < 8:
        print('كلمة المرور قصيرة. انسخ الـ16 حرف كاملة من صفحة Google.'); return 1
    host, port = 'smtp.gmail.com', 587
    if not user.lower().endswith('@gmail.com') and not user.lower().endswith('@googlemail.com'):
        host = ask('خادم SMTP (مزودك مو Gmail)', env.get('SMTP_HOST', 'smtp.gmail.com'))
        port = int(ask('المنفذ', env.get('SMTP_PORT', '587')))
    print(f'\nأجرب أرسل رسالة تجريبية إلى {owner_email} ...')
    try:
        try_send(host, port, user, password, owner_email, owner_name, 'نَسَق')
    except smtplib.SMTPAuthenticationError:
        print('رفض Google الدخول. تأكد إنك تستخدم كلمة مرور التطبيقات (16 حرف) مو كلمة مرور الحساب، وإن التحقق بخطوتين مفعّل.'); return 1
    except Exception as e:
        print('ما قدرت أرسل:', e); return 1
    write_env({'OWNER_NAME': owner_name, 'OWNER_EMAIL': owner_email, 'SMTP_HOST': host, 'SMTP_PORT': str(port),
               'SMTP_SECURITY': 'starttls', 'SMTP_USER': user, 'SMTP_PASS': password, 'SMTP_FROM': user})
    print('\nوصلت؟ افتح إيميلك وشيّك (وشيّك على الرسائل غير المرغوبة أول مرة).')
    print(f'الإعدادات انحفظت في {ENV_PATH}')
    print('الحين شغّل الموقع: python3 server.py  ، وكل طلب بيوصلك فوراً.')
    return 0

if __name__ == '__main__':
    sys.exit(main())
