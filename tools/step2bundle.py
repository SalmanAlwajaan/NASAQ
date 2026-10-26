#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
محوّل STEP إلى حزمة العرض (assets/*.wasm بصيغة SMB2) اللي يقرأها محرك الموقع js/stage.js.

    python3 tools/step2bundle.py assembly.step assets/salma.wasm --parts tools/salma_parts.json

ملف القطع (JSON) يحدد لكل قطعة: اسمها في التجميعة (بداية اسم NAUO)، معرّفها، اتجاه التفكيك، توقيته، والخامة.
يحتاج numpy و scipy فقط. يقرأ: مستويات، أسطوانات، مخاريط، كرات، حلقات، أسطح B-spline، ومنحنيات: خطوط، دوائر، قطوع ناقصة، B-spline.
"""
import sys, os, json, math, struct, argparse, time
import numpy as np
from scipy.spatial import Delaunay
from matplotlib.path import Path as MPath
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stepparse import Step, Ref

TOL = 0.06          # خطأ الوتر المسموح بالمليمتر
MAX_SEG = 96        # أقصى عدد قطع لمنحنى واحد
GRID_MAX = 48       # أقصى عدد نقاط داخلية في كل اتجاه

# ------------------------------------------------------------------ B-spline
def bspline_basis(knots, degree, t):
    """مصفوفة دوال الأساس (len(t) x n) بطريقة Cox-de Boor"""
    knots = np.asarray(knots, float); t = np.asarray(t, float)
    n = len(knots) - degree - 1
    N = np.zeros((len(t), len(knots) - 1))
    # الدرجة صفر
    for i in range(len(knots) - 1):
        if knots[i + 1] > knots[i]:
            N[:, i] = (t >= knots[i]) & (t < knots[i + 1])
    # النقطة الأخيرة من المجال
    last = np.where(knots[:-1] < knots[1:])[0]
    if len(last): N[t >= knots[-1] - 1e-12, :] = 0; N[t >= knots[-1] - 1e-12, last[-1]] = 1
    for d in range(1, degree + 1):
        M = np.zeros((len(t), len(knots) - d - 1))
        for i in range(len(knots) - d - 1):
            den1 = knots[i + d] - knots[i]; den2 = knots[i + d + 1] - knots[i + 1]
            a = ((t - knots[i]) / den1) * N[:, i] if den1 > 0 else 0
            b = ((knots[i + d + 1] - t) / den2) * N[:, i + 1] if den2 > 0 else 0
            M[:, i] = a + b
        N = M
    return N[:, :n]

def expand_knots(mults, knots):
    out = []
    for m, k in zip(mults, knots): out += [k] * int(m)
    return out

class BCurve:
    def __init__(self, st, e):
        if len(e.parts) == 1:
            a = e.get('B_SPLINE_CURVE_WITH_KNOTS')
            self.deg = int(a[1]); cps = a[2]; mults, knots = a[6], a[7]
        else:   # كيان مركب: السمات موزعة على الأجزاء
            b = e.get('B_SPLINE_CURVE'); k = e.get('B_SPLINE_CURVE_WITH_KNOTS')
            self.deg = int(b[0]); cps = b[1]; mults, knots = k[0], k[1]
        self.cp = np.array([st.point(r) for r in cps])
        self.knots = expand_knots(mults, knots)
        self.w = np.array(e.get('RATIONAL_B_SPLINE_CURVE')[0], float) if e.has('RATIONAL_B_SPLINE_CURVE') else None
        self.t0, self.t1 = self.knots[self.deg], self.knots[-self.deg - 1]
    def eval(self, t):
        N = bspline_basis(self.knots, self.deg, np.clip(t, self.t0, self.t1))
        if self.w is None: return N @ self.cp
        Nw = N * self.w; return (Nw @ self.cp) / Nw.sum(1, keepdims=True)

class BSurf:
    def __init__(self, st, e):
        if len(e.parts) == 1:
            a = e.get('B_SPLINE_SURFACE_WITH_KNOTS')
            self.du, self.dv = int(a[1]), int(a[2]); cps = a[3]; um, vm, uk, vk = a[8], a[9], a[10], a[11]
            self.uclosed, self.vclosed = (a[5] == 'T'), (a[6] == 'T')
        else:
            b = e.get('B_SPLINE_SURFACE'); k = e.get('B_SPLINE_SURFACE_WITH_KNOTS')
            self.du, self.dv = int(b[0]), int(b[1]); cps = b[2]; um, vm, uk, vk = k[0], k[1], k[2], k[3]
            self.uclosed, self.vclosed = (b[4] == 'T'), (b[5] == 'T')
        self.cp = np.array([[st.point(r) for r in row] for row in cps])      # (nu, nv, 3)
        self.ku = expand_knots(um, uk); self.kv = expand_knots(vm, vk)
        self.w = np.array(e.get('RATIONAL_B_SPLINE_SURFACE')[0], float) if e.has('RATIONAL_B_SPLINE_SURFACE') else None
        self.u0, self.u1 = self.ku[self.du], self.ku[-self.du - 1]
        self.v0, self.v1 = self.kv[self.dv], self.kv[-self.dv - 1]
    def wrap(self, u, v):
        u = np.asarray(u, float); v = np.asarray(v, float)
        if self.uclosed: u = self.u0 + np.mod(u - self.u0, self.u1 - self.u0)
        else: u = np.clip(u, self.u0, self.u1)
        if self.vclosed: v = self.v0 + np.mod(v - self.v0, self.v1 - self.v0)
        else: v = np.clip(v, self.v0, self.v1)
        return u, v
    def eval(self, u, v):
        u, v = self.wrap(u, v)
        Nu = bspline_basis(self.ku, self.du, u); Nv = bspline_basis(self.kv, self.dv, v)
        if self.w is None:
            return np.einsum('pi,pj,ijk->pk', Nu, Nv, self.cp)
        W = np.einsum('pi,pj,ij->p', Nu, Nv, self.w)
        return np.einsum('pi,pj,ij,ijk->pk', Nu, Nv, self.w, self.cp) / W[:, None]

# ------------------------------------------------------------------ الأسطح
class Surface:
    """واجهة موحدة: eval(u,v)->(n,3), inverse(P)->(u,v), period(u/v), مجال افتراضي"""
    periodic_u = None; periodic_v = None
    def normal(self, u, v, h=1e-3):
        su, sv = self.scale()
        du = h / max(su, 1e-9); dv = h / max(sv, 1e-9)
        P1 = self.eval(u + du, v); P0 = self.eval(u - du, v); Q1 = self.eval(u, v + dv); Q0 = self.eval(u, v - dv)
        n = np.cross(P1 - P0, Q1 - Q0)
        l = np.linalg.norm(n, axis=1, keepdims=True); l[l < 1e-12] = 1
        return n / l
    def scale(self): return (1.0, 1.0)

class Plane(Surface):
    def __init__(self, st, e):
        self.o, self.x, self.y, self.z = st.frame(e.get('PLANE')[1])
    def eval(self, u, v):
        u = np.asarray(u, float)[:, None]; v = np.asarray(v, float)[:, None]
        return self.o + u * self.x + v * self.y
    def inverse(self, P):
        d = P - self.o; return d @ self.x, d @ self.y
    def normal(self, u, v, h=0): return np.tile(self.z, (len(np.atleast_1d(u)), 1))
    def curvature_steps(self, urange, vrange): return 1, 1

class Cylinder(Surface):
    periodic_u = 2 * math.pi
    def __init__(self, st, e):
        a = e.get('CYLINDRICAL_SURFACE'); self.o, self.x, self.y, self.z = st.frame(a[1]); self.r = float(a[2])
    def eval(self, u, v):
        u = np.asarray(u, float)[:, None]; v = np.asarray(v, float)[:, None]
        return self.o + self.r * (np.cos(u) * self.x + np.sin(u) * self.y) + v * self.z
    def inverse(self, P):
        d = P - self.o; return np.arctan2(d @ self.y, d @ self.x), d @ self.z
    def scale(self): return (self.r, 1.0)
    def curvature_steps(self, ur, vr):
        return max(1, int(math.ceil((ur[1] - ur[0]) / (2 * math.acos(max(-1, 1 - TOL / self.r))) )) if self.r > TOL else 1), 1

class Cone(Surface):
    periodic_u = 2 * math.pi
    def __init__(self, st, e):
        a = e.get('CONICAL_SURFACE'); self.o, self.x, self.y, self.z = st.frame(a[1]); self.r = float(a[2]); self.t = math.tan(float(a[3]))
    def eval(self, u, v):
        u = np.asarray(u, float)[:, None]; v = np.asarray(v, float)[:, None]
        return self.o + (self.r + v * self.t) * (np.cos(u) * self.x + np.sin(u) * self.y) + v * self.z
    def inverse(self, P):
        d = P - self.o; return np.arctan2(d @ self.y, d @ self.x), d @ self.z
    def scale(self): return (max(self.r, 0.5), 1.0)
    def curvature_steps(self, ur, vr):
        rr = max(abs(self.r + vr[0] * self.t), abs(self.r + vr[1] * self.t), 0.3)
        return max(1, int(math.ceil((ur[1] - ur[0]) / (2 * math.acos(max(-1, 1 - TOL / rr)))))), 1

class Sphere(Surface):
    periodic_u = 2 * math.pi
    def __init__(self, st, e):
        a = e.get('SPHERICAL_SURFACE'); self.o, self.x, self.y, self.z = st.frame(a[1]); self.r = float(a[2])
    def eval(self, u, v):
        u = np.asarray(u, float)[:, None]; v = np.asarray(v, float)[:, None]
        return self.o + self.r * (np.cos(v) * (np.cos(u) * self.x + np.sin(u) * self.y) + np.sin(v) * self.z)
    def inverse(self, P):
        d = P - self.o; return np.arctan2(d @ self.y, d @ self.x), np.arcsin(np.clip((d @ self.z) / self.r, -1, 1))
    def scale(self): return (self.r, self.r)
    def curvature_steps(self, ur, vr):
        a = 2 * math.acos(max(-1, 1 - TOL / self.r))
        return max(1, int(math.ceil((ur[1] - ur[0]) / a))), max(1, int(math.ceil((vr[1] - vr[0]) / a)))

class Torus(Surface):
    periodic_u = 2 * math.pi; periodic_v = 2 * math.pi
    def __init__(self, st, e):
        a = e.get('TOROIDAL_SURFACE'); self.o, self.x, self.y, self.z = st.frame(a[1]); self.R = float(a[2]); self.r = float(a[3])
    def eval(self, u, v):
        u = np.asarray(u, float)[:, None]; v = np.asarray(v, float)[:, None]
        return self.o + (self.R + self.r * np.cos(v)) * (np.cos(u) * self.x + np.sin(u) * self.y) + self.r * np.sin(v) * self.z
    def inverse(self, P):
        d = P - self.o; px, py, pz = d @ self.x, d @ self.y, d @ self.z
        return np.arctan2(py, px), np.arctan2(pz, np.hypot(px, py) - self.R)
    def scale(self): return (self.R + self.r, self.r)
    def curvature_steps(self, ur, vr):
        au = 2 * math.acos(max(-1, 1 - TOL / (self.R + self.r))); av = 2 * math.acos(max(-1, 1 - TOL / self.r))
        return max(1, int(math.ceil((ur[1] - ur[0]) / au))), max(1, int(math.ceil((vr[1] - vr[0]) / av)))

class Spline(Surface):
    def __init__(self, st, e):
        self.b = BSurf(st, e)
        # سطح مغلق في اتجاه ما: نعامله كدوري عشان ما ينقطع عند خط الالتحام
        self.periodic_u = (self.b.u1 - self.b.u0) if self.b.uclosed else None
        self.periodic_v = (self.b.v1 - self.b.v0) if self.b.vclosed else None
        # شبكة أولية للعكس
        self.gu = np.linspace(self.b.u0, self.b.u1, 24); self.gv = np.linspace(self.b.v0, self.b.v1, 24)
        U, V = np.meshgrid(self.gu, self.gv, indexing='ij')
        self.gP = self.b.eval(U.ravel(), V.ravel()); self.gU = U.ravel(); self.gV = V.ravel()
        # مقياس الاشتقاق
        su = np.linalg.norm(np.diff(self.gP.reshape(24, 24, 3), axis=0), axis=2).mean() / ((self.b.u1 - self.b.u0) / 23 or 1)
        sv = np.linalg.norm(np.diff(self.gP.reshape(24, 24, 3), axis=1), axis=2).mean() / ((self.b.v1 - self.b.v0) / 23 or 1)
        self._scale = (max(su, 1e-6), max(sv, 1e-6))
    def eval(self, u, v): return self.b.eval(u, v)
    def scale(self): return self._scale
    def inverse(self, P):
        P = np.asarray(P, float)
        d2 = ((P[:, None, :] - self.gP[None, :, :]) ** 2).sum(2)
        k = d2.argmin(1); u = self.gU[k].copy(); v = self.gV[k].copy()
        hu = (self.b.u1 - self.b.u0) * 1e-4; hv = (self.b.v1 - self.b.v0) * 1e-4
        for _ in range(8):
            S = self.b.eval(u, v)
            Su = (self.b.eval(u + hu, v) - self.b.eval(u - hu, v)) / (2 * hu)
            Sv = (self.b.eval(u, v + hv) - self.b.eval(u, v - hv)) / (2 * hv)
            r = P - S
            # حل 2x2 للمربعات الصغرى
            a = (Su * Su).sum(1); b = (Su * Sv).sum(1); c = (Sv * Sv).sum(1)
            e1 = (Su * r).sum(1); e2 = (Sv * r).sum(1)
            det = a * c - b * b; det[np.abs(det) < 1e-18] = 1e-18
            du = (c * e1 - b * e2) / det; dv = (a * e2 - b * e1) / det
            # خطوة محدودة عشان ما يطير الحل
            lim_u = (self.b.u1 - self.b.u0) * 0.25; lim_v = (self.b.v1 - self.b.v0) * 0.25
            du = np.clip(du, -lim_u, lim_u); dv = np.clip(dv, -lim_v, lim_v)
            u, v = self.b.wrap(u + du, v + dv)
        return u, v
    def curvature_steps(self, ur, vr):
        # تقدير من انحناء الشبكة
        G = self.gP.reshape(24, 24, 3)
        def steps(axis, rng):
            d1 = np.diff(G, axis=axis); d2 = np.diff(d1, axis=axis)
            seg = np.linalg.norm(d1, axis=2).mean()
            dev = np.linalg.norm(d2, axis=2).max() / 4  # انحراف الوتر التقريبي لكل خطوة شبكة
            if dev <= TOL: return 2
            n = 23 * math.sqrt(dev / TOL)
            return int(min(GRID_MAX, max(2, math.ceil(n * (rng[1] - rng[0]) / ((self.b.u1 - self.b.u0) if axis == 0 else (self.b.v1 - self.b.v0)) ))))
        return steps(0, ur), steps(1, vr)

def make_surface(st, r):
    e = st[r]
    if e.has('PLANE'): return Plane(st, e)
    if e.has('CYLINDRICAL_SURFACE'): return Cylinder(st, e)
    if e.has('CONICAL_SURFACE'): return Cone(st, e)
    if e.has('SPHERICAL_SURFACE'): return Sphere(st, e)
    if e.has('TOROIDAL_SURFACE'): return Torus(st, e)
    if e.has('B_SPLINE_SURFACE_WITH_KNOTS'): return Spline(st, e)
    raise ValueError('surface ' + str(e.type))

# ------------------------------------------------------------------ المنحنيات
def sample_edge(st, ec_ref, orient):
    """يعيد نقاط الحافة ثلاثية الأبعاد بالترتيب (بدون تكرار نقطة البداية في النهاية)"""
    ec = st[ec_ref].get('EDGE_CURVE')
    p1 = st.point(st[ec[1]].get('VERTEX_POINT')[1]); p2 = st.point(st[ec[2]].get('VERTEX_POINT')[1])
    same_vertex = ec[1].id == ec[2].id
    c = st[ec[3]]; sense = (ec[4] == 'T')
    if c.has('SURFACE_CURVE') or c.has('SEAM_CURVE'):
        c = st[(c.get('SURFACE_CURVE') or c.get('SEAM_CURVE'))[1]]
    pts = None
    if c.has('LINE'):
        pts = np.array([p1, p2])
    elif c.has('CIRCLE') or c.has('ELLIPSE'):
        a = c.get('CIRCLE') or c.get('ELLIPSE')
        o, x, y, z = st.frame(a[1])
        ra = float(a[2]); rb = float(a[3]) if c.has('ELLIPSE') else ra
        def ang(p): d = p - o; return math.atan2((d @ y) / rb, (d @ x) / ra)
        t1, t2 = ang(p1), ang(p2)
        if same_vertex: t2 = t1 + 2 * math.pi if sense else t1 - 2 * math.pi
        else:
            if sense and t2 <= t1 + 1e-9: t2 += 2 * math.pi
            if not sense and t2 >= t1 - 1e-9: t2 -= 2 * math.pi
        rmax = max(ra, rb)
        n = int(min(MAX_SEG, max(2, math.ceil(abs(t2 - t1) / (2 * math.acos(max(-1, 1 - TOL / rmax))) )))) if rmax > TOL else 2
        t = np.linspace(t1, t2, n + 1)[:, None]
        pts = o + ra * np.cos(t) * x + rb * np.sin(t) * y
        pts[0] = p1; pts[-1] = p2
    elif c.has('B_SPLINE_CURVE_WITH_KNOTS'):
        b = BCurve(st, c)
        ts = np.linspace(b.t0, b.t1, 200); S = b.eval(ts)
        def par(p): return ts[((S - p) ** 2).sum(1).argmin()]
        if same_vertex: t1, t2 = (b.t0, b.t1) if sense else (b.t1, b.t0)
        else:
            t1, t2 = par(p1), par(p2)
            if abs(t2 - t1) < 1e-9: t1, t2 = (b.t0, b.t1) if sense else (b.t1, b.t0)
        # عدد العينات حسب الانحراف
        seg = S[(ts >= min(t1, t2)) & (ts <= max(t1, t2))]
        if len(seg) < 3: seg = S
        d1 = np.diff(seg, axis=0); d2 = np.diff(d1, axis=0)
        dev = np.linalg.norm(d2, axis=1).max() / 4 if len(d2) else 0
        n = int(min(MAX_SEG, max(2, math.ceil(len(seg) * math.sqrt(max(dev, 1e-9) / TOL) / 4))))
        t = np.linspace(t1, t2, n + 1)
        pts = b.eval(t); pts[0] = p1; pts[-1] = p2
    else:
        raise ValueError('curve ' + str(c.type))
    if not orient: pts = pts[::-1]
    return pts[:-1]

# ------------------------------------------------------------------ تثليث الوجه
def unwrap(a, period):
    a = a.copy()
    for i in range(1, len(a)):
        d = a[i] - a[i - 1]
        if d > period / 2: a[i:] -= period
        elif d < -period / 2: a[i:] += period
    return a

def tessellate_face(st, face_ref, tol_scale=1.0):
    fa = st[face_ref].get('ADVANCED_FACE')
    surf = make_surface(st, fa[2]); same = (fa[3] == 'T')
    loops = []
    for b in fa[1]:
        bb = st[b]; ba = bb.get('FACE_OUTER_BOUND') or bb.get('FACE_BOUND')
        outer = bb.has('FACE_OUTER_BOUND')
        loop = st[ba[1]].get('EDGE_LOOP')
        pts = []
        for oe in loop[1]:
            oa = st[oe].get('ORIENTED_EDGE')
            pts.append(sample_edge(st, oa[3], oa[4] == 'T'))
        P = np.vstack(pts)
        if ba[2] == 'F': P = P[::-1]
        loops.append((outer, P))
    if not loops: return None
    # إلى فضاء المعاملات
    uv_loops = []
    for outer, P in loops:
        u, v = surf.inverse(P)
        if surf.periodic_u: u = unwrap(u, surf.periodic_u)
        if surf.periodic_v: v = unwrap(v, surf.periodic_v)
        uv_loops.append((outer, np.column_stack([u, v]), P))
    # اللوب الخارجي قد لا يكون موسوماً، نأخذ الأكبر مساحة
    def area(uv): x, y = uv[:, 0], uv[:, 1]; return 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))
    order = sorted(range(len(uv_loops)), key=lambda i: -area(uv_loops[i][1]))
    outer_uv = uv_loops[order[0]][1]; holes = [uv_loops[i][1] for i in order[1:]]
    # مواءمة الفترات الدورية بين اللوبات
    for i, h in enumerate(holes):
        for k, per in ((0, surf.periodic_u), (1, surf.periodic_v)):
            if per:
                while h[:, k].mean() - outer_uv[:, k].mean() > per / 2: h[:, k] -= per
                while h[:, k].mean() - outer_uv[:, k].mean() < -per / 2: h[:, k] += per
    su, sv = surf.scale()
    umin, umax = outer_uv[:, 0].min(), outer_uv[:, 0].max(); vmin, vmax = outer_uv[:, 1].min(), outer_uv[:, 1].max()
    # نقاط داخلية للأسطح المنحنية
    nu, nv = surf.curvature_steps((umin, umax), (vmin, vmax))
    inner = np.zeros((0, 2))
    if nu > 1 or nv > 1:
        gu = np.linspace(umin, umax, min(GRID_MAX, nu) + 1)[1:-1] if nu > 1 else np.array([(umin + umax) / 2])
        gv = np.linspace(vmin, vmax, min(GRID_MAX, nv) + 1)[1:-1] if nv > 1 else np.array([(vmin + vmax) / 2])
        if nu > 1 and nv == 1: gv = np.array([vmin + (vmax - vmin) * f for f in (0.5,)])
        G = np.array([(a, b) for a in gu for b in gv]) if len(gu) and len(gv) else np.zeros((0, 2))
        if len(G):
            outer_path = MPath(outer_uv)
            keep = outer_path.contains_points(G)
            for h in holes: keep &= ~MPath(h).contains_points(G)
            # ابعد عن الحدود شوي
            inner = G[keep]
    allpts = np.vstack([outer_uv] + holes + [inner])
    scaled = allpts * np.array([su, sv])
    if len(allpts) < 3: return None
    try:
        tri = Delaunay(scaled)
    except Exception:
        return None
    simp = tri.simplices
    cen = scaled[simp].mean(1)
    mids = np.concatenate([(scaled[simp[:, i]] + scaled[simp[:, (i + 1) % 3]]) / 2 for i in range(3)])
    mids = mids * 0.96 + np.tile(cen, (3, 1)) * 0.04
    sc = np.array([su, sv])
    outer_path = MPath(outer_uv * sc)
    ok = outer_path.contains_points(cen)
    okm = outer_path.contains_points(mids).reshape(3, -1).all(0)
    for h in holes:
        hp = MPath(h * sc); ok &= ~hp.contains_points(cen); okm &= ~hp.contains_points(mids).reshape(3, -1).any(0)
    simp = simp[ok & okm]
    if not len(simp): return None
    # إزالة المثلثات المنحلة
    a = scaled[simp[:, 0]]; b = scaled[simp[:, 1]]; c = scaled[simp[:, 2]]
    ar = np.abs((b[:, 0] - a[:, 0]) * (c[:, 1] - a[:, 1]) - (b[:, 1] - a[:, 1]) * (c[:, 0] - a[:, 0]))
    simp = simp[ar > 1e-10]
    if not len(simp): return None
    # المواضع: نقاط الحدود نأخذها كما هي من الحواف (أدق)، والداخلية من السطح
    P3 = surf.eval(allpts[:, 0], allpts[:, 1])
    nb = sum(len(l[1]) for l in uv_loops)
    P3[:nb] = np.vstack([uv_loops[order[0]][2]] + [uv_loops[i][2] for i in order[1:]])
    N = surf.normal(allpts[:, 0], allpts[:, 1])
    if not same: N = -N
    # اتجاه المثلثات حسب الناظم
    tn = np.cross(P3[simp[:, 1]] - P3[simp[:, 0]], P3[simp[:, 2]] - P3[simp[:, 0]])
    flip = (tn * N[simp].mean(1)).sum(1) < 0
    simp[flip] = simp[flip][:, [0, 2, 1]]
    return P3, N, simp

def tessellate_solid(st, solid_ref, stats):
    e = st[solid_ref]; t = e.type
    if t == 'MANIFOLD_SOLID_BREP': shells = [e.args[1]]
    elif t == 'BREP_WITH_VOIDS': shells = [e.args[1]] + list(e.args[2])
    elif t == 'SHELL_BASED_SURFACE_MODEL': shells = list(e.args[1])
    else: return None
    V, N, F = [], [], []; off = 0
    for sh in shells:
        she = st[sh]
        faces = she.args[1] if she.type != 'ORIENTED_CLOSED_SHELL' else st[she.args[2]].args[1]
        for f in faces:
            try:
                r = tessellate_face(st, f)
            except Exception as ex:
                stats['errors'] += 1; stats['err_examples'].append(str(ex)[:60]); r = None
            if r is None: stats['skipped'] += 1; continue
            P, Nn, S = r
            V.append(P); N.append(Nn); F.append(S + off); off += len(P); stats['faces'] += 1
    if not V: return None
    return np.vstack(V), np.vstack(N), np.vstack(F)

# ------------------------------------------------------------------ الحزمة
def write_bundle(parts, out_path):
    """parts: list of dict(id, cad, count, mat, explode, t0, dur, V, N, F)"""
    meta = []; blobs = []; offset = 0
    def align(n): return (n + 3) // 4 * 4
    for p in parts:
        V, Nn, F = p['V'], p['N'], p['F']
        mn, mx = V.min(0), V.max(0); span = np.where(mx - mn > 1e-9, mx - mn, 1)
        q = np.round((V - mn) / span * 65535).clip(0, 65535).astype('<u2')
        nq = np.zeros((len(Nn), 4), dtype='i1'); nq[:, :3] = np.round(Nn * 127).clip(-127, 127).astype('i1')
        itype = 'u16' if len(V) <= 65535 else 'u32'
        idx = F.astype('<u2' if itype == 'u16' else '<u4').ravel()
        pos_b = q.tobytes(); nrm_b = nq.tobytes(); idx_b = idx.tobytes()
        pos_o = offset; offset = align(offset + len(pos_b))
        nrm_o = offset; offset = align(offset + len(nrm_b))
        idx_o = offset; offset = align(offset + len(idx_b))
        blobs.append((pos_o, pos_b)); blobs.append((nrm_o, nrm_b)); blobs.append((idx_o, idx_b))
        meta.append({'id': p['id'], 'cad': p['cad'], 'count': p.get('count', 1), 'mat': p['mat'],
                     'min': [float(x) for x in mn], 'max': [float(x) for x in mx], 'explode': p['explode'],
                     't0': p['t0'], 'dur': p['dur'], 'vcount': int(len(V)), 'icount': int(len(idx)), 'itype': itype,
                     'pos': pos_o, 'nrm': nrm_o, 'idx': idx_o, 'tris': int(len(F))})
    js = json.dumps({'units': 'mm', 'up': 'z', 'parts': meta}, ensure_ascii=False).encode('utf-8')
    js += b' ' * ((4 - (8 + len(js)) % 4) % 4)      # محاذاة بداية البيانات على 4 بايت
    bin_ = bytearray(offset)
    for o, b in blobs: bin_[o:o + len(b)] = b
    with open(out_path, 'wb') as f:
        f.write(b'SMB2'); f.write(struct.pack('<I', len(js))); f.write(js); f.write(bin_)
    return meta

def main():
    global TOL
    ap = argparse.ArgumentParser()
    ap.add_argument('step'); ap.add_argument('out'); ap.add_argument('--parts', required=True, help='JSON يصف القطع')
    ap.add_argument('--tol', type=float, default=TOL)
    args = ap.parse_args()
    TOL = args.tol
    spec = json.load(open(args.parts, encoding='utf-8'))
    t0 = time.time()
    st = Step(args.step); leaves = st.assembly(); colours = st.colours()
    print('entities', len(st.ents), 'leaves', len(leaves), 'in', round(time.time() - t0, 1), 's')
    groups = {}
    for pd, path, M, items in leaves:
        comp = path[1] if len(path) > 1 else path[0]
        key = None
        for sp in spec['parts']:
            if comp.startswith(sp['match']): key = sp['id']; break
        if key is None: print('  (تجاهل)', comp); continue
        groups.setdefault(key, []).append((M, items, comp))
    parts = []
    for sp in spec['parts']:
        if sp['id'] not in groups: print('  لم تُوجد قطعة', sp['id']); continue
        V, N, F = [], [], []; off = 0; stats = {'faces': 0, 'skipped': 0, 'errors': 0, 'err_examples': []}; col = None
        for M, items, comp in groups[sp['id']]:
            R = M[:3, :3]; flip = np.linalg.det(R) < 0
            for it in items:
                r = tessellate_solid(st, it, stats)
                if r is None: continue
                P, Nn, S = r
                P = P @ R.T + M[:3, 3]; Nn = Nn @ R.T
                if flip: S = S[:, [0, 2, 1]]
                V.append(P); N.append(Nn); F.append(S + off); off += len(P)
                if col is None and it in colours: col = colours[it]
        if not V: print('  فارغة', sp['id']); continue
        V = np.vstack(V); N = np.vstack(N); F = np.vstack(F)
        mat = dict(sp.get('mat', {}))
        if 'color' not in mat: mat['color'] = [round(float(c), 3) for c in (col or (0.8, 0.8, 0.8))]
        mat.setdefault('rough', 0.55); mat.setdefault('metal', 0.0)
        parts.append({'id': sp['id'], 'cad': groups[sp['id']][0][2], 'count': len(groups[sp['id']]), 'mat': mat,
                      'explode': sp['explode'], 't0': sp['t0'], 'dur': sp['dur'], 'V': V, 'N': N, 'F': F})
        print('  %-10s tris=%7d verts=%7d faces=%d skipped=%d errors=%d %s' % (sp['id'], len(F), len(V), stats['faces'], stats['skipped'], stats['errors'], stats['err_examples'][:2]))
    meta = write_bundle(parts, args.out)
    print('wrote', args.out, round(os.path.getsize(args.out) / 1e6, 2), 'MB', 'tris', sum(m['tris'] for m in meta), 'in', round(time.time() - t0, 1), 's')

if __name__ == '__main__':
    main()
