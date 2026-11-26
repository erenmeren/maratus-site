"""The name on the glass, from the hardware's own lens drawing: cad-src/mechanical/core/maratus-core-lens.dxf, layer `mark`
(Noto Sans Bold as outlines, 4.6 mm; the same file as maratus-hardware/mechanical/core). Writes js/mark-data.js. No font is read.

  python3 -I site/tools/mark.py

The layer holds only lines and quadratic Bezier arcs (SPLINE, degree 2, three control points), which map to L and Q one to one.
"""
import pathlib

SITE = pathlib.Path(__file__).resolve().parents[1]
DXF = SITE.parent / "cad-src" / "mechanical" / "core" / "maratus-core-lens.dxf"
lines = DXF.read_text().splitlines()
ents, cur = [], None
for code, val in zip(lines[::2], lines[1::2]):
    code, val = code.strip(), val.strip()
    if code == "0":
        cur = (val, {})
        ents.append(cur)
    elif cur:
        cur[1].setdefault(code, []).append(val)

segs, window, lens = [], [], []
for kind, e in ents:
    layer = e.get("8", [""])[0]
    if layer == "outline" and kind == "LINE":
        lens += [(float(e["10"][0]), float(e["20"][0])), (float(e["11"][0]), float(e["21"][0]))]
    if layer == "window" and kind == "LINE":
        window += [(float(e["10"][0]), float(e["20"][0])), (float(e["11"][0]), float(e["21"][0]))]
    if layer != "mark":
        continue
    if kind == "LINE":
        segs.append([(float(e["10"][0]), float(e["20"][0])), (float(e["11"][0]), float(e["21"][0]))])
    elif kind == "SPLINE":
        assert e["71"] == ["2"] and len(e["10"]) == 3 and "41" not in e, e
        segs.append([(float(x), float(y)) for x, y in zip(e["10"], e["20"])])
    else:
        raise SystemExit(f"unexpected {kind}")

near = lambda a, b: abs(a[0] - b[0]) + abs(a[1] - b[1]) < 1e-4
loops = []
while segs:
    loop = [segs.pop(0)]
    while not near(loop[-1][-1], loop[0][0]):
        end = loop[-1][-1]
        for i, s in enumerate(segs):
            if near(s[0], end) or near(s[-1], end):
                loop.append(segs.pop(i) if near(s[0], end) else segs.pop(i)[::-1])
                break
        else:
            raise SystemExit("open loop")
    loops.append(loop)

box = lambda pts: (min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts))


def extent(s, n=32):
    if len(s) == 2:
        return s
    return [tuple((1 - t) ** 2 * a + 2 * t * (1 - t) * b + t * t * c for a, b, c in zip(*s)) for t in (k / n for k in range(n + 1))]


x0, y0, x1, y1 = box([p for lo in loops for s in lo for p in extent(s)])
lx0, ly0, lx1, ly1 = box(lens)
cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
f = lambda p: f"{round(p[0] - cx, 3):g} {round(cy - p[1], 3):g}"                # y down, as canvas and SVG have it
path = "".join("M" + f(lo[0][0]) + "".join("L" + f(s[1]) if len(s) == 2 else f"Q{f(s[1])} {f(s[2])}" for s in lo) + "Z" for lo in loops)
out = SITE / "js" / "mark-data.js"
out.write_text("// Written by tools/mark.py from the lens drawing (maratus-core-lens.dxf, layer `mark`). Millimetres, round the middle of the letters, y down.\n"
               f"export const GLASS_MARK = {{ w: {x1 - x0:.2f}, h: {y1 - y0:.2f}, up: {cy - ly0:.3f}, lens: {ly1 - ly0:.2f}, d: '{path}' }};\n")
print(f"{len(loops)} loops, {x1 - x0:.3f} x {y1 - y0:.3f} mm, lens {lx1 - lx0:.2f} x {ly1 - ly0:.2f}, middle {cx - (lx0 + lx1) / 2:+.4f} off centre, {cy - ly0:.3f} above the lens's bottom edge, {len(path)} characters")
