# Desenha os quadros do vídeo sintético (quadra, jogadores com a cor da camiseta, bola) e codifica em VP9 + Opus (MP4).
import sys, json, subprocess
from PIL import Image, ImageDraw
d = json.load(open(sys.argv[1])); W, H, fps = d["W"], d["H"], d["fps"]
base = Image.new("RGB", (W, H), (46, 110, 78)); g = ImageDraw.Draw(base)
g.rectangle([0, 0, W, int(H * 0.36)], fill=(70, 80, 90))
for a, b in d["linhas"]:
    g.line([a[0] * W, a[1] * H, b[0] * W, b[1] * H], fill=(235, 235, 235), width=2)
ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                       "-f", "s16le", "-ar", "48000", "-ac", "1", "-i", sys.argv[3], "-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "1500k",
                       "-g", "60", "-c:a", "libopus", "-b:a", "64k", "-shortest", sys.argv[2]], stdin=subprocess.PIPE)
OSSOS = [(11, 12), (11, 13), (13, 15), (12, 14), (14, 16), (11, 23), (12, 24), (23, 24), (23, 25), (25, 27), (24, 26), (26, 28), (0, 11), (0, 12)]
for k, q in enumerate(d["quadros"]):
    im = base.copy(); g = ImageDraw.Draw(im)
    if q:
        for j in q["j"]:
            lm = j["lm"]
            if not lm: continue
            P = [(x * W, y * H) for x, y in lm]
            alt = abs(P[0][1] - P[27][1]) or 10; lw = max(2, int(alt / 14))
            for a, b in OSSOS: g.line([P[a], P[b]], fill=(225, 195, 160), width=lw)
            cor = tuple(int(c) for c in j["cor"])
            g.polygon([P[11], P[12], P[24], P[23]], fill=cor)
            r = max(2, alt / 12); g.ellipse([P[0][0] - r, P[0][1] - r, P[0][0] + r, P[0][1] + r], fill=(225, 195, 160))
        for x, y in q["b"]:
            r = 3.2; g.ellipse([x * W - r, y * H - r, x * W + r, y * H + r], fill=(222, 240, 60))
    if d.get("inv"):  # câmera na mão: o quadro parado levado pela rotação da câmera
        im = im.transform((W, H), Image.PERSPECTIVE, d["inv"][k], resample=Image.BILINEAR, fillcolor=(46, 110, 78))
    ff.stdin.write(im.tobytes())
ff.stdin.close(); ff.wait()
