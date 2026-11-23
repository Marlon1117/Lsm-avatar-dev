#!/usr/bin/env python3
"""
renderizar_video.py — Renderiza muestras del dataset de prueba como video MP4
del avatar (con subtítulo de glosa y frase), usando el MISMO avatar-lsm.js
del widget en un navegador sin interfaz.

Requisitos:  pip install playwright && playwright install chromium ;  ffmpeg
Uso:
    python renderizar_video.py --ids F01_S01 F02_S01 F03_S01
    python renderizar_video.py --todas
"""
import argparse
import asyncio
import base64
import glob
import json
import os
import shutil
import subprocess
import tempfile

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PRUEBA = os.path.join(BASE, "dataset", "prueba")

JS = r"""
async ([m, W, H]) => {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); const out = [];
  const ms = 1000 / m.fps;
  for (let i = 0; i < m.frames.length; i++) {
    AvatarLSM.dibujar(x, m.frames[i], { t: i * ms });
    // subtítulos
    const g = m.etiquetas_frame[i];
    x.fillStyle = 'rgba(16,24,32,.78)'; x.fillRect(0, H - 92, W, 92);
    x.fillStyle = '#ffffff'; x.font = '600 26px Arial'; x.textAlign = 'center';
    x.fillText(g.startsWith('<') ? '' : g.replace('DT-', 'dactilología: '), W / 2, H - 52);
    x.fillStyle = '#c9d6cf'; x.font = '18px Arial';
    x.fillText(m.frase, W / 2, H - 20);
    x.textAlign = 'left'; x.fillStyle = 'rgba(0,0,0,.45)'; x.font = '14px Arial';
    x.fillText(m.id + ' · sintético, no validado', 12, 22);
    out.push(c.toDataURL('image/png'));
  }
  return out;
}
"""


async def renderizar(ids, W=640, H=600):
    from playwright.async_api import async_playwright
    avatar = open(os.path.join(BASE, "web", "avatar-lsm.js"), encoding="utf-8").read()
    os.makedirs(os.path.join(PRUEBA, "videos"), exist_ok=True)
    async with async_playwright() as p:
        kw = {"args": ["--no-sandbox"]}
        if shutil.which("google-chrome"):
            kw["executable_path"] = shutil.which("google-chrome")
        b = await p.chromium.launch(**kw)
        pg = await b.new_page()
        await pg.set_content("<html><body></body></html>")
        await pg.add_script_tag(content=avatar)
        for id_ in ids:
            m = json.load(open(os.path.join(PRUEBA, "muestras", id_ + ".json"), encoding="utf-8"))
            imgs = await pg.evaluate(JS, [m, W, H])
            tmp = tempfile.mkdtemp()
            for i, u in enumerate(imgs):
                with open(os.path.join(tmp, f"{i:05d}.png"), "wb") as f:
                    f.write(base64.b64decode(u.split(",")[1]))
            salida = os.path.join(PRUEBA, "videos", id_ + ".mp4")
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(m["fps"]), "-i", os.path.join(tmp, "%05d.png"),
                            "-vf", "fps=30", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", salida], check=True)
            shutil.rmtree(tmp)
            print("  ✓", os.path.relpath(salida, BASE), f"({len(imgs)} frames)")
        await b.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", nargs="*", default=["F01_S01", "F02_S01", "F03_S01"])
    ap.add_argument("--todas", action="store_true")
    a = ap.parse_args()
    ids = [os.path.basename(p)[:-5] for p in sorted(glob.glob(os.path.join(PRUEBA, "muestras", "*.json")))] if a.todas else a.ids
    asyncio.run(renderizar(ids))


if __name__ == "__main__":
    main()
