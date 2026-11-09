#!/usr/bin/env python3
"""Export store artwork at the documented Chrome Web Store tile sizes."""
from pathlib import Path
from PIL import Image, ImageOps
ROOT=Path(__file__).resolve().parents[1]
store=ROOT/'tmproxy/store'
master=Image.open(store/'tmproxy-artwork-master.png').convert('RGB')
for name,size in [('promo-440x280.png',(440,280)),('marquee-1400x560.png',(1400,560))]:
    contained=ImageOps.contain(master,size,Image.Resampling.LANCZOS)
    canvas=Image.new('RGB',size,'white')
    canvas.paste(contained,((size[0]-contained.width)//2,(size[1]-contained.height)//2))
    canvas.save(store/name)
icon=Image.open(ROOT/'tmproxy/assets/globe-master.png').convert('RGBA')
# 96px artwork + transparent padding for the 128px store icon.
canvas=Image.new('RGBA',(128,128),(0,0,0,0))
canvas.alpha_composite(icon.resize((96,96),Image.Resampling.LANCZOS),(16,16))
canvas.save(store/'icon-128.png')
print(store)
