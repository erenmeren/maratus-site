"""One compact GLB per Dock (BAR, TILE, MONO), Core on it, for the Docks page. Real CAD: maratus-hardware/mechanical/dock-lens-*/ (read only).

  TMPDIR=.work/tmp /Applications/Blender.app/Contents/MacOS/Blender -b -P site/tools/export_docks.py -- key=tile out=DIR hw=~/Projects/maratus-hardware [noao]
  DIR gets dock-KEY.glb, ao-KEY.png, gr-KEY.png.

Parts and materials follow the Dock's scene.json. Re-uses site_render.py for the ports (USB-C, RJ45) and export_glb.py's recipe: join per
material, UV 0 = cube projection for the grain, UV 1 = AO atlas, Draco, millimetres. What cannot be seen with the Core on is left out: boards,
magnets, pins and pads, lock bolt and nut, screws from below (but BAR's one). The ports, drawn for BAR, move with the port drawer, which is the same part in all three.
The Core is kept in BAR's frame and its node carries the move to this Dock, found from scene.json and checked on the Core's own vertices.
"""
import json
import math
import pathlib
import sys

import bpy
from mathutils import Matrix, Vector, kdtree

SITE = pathlib.Path(__file__).resolve().parents[1]
CAD = SITE.parent / "cad-src"
OPT = dict(a.split("=", 1) for a in sys.argv if "=" in a)
KEY, HW = OPT["key"], pathlib.Path(OPT["hw"]).expanduser() / "mechanical"
OUT = pathlib.Path(OPT["out"]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
SRC, BAR = HW / f"dock-lens-{KEY}", HW / "dock-lens-bar"
SPEC = json.loads((SRC / "scene.json").read_text())
BARSPEC = json.loads((BAR / "scene.json").read_text())
# parts that take the pair's second colour. BAR and TILE as in scene.json; MONO's scene.json has one colour, its second goes on the plates.
ACCENT = {"bar": {"cap-left", "cap-right"}, "tile": {"plate"}, "mono": {"plate", "drawer"}}[KEY]
src = (CAD / "tools" / "site_render.py").read_text().split("\nctx = build()")[0]
g = {"__file__": str(CAD / "tools" / "site_render.py"), "__name__": "site_render"}
exec(compile(src, "site_render.py", "exec"), g)
Kit, S, frame, Z = g["Kit"], g["S"], g["frame"], Vector((0, 0, 1))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
mats = {}


def mat(name):
    if name not in mats:
        mats[name] = bpy.data.materials.new(name)
        mats[name].use_nodes = True
    return mats[name]


def stl(folder, part):
    bpy.ops.wm.stl_import(filepath=str(folder / f"{part}.stl"), global_scale=S)
    o = bpy.context.selected_objects[0]
    o.data.transform(Matrix.Diagonal(o.scale).to_4x4())
    o.scale = (1, 1, 1)
    return o


def drop(o):
    bpy.data.objects.remove(o)


def worst(a, b, m):
    """Largest distance from a vertex of `a`, moved by m, to the nearest vertex of `b`, in mm."""
    t = kdtree.KDTree(len(b.data.vertices))
    for i, v in enumerate(b.data.vertices):
        t.insert(v.co / S, i)
    t.balance()
    return max(t.find(m @ (v.co / S))[2] for v in a.data.vertices)


# BAR frame -> this Dock's frame, for the Core: a turn about x and a shift, from the screen's corners in the two scene.json
p, q = ([Vector(c) for c in s["screen"]] for s in (BARSPEC, SPEC))
ang = lambda s: math.atan2(s[3].z - s[0].z, s[3].y - s[0].y)
X = Matrix.Rotation(ang(q) - ang(p), 4, "X")
X.translation = q[0] - X.to_3x3() @ p[0]
a, b = stl(BAR, "core-body"), stl(SRC, "core-body")
print(f"CORE moved {math.degrees(ang(q) - ang(p)):+.3f} deg, {tuple(round(v, 3) for v in X.translation)}; worst vertex {worst(a, b, X):.4f} mm")
drop(a)
drop(b)
a, b = stl(BAR, "drawer"), stl(SRC, "drawer")
lo = lambda o: Vector([min(v.co[k] for v in o.data.vertices) / S for k in range(3)])
shift = lo(b) - lo(a)
print(f"DRAWER moved {tuple(round(v, 3) for v in shift)}; worst vertex {worst(a, b, Matrix.Translation(shift)):.4f} mm")
drop(a)
drop(b)

objs = {}
SKIP = {"core-magnets", "dock-magnets", "base-board", "dock-contact"}
for part, m in SPEC["parts"].items():
    if part in SKIP:
        continue
    o = stl(SRC, part)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_auto_smooth(angle=0.5)
    o.data.materials.append(mat("accent" if part in ACCENT else m))
    objs[part] = o

hw = {k: mat(v) for k, v in {"steel": "steel", "bolt": "steel-dark", "black": "black", "tongue": "black", "gold-in": "gold", "gold": "gold", "led-g": "led-g", "led-a": "led-a"}.items()}
x, y = Vector((1, 0, 0)), Vector((0, 1, 0))
root = bpy.data.objects.new("root", None)
scene.collection.objects.link(root)
move = Matrix.Translation(shift)
g["usb_c"](Kit(objs, "usb-dock", move @ frame(-x, Z, y, (16.5, 59.18, 20.73)), root), hw, 0.12)
g["rj45"](Kit(objs, "rj45", move @ frame(-x, Z, y, (-13.95, 59.18, 25.875)), root), hw)
g["usb_c"](Kit(objs, "core-usb", X @ g["CORE"] @ frame(x, Z, -y, (57, -74.59, 1.73)), root), hw, 0.12)
if KEY == "bar":                                                 # its screw hole comes out on the round belly and is seen from behind
    g["drawer_screw"](Kit(objs, "drawer-screw", frame(x, y, Z, (8.60, 48.88, 0)), root), hw)
mesh = bpy.data.meshes.new("screen")
mesh.from_pydata([tuple(c * S for c in pt) for pt in SPEC["screen"]], [], [(0, 1, 2, 3)])
uv = mesh.uv_layers.new()
for loop, co in zip(uv.data, ((0, 0), (1, 0), (1, 1), (0, 1))):
    loop.uv = co
mesh.materials.append(mat("screen"))
objs["screen"] = bpy.data.objects.new("screen", mesh)
scene.collection.objects.link(objs["screen"])

deps = bpy.context.evaluated_depsgraph_get()
bpy.context.view_layer.update()
groups = {}
for name, o in objs.items():
    me = bpy.data.meshes.new_from_object(o.evaluated_get(deps), preserve_all_data_layers=True, depsgraph=deps)
    me.transform(Matrix.Scale(1 / S, 4) @ o.matrix_world)
    m = o.data.materials[0]
    me.materials.clear()
    me.materials.append(m)
    n = bpy.data.objects.new("x-" + name, me)
    scene.collection.objects.link(n)
    groups.setdefault(("core" if name.startswith("core") or name == "screen" else "dock", m.name), []).append(n)
for o in [*objs.values(), root]:
    drop(o)


def only(sel):
    bpy.ops.object.select_all(action="DESELECT")
    for o in sel:
        o.select_set(True)
    bpy.context.view_layer.objects.active = sel[0]


joined = {}
for (grp, m), lst in groups.items():
    only(lst)
    if len(lst) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = o.data.name = f"{grp}-{m}"
    joined[(grp, m)] = o
    print("PART", o.name, "tris", sum(len(f.vertices) - 2 for f in o.data.polygons))

INV = X.inverted()
for (grp, m), o in joined.items():
    if m == "screen":
        continue
    me = o.data
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    uv = me.uv_layers.new(name="grain")
    t = INV if grp == "core" else Matrix.Identity(4)             # the Core's grain lies the same way on every Dock
    for f in me.polygons:
        n = t.to_3x3() @ f.normal
        ax = max(range(3), key=lambda k: abs(n[k]))
        i, j = [(1, 2), (0, 2), (0, 1)][ax]
        for li in f.loop_indices:
            co = t @ me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co[i] / 6.0, co[j] / 6.0)

