# Original app icon: a green fish hook on navy. Run: python3 tools/make_icons.py
from PIL import Image, ImageDraw
for size in (192, 512, 180):
    s = size / 512
    im = Image.new("RGB", (size, size), "#0f1720")
    d = ImageDraw.Draw(im)
    w = max(2, int(34 * s))
    g = "#3ddc97"
    d.line([(256*s, 90*s), (256*s, 330*s)], fill=g, width=w)                       # shank
    d.arc([(146*s, 250*s), (366*s, 450*s)], start=0, end=180, fill=g, width=w)      # bend
    d.line([(146*s, 350*s), (146*s, 300*s)], fill=g, width=w)                       # point
    d.polygon([(146*s, 270*s), (120*s, 318*s), (172*s, 318*s)], fill=g)             # barb
    d.ellipse([(226*s, 60*s), (286*s, 120*s)], outline=g, width=w)                  # eye
    name = "apple-touch-icon.png" if size == 180 else f"icon-{size}.png"
    im.save(f"icons/{name}")
print("icons written")
