"""Device GLB for the website from the CAD scene.

  TMPDIR=.work/tmp /Applications/Blender.app/Contents/MacOS/Blender -b -P site/tools/export_glb.py -- stills out=DIR [noao]
  (run Blender from the app bundle: the Draco library is found relative to it)
  DIR gets maratus.glb, ao-docked.png, ao-apart.png, gr-docked.png, gr-apart.png. cad-src/ is only read.

Re-uses site_render.py's build() (geometry, contacts, ports). Then: lower lathe resolution, drop the internal board,
join per group and material, two UV sets (0: cube projection for the surface grain, 1: atlas for baked AO), bake AO in
the docked pose, export Draco GLB in millimetres.
"""
import math
import pathlib
import sys

import bpy
from mathutils import Matrix, Vector

CAD = pathlib.Path(__file__).resolve().parents[2] / "cad-src"
HERE = pathlib.Path(next(a[4:] for a in sys.argv if a.startswith("out="))).resolve()
HERE.mkdir(parents=True, exist_ok=True)
src = (CAD / "tools" / "site_render.py").read_text().split("\nctx = build()")[0]
g = {"__file__": str(CAD / "tools" / "site_render.py"), "__name__": "site_render"}
exec(compile(src, "site_render.py", "exec"), g)

Kit = g["Kit"]
_lathe, _threaded = Kit.lathe, g["threaded"]


def lathe(self, name, cu, cv, profile, mat, n=32, a0=0.0):
    if self.tag == "pogo":
        n = {"c": 28, "b": 32, "g": 20, "p": 32}[name[0]]
        if len(profile) > 12:                                   # thin out the fine arcs
            profile = profile[:2] + profile[2:-2][::2] + profile[-2:]
    return _lathe(self, name, cu, cv, profile, mat, n, a0)


def threaded(kit, name, r, w0, w1, mat, pitch=0.7, depth=0.40, tip=None, mouth=None, n=64):
    if name == "thread":                                        # the nut: its crests stay clear of the drawn bolt, which leaves without turning
        r = 2.46
    return _threaded(kit, name, r, w0, w1, mat, pitch, depth, tip, mouth, 28)


Kit.lathe = lathe
g["threaded"] = threaded
ctx = g["build"]()
S = g["S"]
objs = ctx["objs"]
scene = ctx["scene"]

# material name -> exported material
MAP = {"body": "body", "body-xray": "body", "core-body-xray": "body", "accent": "accent", "glass": "glass", "dark": "black",
       "steel": "steel", "magnet": "magnet", "hw-steel": "steel", "hw-gold": "gold", "hw-gold-in": "gold", "hw-barrel": "gold-barrel",
       "hw-plunger": "gold-plunger", "hw-pad": "gold-pad", "hw-housing": "housing", "hw-collar": "black", "hw-black": "black",
       "hw-tongue": "black", "hw-nickel": "steel", "hw-insulator-lip": "black", "hw-bolt": "steel-dark", "hw-nut": "steel",
       "hw-insulator": "black", "hw-led-g": "led-g", "hw-led-a": "led-a", "hw-tin": "steel", "hw-cap": "black", "screen": "screen",
       "hw-pcb": "black", "hw-nylon": "black"}

for name in [n for n in objs if n.startswith("base-board") or n.startswith("board-screw")]:
    bpy.data.objects.remove(objs.pop(name))

for o in list(scene.collection.all_objects):
    if o.type in {"LIGHT", "CAMERA"}:
        bpy.data.objects.remove(o)
ground = ctx["ground"]

core_names = {n for n, o in objs.items() if n.startswith("core") or n == "screen"} 
mats = {}


def mat(name):
    if name not in mats:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        mats[name] = m
    return mats[name]


