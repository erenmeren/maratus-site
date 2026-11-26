"""The security holder and the USB-C cable plug for the home page (examples, not CAD): props.glb + AO.

  TMPDIR=.work/tmp /Applications/Blender.app/Contents/MacOS/Blender -b -P site/tools/export_props.py -- out=DIR
  DIR gets props.glb, ao-props.png, gr-props.png.

Frame: the Core standing upright, its middle at the origin, millimetres, Blender axes (x right, -y to the viewer, z up); the
exporter turns that into three.js axes. The Core (measured on its mesh): x +-43.3, z +-45.3, back y = +8.15, front y = -7.35,
corners 12 mm. Clearance between the holder's rubber and the Core: 0.2 mm on every side.
"""
import math
import pathlib
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

OUT = pathlib.Path(next(a[4:] for a in sys.argv if a.startswith("out="))).resolve()
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
HX, HZ, BACK, FRONT, GAP = 43.3, 45.3, 8.15, -7.35, 0.2
mats = {}
HOLD, PLUG = [], []


def mat(name):
    if name not in mats:
        mats[name] = bpy.data.materials.new(name)
        mats[name].use_nodes = True
    return mats[name]


def add(name, mesh, m, where, bevel=0.0, seg=3, angle=40):
    o = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(o)
    mesh.materials.clear()
    mesh.materials.append(mat(m))
    if bevel:
        b = o.modifiers.new("bevel", "BEVEL")
        b.width, b.segments, b.limit_method, b.angle_limit, b.harden_normals = bevel, seg, "ANGLE", math.radians(angle), False
    bpy.context.view_layer.objects.active = o
    for x in bpy.context.selected_objects:
        x.select_set(False)
    o.select_set(True)
    bpy.ops.object.shade_auto_smooth(angle=math.radians(38))
    where.append(o)
    return o