AO = [joined[k] for k in (("core", "body"), ("dock", "body"), ("dock", "accent"))]
for o in AO:
    o.data.uv_layers.active = o.data.uv_layers.new(name="ao")
only(AO)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.006, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bpy.ops.object.mode_set(mode="OBJECT")

GY = round(SPEC["size"][1] / 2)                                  # the ground picture's middle, behind the front (js/docks.js: gz)
if "noao" not in sys.argv:
    bpy.ops.mesh.primitive_plane_add(size=360, location=(0, GY, -0.05))
    plane = bpy.context.active_object
    plane.data.materials.append(mat("ground"))
    scene.world = bpy.data.worlds.new("w")
    scene.render.engine = "CYCLES"
    scene.cycles.samples, scene.cycles.use_adaptive_sampling, scene.cycles.device = 320, False, "CPU"
    scene.render.bake.margin = 8
    for name, size, dist, sel in ((f"ao-{KEY}", 2048, 45.0, AO), (f"gr-{KEY}", 512, 130.0, [plane])):
        img = bpy.data.images.new(name, size, size, alpha=False, float_buffer=False)
        img.colorspace_settings.name = "Non-Color"
        nodes = []
        for m in {o.data.materials[0] for o in sel}:
            n = m.node_tree.nodes.new("ShaderNodeTexImage")
            n.image = img
            m.node_tree.nodes.active = n
            nodes.append((m, n))
        scene.world.light_settings.distance = dist
        only(sel)
        bpy.ops.object.bake(type="AO", margin=8 if sel is AO else 2, use_clear=True)
        img.filepath_raw, img.file_format = str(OUT / f"{name}.png"), "PNG"
        img.save()
        for m, n in nodes:
            m.node_tree.nodes.remove(n)
    drop(plane)

for o in AO:
    o.data.uv_layers.active = o.data.uv_layers["grain"]
    o.data.uv_layers["grain"].active_render = True
node = {k: bpy.data.objects.new(k, None) for k in ("dock", "core")}
for e in node.values():
    scene.collection.objects.link(e)
node["core"].matrix_world = X
for (grp, m), o in joined.items():
    if grp == "core":
        o.data.transform(INV)
    o.parent = node[grp]
out = OUT / f"dock-{KEY}.glb"
bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_yup=True, export_apply=False, export_normals=True,
                          export_texcoords=True, export_materials="EXPORT", export_animations=False, export_skins=False, export_morph=False,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                          export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12)
print("GLB", out.name, out.stat().st_size, "ground middle", GY)
