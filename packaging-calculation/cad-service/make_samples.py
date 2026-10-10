"""Builds a few sample STEP parts for testing (python make_samples.py)."""
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox, BRepPrimAPI_MakeCylinder, BRepPrimAPI_MakeCone
from OCP.BRepAlgoAPI import BRepAlgoAPI_Fuse, BRepAlgoAPI_Cut
from OCP.STEPControl import STEPControl_Writer, STEPControl_AsIs
from OCP.gp import gp_Pnt, gp_Ax2, gp_Dir

def save(shape, name):
    w = STEPControl_Writer(); w.Transfer(shape, STEPControl_AsIs); w.Write(f"samples/{name}.step")

def box(x, y, z, l, w, h): return BRepPrimAPI_MakeBox(gp_Pnt(x, y, z), l, w, h).Shape()
def cyl(x, y, z, r, h, d=(0, 0, 1)): return BRepPrimAPI_MakeCylinder(gp_Ax2(gp_Pnt(x, y, z), gp_Dir(*d)), r, h).Shape()
fuse = lambda a, b: BRepAlgoAPI_Fuse(a, b).Shape()
cut = lambda a, b: BRepAlgoAPI_Cut(a, b).Shape()

# Clamp: base plate + stem + wide top plate with a boss (similar size to the reference part, 66×38×65 mm)
clamp = fuse(fuse(box(8, 4, 0, 50, 30, 8), box(22, 9, 8, 22, 20, 40)), box(0, 0, 48, 66, 38, 9))
clamp = cut(fuse(clamp, cyl(33, 19, 57, 7, 8)), cyl(33, 19, 0, 3, 70))
save(clamp, "clamp")

# Flange: Ø120 disc, hub and 4 bolt holes
flange = fuse(cyl(60, 60, 0, 60, 12), cyl(60, 60, 12, 25, 30))
flange = cut(flange, cyl(60, 60, 0, 15, 50))
for x, y in [(60, 15), (60, 105), (15, 60), (105, 60)]:
    flange = cut(flange, cyl(x, y, 0, 5, 20))
save(flange, "flange")

# L-bracket 120×80×60
bracket = cut(fuse(box(0, 0, 0, 120, 80, 6), box(0, 0, 0, 6, 80, 60)), cyl(60, 40, 0, 8, 10))
save(bracket, "bracket")
# Stackable tray: tapered round tray (outer Ø160→Ø200, 40 high, 3 mm wall) — nests in a column
tray = cut(BRepPrimAPI_MakeCone(gp_Ax2(gp_Pnt(100, 100, 0), gp_Dir(0, 0, 1)), 80, 100, 40).Shape(),
           BRepPrimAPI_MakeCone(gp_Ax2(gp_Pnt(100, 100, 3), gp_Dir(0, 0, 1)), 77, 97, 40).Shape())
save(tray, "tray")

print("samples written")