def prism(name, loops, d, m, where, matrix=Matrix(), bevel=0.0, seg=3):
    """Outline (with holes) in local x, y extruded d along local z, centred."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions, cu.fill_mode, cu.extrude = "2D", "BOTH", d / 2
    for loop in loops:
        sp = cu.splines.new("POLY")
        sp.points.add(len(loop) - 1)
        for p, (a, b) in zip(sp.points, loop):
            p.co = (a, b, 0, 1)
        sp.use_cyclic_u = True
    obj = bpy.data.objects.new("tmp", cu)
    scene.collection.objects.link(obj)
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(obj)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.dissolve_limit(bm, angle_limit=0.001, verts=bm.verts, edges=bm.edges)
    bm.to_mesh(me)
    bm.free()
    me.transform(matrix)
    return add(name, me, m, where, bevel, seg)


def rrect(w, h, r, n=10, cx=0, cy=0):
    pts = []
    for sx, sy, a0 in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((cx + sx * (w / 2 - r) + r * math.cos(a), cy + sy * (h / 2 - r) + r * math.sin(a)))
    return pts


def circle(r, n=64, cx=0, cy=0):
    return [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n)]


def lathe(name, profile, m, where, matrix=Matrix(), n=96):
    """profile [(radius, height)] about local z."""
    verts, faces = [], []
    for r, h in profile:
        verts += [(r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n), h) for k in range(n)]
    for i in range(len(profile) - 1):
        faces += [(i * n + k, i * n + (k + 1) % n, (i + 1) * n + (k + 1) % n, (i + 1) * n + k) for k in range(n)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.transform(matrix)
    return add(name, me, m, where)


def tube(name, pts, r, m, where, n=32):
    """Round tube along a polyline in the y-z plane or in space (parallel transport)."""
    pts = [Vector(p) for p in pts]
    verts, faces = [], []
    t0 = (pts[1] - pts[0]).normalized()
    u = t0.orthogonal().normalized()
    for i, p in enumerate(pts):
        t = ((pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)])).normalized()
        u = (u - t * u.dot(t)).normalized()
        v = t.cross(u)
        verts += [tuple(p + (u * math.cos(2 * math.pi * k / n) + v * math.sin(2 * math.pi * k / n)) * r) for k in range(n)]
    for i in range(len(pts) - 1):
        faces += [(i * n + k, i * n + (k + 1) % n, (i + 1) * n + (k + 1) % n, (i + 1) * n + k) for k in range(n)]
    faces += [tuple(reversed(range(n))), tuple((len(pts) - 1) * n + k for k in range(n))]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    return add(name, me, m, where)


def bent(path, t, n=8):
    """Closed outline of a bent sheet of thickness t along a centre line [(a, b, inside radius)], corners rounded."""
    P = [Vector((a, b)) for a, b, _ in path]
    line = [P[0]]
    for i in range(1, len(P) - 1):
        d0, d1 = (P[i] - P[i - 1]).normalized(), (P[i + 1] - P[i]).normalized()
        r = path[i][2] + t / 2
        ang = math.acos(max(-1, min(1, d0.dot(d1))))
        cut = r * math.tan(ang / 2)
        a, b = P[i] - d0 * cut, P[i] + d1 * cut
        s = 1 if d0.x * d1.y - d0.y * d1.x > 0 else -1
        c = a + Vector((-d0.y, d0.x)) * r * s
        for k in range(n + 1):
            q = ang * k / n * s
            e = a - c
            line.append(c + Vector((e.x * math.cos(q) - e.y * math.sin(q), e.x * math.sin(q) + e.y * math.cos(q))))
    line.append(P[-1])
    left, right = [], []
    for i, p in enumerate(line):
        d = (line[min(i + 1, len(line) - 1)] - line[max(i - 1, 0)]).normalized()
        nrm = Vector((-d.y, d.x)) * t / 2
        left.append(tuple(p + nrm))
        right.append(tuple(p - nrm))
    return left + right[::-1]


XZ = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))         # local (x, y, z) -> world (x, -z, y): outline upright, depth to the viewer


def at(x, y, z, m=XZ):
    return Matrix.Translation((x, y, z)) @ m


T = 1.6                                                     # sheet
RUB = 0.8                                                   # rubber lining
yb = BACK + GAP + RUB + T / 2                               # the sheet's middle plane behind the Core
xs = HX + GAP + RUB + T / 2                                 # ... beside it
yf = FRONT - GAP - RUB - T / 2                              # ... in front of it
Z0 = 8.0                                                    # arms are this far above the Core's middle: clear of the port underneath
# the bracket: a centre plate and four arms, one bent sheet
prism("plate", [rrect(50, 66, 10), *[circle(2.6, 32, sx * 17, sy * 24) for sx in (-1, 1) for sy in (-1, 1)]], T + 0.8, "frame", HOLD, at(0, yb + 0.35, 0), 0.5)
for sx in (-1, 1):
    for sz in (-1, 1):
        w, z = 11.0, sz * 24.0
        # outline in (x, y) plane, extruded along z
        out = bent([(sx * 20, yb, 0), (sx * xs, yb, 2.6), (sx * xs, yf, 1.6), (sx * (HX - 3.6), yf, 0)], T)
        prism(f"arm{sx}{sz}", [out], w, "frame", HOLD, Matrix.Translation((0, 0, z)), 0.4)
        lin = bent([(sx * 26, BACK + GAP + RUB / 2, 0), (sx * (HX + GAP + RUB / 2), BACK + GAP + RUB / 2, 1.6), (sx * (HX + GAP + RUB / 2), FRONT - GAP - RUB / 2, 0.9), (sx * (HX - 3.3), FRONT - GAP - RUB / 2, 0)], RUB)
        prism(f"lining{sx}{sz}", [lin], w + 1.0, "rubber", HOLD, Matrix.Translation((0, 0, z)), 0.2, 2)
prism("pad", [rrect(40, 40, 6)], RUB, "rubber", HOLD, at(0, BACK + GAP + RUB / 2, 0), 0.3, 2)
for sx in (-1, 1):                                          # security screws in the plate's holes
    for sz in (-1, 1):
        prism(f"screw{sx}{sz}", [circle(4.2, 40, sx * 17, sz * 24), circle(1.5, 6, sx * 17, sz * 24)], 2.0, "steel", HOLD, at(0, yb + T / 2 + 1.75, 0), 0.5)
        prism(f"socket{sx}{sz}", [circle(2.4, 24, sx * 17, sz * 24)], 1.0, "dark", HOLD, at(0, yb + T / 2 + 1.3, 0))
# head: boss behind the plate, clamp, bent tube, base
yh = yb + T / 2 + 0.75
ROT = Matrix.Rotation(-math.pi / 2, 4, "X")                 # local z -> +y (away from the viewer)
lathe("boss", [(0, 0), (17, 0), (17, 5.4), (16.8, 6.2), (16.2, 6.8), (15.4, 7), (0, 7)], "frame", HOLD, Matrix.Translation((0, yh, 0)) @ ROT)
lathe("collar", [(10.5, 6.5), (10.5, 13.6), (10.3, 14.4), (9.7, 15), (9, 15), (7.05, 15)], "frame", HOLD, Matrix.Translation((0, yh, 0)) @ ROT)
R, BASE_Z, ty = 7.0, -108.0, yh + 40.0
pts = [(0, yh + 6, 0), (0, yh + 14, 0)]
rad = ty - (yh + 14)
for k in range(1, 25):
    a = math.pi / 2 * k / 24
    pts.append((0, yh + 14 + rad * math.sin(a), -rad * (1 - math.cos(a))))
pts += [(0, ty, -rad - 4), (0, ty, BASE_Z + 8)]
tube("tube", pts, R, "frame", HOLD, 48)
bolt = prism("grub", [circle(2.6, 32), circle(1.3, 6)], 2.0, "steel", HOLD, Matrix.Translation((10.5, yh + 10.5, 0)) @ Matrix.Rotation(math.pi / 2, 4, "Y"), 0.4)
B = 46.0
lathe("foot", [(B - 2.5, -1.6), (B - 1.4, -1.6), (B - 1.4, 0.4)], "rubber", HOLD, Matrix.Translation((0, ty - 18, BASE_Z)), 128)
lathe("base", [(0, 0), (B - 0.7, 0), (B - 0.2, 0.2), (B, 0.8), (B, 3.2), (B - 0.2, 4.0), (B - 0.7, 4.6), (B - 1.4, 4.9), (B - 2.2, 5.0), (0, 5.0)], "frame", HOLD, Matrix.Translation((0, ty - 18, BASE_Z)), 128)
lathe("flange", [(17, 5), (17, 6.2), (16.7, 6.9), (16, 7.2), (11.2, 7.2), (10.5, 7.5), (10.2, 8.2), (10.2, 16), (9.9, 16.7), (9.2, 17), (R + 0.05, 17)], "frame", HOLD, Matrix.Translation((0, ty, BASE_Z)))
for a in (90, 210, 330):
    x, y = 34 * math.cos(math.radians(a)), ty - 18 + 34 * math.sin(math.radians(a))
    lathe(f"bs{a}", [(3.8, 5.0), (3.6, 5.9), (2.9, 6.3), (1.7, 6.4), (1.5, 6.2), (1.5, 5.5), (0, 5.5)], "steel", HOLD, Matrix.Translation((x, y, BASE_Z)), 40)
# USB-C plug: overmould and metal tongue, along -z from the port's face (local origin = the face's middle); the cable itself is drawn by the page
prism("mould", [rrect(11.6, 6.0, 2.7, 12)], 19.0, "cable", PLUG, Matrix.Translation((0, 0, -0.15 - 9.5)), 0.9, 4)
lathe("relief", [(2.95, -19), (2.9, -20), (2.75, -20.4), (2.75, -21.2), (2.95, -21.5), (2.95, -22.5), (2.7, -22.9), (2.6, -23.7), (2.75, -24), (2.75, -25), (2.45, -25.4), (2.35, -26.4), (2.5, -26.7), (2.4, -28), (2.0, -28.6), (1.9, -28.7)], "cable", PLUG, Matrix(), 40)
prism("tongue", [rrect(8.2, 2.42, 1.2, 10), rrect(7.0, 1.12, 0.3, 4)], 5.0, "steel", PLUG, Matrix.Translation((0, 0, 1.9)), 0.1, 2)   # hollow: the port's tongue goes inside

# modifiers into meshes, join per group and material
deps = bpy.context.evaluated_depsgraph_get()
bpy.context.view_layer.update()
joined = {}
for grp, lst in (("hold", HOLD), ("plug", PLUG)):
    for o in lst:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(deps), preserve_all_data_layers=True, depsgraph=deps)
        n = bpy.data.objects.new("x-" + o.name, me)
        scene.collection.objects.link(n)
        joined.setdefault((grp, o.data.materials[0].name), []).append(n)
        bpy.data.objects.remove(o)


def only(sel):
    bpy.ops.object.select_all(action="DESELECT")
    for o in sel:
        o.select_set(True)
    bpy.context.view_layer.objects.active = sel[0]


for key, lst in list(joined.items()):
    only(lst)
    if len(lst) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = o.data.name = "-".join(key)
    joined[key] = o
    print("PART", o.name, "tris", sum(len(p.vertices) - 2 for p in o.data.polygons))
for o in joined.values():
    me = o.data
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    uv = me.uv_layers.new(name="grain")
    for p in me.polygons:
        n = p.normal
        ax = max(range(3), key=lambda a: abs(n[a]))
        u, v = [(1, 2), (0, 2), (0, 1)][ax]
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co[u] / 6.0, co[v] / 6.0)
AO = [o for (grp, _), o in joined.items() if grp == "hold"]
for o in AO:
    o.data.uv_layers.new(name="ao")
    o.data.uv_layers.active = o.data.uv_layers["ao"]
only(AO)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.006, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bpy.ops.object.mode_set(mode="OBJECT")

# AO with a stand-in for the Core in the holder, and the holder's own ground shadow
core = prism("core", [rrect(2 * HX, 2 * HZ, 12)], BACK - FRONT, "stand-in", [], at(0, (BACK + FRONT) / 2, 0))
bpy.ops.mesh.primitive_plane_add(size=360, location=(0, ty - 18, BASE_Z - 1.6))
plane = bpy.context.active_object
plane.data.materials.append(mat("ground"))
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 256
scene.world = bpy.data.worlds.new("w")
img = bpy.data.images.new("ao-props", 1024, 1024)
gimg = bpy.data.images.new("gr-props", 512, 512)
for i in (img, gimg):
    i.colorspace_settings.name = "Non-Color"
for m in {o.data.materials[0] for o in AO} | {mat("ground")}:
    n = m.node_tree.nodes.new("ShaderNodeTexImage")
    n.image = gimg if m is mat("ground") else img
    m.node_tree.nodes.active = n
scene.world.light_settings.distance = 40.0
only(AO)
bpy.ops.object.bake(type="AO", margin=8, use_clear=True)
scene.world.light_settings.distance = 130.0
only([plane])
bpy.ops.object.bake(type="AO", margin=2, use_clear=True)
for i in (img, gimg):
    i.filepath_raw = str(OUT / (i.name + ".png"))
    i.file_format = "PNG"
    i.save()
for m in {o.data.materials[0] for o in AO} | {mat("ground")}:
    for n in [n for n in m.node_tree.nodes if n.type == "TEX_IMAGE"]:
        m.node_tree.nodes.remove(n)
bpy.data.objects.remove(plane)
bpy.data.objects.remove(core)
for o in joined.values():
    o.data.uv_layers["grain"].active_render = True
roots = {}
for (grp, _), o in joined.items():
    if grp not in roots:
        roots[grp] = bpy.data.objects.new(grp, None)
        scene.collection.objects.link(roots[grp])
    o.parent = roots[grp]
out = OUT / "props.glb"
bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_yup=True, export_apply=False, export_normals=True,
                          export_texcoords=True, export_materials="EXPORT", export_animations=False, export_skins=False, export_morph=False,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                          export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12)
print("GLB", out, out.stat().st_size, "base z", BASE_Z - 1.6, "base centre y", ty - 18)
