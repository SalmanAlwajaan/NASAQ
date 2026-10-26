# -*- coding: utf-8 -*-
"""قارئ ملفات STEP (ISO 10303-21): يقرأ الكيانات ويبني شجرة التجميعة مع مصفوفات التحويل.
   لا يحتاج أي مكتبة خارجية غير numpy."""
import re, numpy as np

class Entity:
    __slots__ = ('id', 'parts')          # parts: list of (TYPE, args) ; simple entity => one part
    def __init__(self, id_, parts): self.id = id_; self.parts = parts
    @property
    def type(self): return self.parts[0][0] if len(self.parts) == 1 else tuple(p[0] for p in self.parts)
    @property
    def args(self): return self.parts[0][1]
    def has(self, t): return any(p[0] == t for p in self.parts)
    def get(self, t):
        for p in self.parts:
            if p[0] == t: return p[1]
        return None

class Ref:
    __slots__ = ('id',)
    def __init__(self, id_): self.id = id_
    def __repr__(self): return '#%d' % self.id

class Enum(str): pass

_tok = re.compile(r"""\s*(?:('(?:[^']|'')*')|(#\d+)|(\.[A-Z_0-9]+\.)|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)|([A-Z_][A-Z_0-9]*)|([(),*$]))""")

def _parse_args(s, pos):
    """يقرأ قائمة معاملات تبدأ بعد '(' وتنتهي بـ ')' ويعيد (list, pos)"""
    out = []
    n = len(s)
    while True:
        m = _tok.match(s, pos)
        if not m: raise ValueError('bad token at %d: %r' % (pos, s[pos:pos + 40]))
        pos = m.end()
        q, ref, en, num, name, sym = m.groups()
        if sym == ')': return out, pos
        if sym == ',': continue
        if sym == '(':
            sub, pos = _parse_args(s, pos); out.append(sub)
        elif q is not None: out.append(q[1:-1].replace("''", "'"))
        elif ref is not None: out.append(Ref(int(ref[1:])))
        elif en is not None: out.append(Enum(en[1:-1]))
        elif num is not None: out.append(float(num))
        elif name is not None:
            # كيان مسمّى داخل قائمة (في الكيانات المركبة) مثل NAME(args)
            m2 = _tok.match(s, pos)
            if m2 and m2.group(6) == '(':
                sub, pos = _parse_args(s, m2.end()); out.append((name, sub))
            else: out.append(Enum(name))
        elif sym in '*$': out.append(None)
    return out, pos