# bake modifiers (auto smooth) and world transforms into meshes
deps = bpy.context.evaluated_depsgraph_get()
bpy.context.view_layer.update()
groups = {}
for name, o in objs.items():
    ev = o.evaluated_get(deps)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=deps)
    me.transform(Matrix.Scale(1 / S, 4) @ o.matrix_world)       # millimetres, Dock's frame
    old = o.data.materials[0].name if o.data.materials else "black"
    key = old.split(".")[0]
    out = MAP.get(key)
    if out is None:
        print("UNMAPPED", name, old)
        out = "black"
    me.materials.clear()
    me.materials.append(mat(out))
    n = bpy.data.objects.new("x-" + name, me)
    scene.collection.objects.link(n)
    part = "core" if name in core_names else "bolt" if name.startswith("bolt-") and name != "bolt-bore" else "dock"
    groups.setdefault((part, out), []).append(n)
for o in list(objs.values()):
    bpy.data.objects.remove(o)


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
    print("PART", o.name, "tris", sum(len(p.vertices) - 2 for p in o.data.polygons))

# UV 0: cube projection, 1 UV unit = 6 mm (grain)
for o in joined.values():
    if o.name.endswith("-screen"):
        continue
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

AO = [joined[k] for k in (("core", "body"), ("dock", "body"), ("dock", "accent"))]
for o in AO:
    o.data.uv_layers.new(name="ao")
    o.data.uv_layers.active = o.data.uv_layers["ao"]
only(AO)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.006, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bpy.ops.object.mode_set(mode="OBJECT")

if "noao" not in g["ARGS"]:
    bpy.data.objects.remove(ground)
    bpy.ops.mesh.primitive_plane_add(size=360, location=(0, 28, -0.05))
    plane = bpy.context.active_object
    plane.name = "ground"
    pm = mat("ground")
    plane.data.materials.append(pm)
    scene.world.light_settings.distance = 45.0
    scene.cycles.samples = 320
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.device = "CPU"                                 # the GPU is busy with the stills job
    scene.render.bake.margin = 8
    core_objs = [o for (grp, _), o in joined.items() if grp == "core"]
    for state in ("docked", "apart"):
        img = bpy.data.images.new("ao-" + state, 2048, 2048, alpha=False, float_buffer=False)
        img.colorspace_settings.name = "Non-Color"
        gimg = bpy.data.images.new("gr-" + state, 512, 512, alpha=False, float_buffer=False)
        gimg.colorspace_settings.name = "Non-Color"
        for m in {o.data.materials[0] for o in AO} | {pm}:
            n = m.node_tree.nodes.new("ShaderNodeTexImage")
            n.image = gimg if m is pm else img
            m.node_tree.nodes.active = n
        if state == "apart":
            for o in core_objs:
                o.location = (0, 0, 3000)
        scene.world.light_settings.distance = 45.0
        only(AO)
        bpy.ops.object.bake(type="AO", margin=8, use_clear=True)
        scene.world.light_settings.distance = 130.0
        only([plane])
        bpy.ops.object.bake(type="AO", margin=2, use_clear=True)
        for i in (img, gimg):
            i.filepath_raw = str(HERE / (i.name + ".png"))
            i.file_format = "PNG"
            i.save()
        for m in {o.data.materials[0] for o in AO} | {pm}:
            for n in [n for n in m.node_tree.nodes if n.type == "TEX_IMAGE"]:
                m.node_tree.nodes.remove(n)
    for o in core_objs:
        o.location = (0, 0, 0)
    bpy.data.objects.remove(plane)
else:
    bpy.data.objects.remove(ground)

for o in AO:                                                    # grain first, AO second
    o.data.uv_layers.active = o.data.uv_layers["grain"]
    o.data.uv_layers["grain"].active_render = True

dock = bpy.data.objects.new("dock", None)
core = bpy.data.objects.new("core", None)
bolt = bpy.data.objects.new("bolt", None)
for e in (dock, core, bolt):
    scene.collection.objects.link(e)
bolt.parent = dock
for (grp, m), o in joined.items():
    o.parent = {"core": core, "dock": dock, "bolt": bolt}[grp]
for o in list(scene.collection.all_objects):
    if o not in (dock, core, bolt) and o not in joined.values():
        bpy.data.objects.remove(o)

out = HERE / "maratus.glb"
bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_yup=True, export_apply=False, export_normals=True,
                          export_texcoords=True, export_materials="EXPORT", export_animations=False, export_skins=False, export_morph=False,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                          export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12)
print("GLB", out, out.stat().st_size)