class Step:
    def __init__(self, path):
        txt = open(path, encoding='utf-8', errors='ignore').read()
        i = txt.index('DATA;') + 5
        j = txt.rindex('ENDSEC;')
        data = txt[i:j]
        self.ents = {}
        self.bytype = {}
        # الكيانات مفصولة بـ ';' خارج علامات الاقتباس
        for rec in self._records(data):
            rec = rec.strip()
            if not rec or not rec.startswith('#'): continue
            eq = rec.index('=')
            id_ = int(rec[1:eq]); body = rec[eq + 1:].strip()
            if body.startswith('('):      # كيان مركب
                items, _ = _parse_args(body, 1)
                parts = [(it[0], it[1]) for it in items if isinstance(it, tuple)]
            else:
                p = body.index('(')
                name = body[:p].strip()
                args, _ = _parse_args(body, p + 1)
                parts = [(name, args)]
            e = Entity(id_, parts)
            self.ents[id_] = e
            for t, _ in parts: self.bytype.setdefault(t, []).append(e)

    @staticmethod
    def _records(data):
        buf = []; inq = False; i = 0; n = len(data); start = 0
        while i < n:
            c = data[i]
            if c == "'": inq = not inq
            elif c == ';' and not inq:
                yield data[start:i]; start = i + 1
            i += 1

    def __getitem__(self, r):
        return self.ents[r.id if isinstance(r, Ref) else r]
    def of(self, t): return self.bytype.get(t, [])

    # ---------------------------------------------------------- هندسة أساسية
    def point(self, r):
        e = self[r]; a = e.get('CARTESIAN_POINT'); return np.array(a[1], dtype=float)
    def direction(self, r):
        e = self[r]; a = e.get('DIRECTION'); d = np.array(a[1], dtype=float); return d / (np.linalg.norm(d) or 1)
    def frame(self, r):
        """AXIS2_PLACEMENT_3D -> (origin, x, y, z)"""
        a = self[r].get('AXIS2_PLACEMENT_3D')
        o = self.point(a[1])
        z = self.direction(a[2]) if a[2] is not None else np.array([0., 0., 1.])
        x = self.direction(a[3]) if a[3] is not None else None
        if x is None or abs(np.dot(x, z)) > 0.9999:
            t = np.array([1., 0., 0.]) if abs(z[0]) < 0.9 else np.array([0., 1., 0.])
            x = t
        x = x - np.dot(x, z) * z; x /= np.linalg.norm(x)
        y = np.cross(z, x)
        return o, x, y, z
    def frame_matrix(self, r):
        o, x, y, z = self.frame(r)
        M = np.eye(4); M[:3, 0] = x; M[:3, 1] = y; M[:3, 2] = z; M[:3, 3] = o
        return M

    # ---------------------------------------------------------- الألوان
    def colours(self):
        """يعيد قاموس item_id -> (r,g,b) من STYLED_ITEM"""
        out = {}
        for e in self.of('STYLED_ITEM'):
            a = e.get('STYLED_ITEM')
            if a[2] is None: continue
            rgb = None
            for psa in a[1]:
                for st in self[psa].get('PRESENTATION_STYLE_ASSIGNMENT')[0]:
                    ssu = self[st]
                    if not ssu.has('SURFACE_STYLE_USAGE'): continue
                    sss = self[ssu.get('SURFACE_STYLE_USAGE')[1]]
                    for sf in sss.get('SURFACE_SIDE_STYLE')[1]:
                        sfa = self[sf]
                        if sfa.has('SURFACE_STYLE_FILL_AREA'):
                            fas = self[sfa.get('SURFACE_STYLE_FILL_AREA')[0]]
                            for fc in fas.get('FILL_AREA_STYLE')[1]:
                                c = self[fc]
                                if c.has('FILL_AREA_STYLE_COLOUR'):
                                    col = self[c.get('FILL_AREA_STYLE_COLOUR')[1]]
                                    if col.has('COLOUR_RGB'):
                                        cr = col.get('COLOUR_RGB'); rgb = (cr[1], cr[2], cr[3])
            if rgb: out[a[2].id] = rgb
        return out

    # ---------------------------------------------------------- التجميعة
    def assembly(self):
        """يعيد قائمة أوراق الشجرة: [(pd_id, path_names, matrix4x4, [shape_items])]"""
        pd_name = {}
        for e in self.of('PRODUCT_DEFINITION'):
            a = e.get('PRODUCT_DEFINITION')
            pdf = self[a[2]].get('PRODUCT_DEFINITION_FORMATION')
            prod = self[pdf[2]].get('PRODUCT')
            pd_name[e.id] = prod[0] or prod[1]
        # شكل كل تعريف منتج
        pd_rep = {}
        pds_def = {}
        for e in self.of('PRODUCT_DEFINITION_SHAPE'):
            a = e.get('PRODUCT_DEFINITION_SHAPE'); pds_def[e.id] = a[2].id
        for e in self.of('SHAPE_DEFINITION_REPRESENTATION'):
            a = e.get('SHAPE_DEFINITION_REPRESENTATION')
            d = pds_def.get(a[0].id)
            if d in pd_name: pd_rep.setdefault(d, []).append(a[1].id)
        # علاقات التركيب
        nauo = {}
        for e in self.of('NEXT_ASSEMBLY_USAGE_OCCURRENCE'):
            a = e.get('NEXT_ASSEMBLY_USAGE_OCCURRENCE'); nauo[e.id] = (a[3].id, a[4].id, a[1] or a[0] or '')   # parent, child, name
        children = {}
        for e in self.of('CONTEXT_DEPENDENT_SHAPE_REPRESENTATION'):
            a = e.get('CONTEXT_DEPENDENT_SHAPE_REPRESENTATION')
            rel = self[a[0]]; pds = self[a[1]].get('PRODUCT_DEFINITION_SHAPE')
            n = nauo[pds[2].id]
            rr = rel.get('REPRESENTATION_RELATIONSHIP'); rrt = rel.get('REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION')
            idt = self[rrt[0]].get('ITEM_DEFINED_TRANSFORMATION')
            A = self.frame_matrix(idt[2]); B = self.frame_matrix(idt[3])
            # rep1 عادةً شكل الابن و rep2 شكل الأب (ST-Developer)؛ التحويل: من إطار A إلى إطار B
            M = B @ np.linalg.inv(A)
            children.setdefault(n[0], []).append((n[1], M, n[2]))
        # تمثيلات الأشكال المرتبطة بدون تحويل (SHAPE_REPRESENTATION -> ADVANCED_BREP_SHAPE_REPRESENTATION)
        related = {}
        for e in self.of('SHAPE_REPRESENTATION_RELATIONSHIP'):
            if len(e.parts) != 1: continue
            a = e.get('SHAPE_REPRESENTATION_RELATIONSHIP')
            related.setdefault(a[2].id, []).append(a[3].id)
            related.setdefault(a[3].id, []).append(a[2].id)
        roots = [p for p in pd_name if p not in {c for cs in children.values() for c, _, _ in cs}]
        leaves = []
        def walk(pd, M, path):
            items = []
            reps = list(pd_rep.get(pd, []))
            for rep in list(reps):
                for r2 in related.get(rep, []):
                    if r2 not in reps: reps.append(r2)
            for rep in reps:
                r = self[rep]
                for part in r.parts:
                    if part[0].endswith('SHAPE_REPRESENTATION') or part[0] == 'SHAPE_REPRESENTATION':
                        for it in part[1][1]:
                            t = self[it].type
                            if t in ('MANIFOLD_SOLID_BREP', 'BREP_WITH_VOIDS', 'SHELL_BASED_SURFACE_MODEL', 'FACETED_BREP'):
                                items.append(it.id)
            if items: leaves.append((pd, path, M, items))
            for c, Mc, nm in children.get(pd, []):
                walk(c, M @ Mc, path + [nm or pd_name[c]])
        for r in roots: walk(r, np.eye(4), [pd_name[r]])
        self.pd_name = pd_name; self.children = children; self.roots = roots
        return leaves
