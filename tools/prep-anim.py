#!/usr/bin/env python3
"""Cut ability animation frames to match a hero's in-game idle image.

Usage: python3 tools/prep-anim.py <hero key> <master png> <frames dir>
  <frames dir> holds the delivered 1254-px frames named <key>_<slot>_<n>.png.
Writes assets/heroes/anim/<key>_<slot>_<n>.png and, when the hero has a hand-made tan figure, the tan version of each
frame under assets/heroes/tan/anim/. Prints one line per frame.

The idle image assets/heroes/<key>.png is the master cropped to its alpha > 8 box and scaled down. Each frame is
first shifted so its base plate (centre and baseline) sits exactly on the master's plate, then cut with a box whose
bottom is the idle crop's bottom and whose horizontal centre is the idle crop's centre, and scaled by the same factor.
The game draws a frame with the idle image's pixel scale, bottom-centred at the unit's feet, so the plate never jumps.
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TH = 8          # alpha threshold the idle crop was cut with
BAND = 120      # rows above the baseline treated as the base plate


def plate(im):
    """(centre x of the plate's solid pixels, baseline row) in this image's pixels."""
    a = np.asarray(im.getchannel('A'))
    rows = np.where((a > 128).sum(1) >= 16)[0]
    base = int(rows.max())
    band = a[max(0, base - BAND):base + 1] > 128
    _, xs = np.nonzero(band)
    return float(xs.mean()), base


def tan_lut(key):
    """Brightness -> tan colour table learned from the hero's own green and tan figures (same pose, same size).
    Green brightness is matched to tan brightness by rank, then tan brightness to the average tan colour at that brightness."""
    gp = os.path.join(ROOT, 'assets', 'heroes', key + '.png')
    tp = os.path.join(ROOT, 'assets', 'heroes', 'tan', key + '.png')
    if not os.path.exists(tp):
        return None
    g = np.asarray(Image.open(gp).convert('RGBA')).astype(np.float64)
    t = np.asarray(Image.open(tp).convert('RGBA')).astype(np.float64)
    lum = lambda a: a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114
    lg = np.sort(lum(g)[g[..., 3] > 200])
    tm = t[..., 3] > 200
    lt_all = lum(t)[tm]
    lt = np.sort(lt_all)
    q = np.linspace(0, 1, 256)
    # green level -> rank -> tan level
    g_at_q = np.quantile(lg, q)
    t_at_q = np.quantile(lt, q)
    levels = np.arange(256, dtype=np.float64)
    to_tan_level = np.interp(levels, g_at_q, t_at_q)
    # tan level -> mean tan RGB (bins of the tan figure's own pixels; gaps filled by interpolation)
    rgb = t[..., :3][tm]
    bins = np.clip(lt_all.round().astype(int), 0, 255)
    lut = np.zeros((256, 3))
    for c in range(3):
        s = np.bincount(bins, weights=rgb[:, c], minlength=256)
        n = np.bincount(bins, minlength=256)
        have = n > 0
        lut[:, c] = np.interp(levels, levels[have], s[have] / n[have])
    out = np.zeros((256, 3))
    for c in range(3):
        out[:, c] = np.interp(to_tan_level, levels, lut[:, c])
    return out


def apply_lut(im, lut):
    a = np.asarray(im.convert('RGBA')).astype(np.float64)
    l = np.clip((a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114).round().astype(int), 0, 255)
    o = a.copy()
    o[..., :3] = lut[l]
    return Image.fromarray(np.clip(o, 0, 255).astype(np.uint8), 'RGBA')


def box(im, th=TH):
    a = np.asarray(im.getchannel('A'))
    ys, xs = np.nonzero(a > th)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def main(key, master_path, frames_dir):
    master = Image.open(master_path).convert('RGBA')
    idle = Image.open(os.path.join(ROOT, 'assets', 'heroes', key + '.png'))
    x0, y0, x1, y1 = box(master)
    scale = idle.size[1] / (y1 - y0)
    ax = (x0 + x1) / 2.0
    mcx, mbase = plate(master)
    out_dir = os.path.join(ROOT, 'assets', 'heroes', 'anim')
    tan_dir = os.path.join(ROOT, 'assets', 'heroes', 'tan', 'anim')
    os.makedirs(out_dir, exist_ok=True)
    lut = tan_lut(key)
    if lut is not None:
        os.makedirs(tan_dir, exist_ok=True)
    names = sorted(f for f in os.listdir(frames_dir) if f.startswith(key + '_') and f.endswith('.png'))
    if not names:
        sys.exit('no frames named %s_<slot>_<n>.png in %s' % (key, frames_dir))
    for name in names:
        fr = Image.open(os.path.join(frames_dir, name)).convert('RGBA')
        fcx, fbase = plate(fr)
        dx, dy = mcx - fcx, mbase - fbase
        # shift the frame so its plate lands on the master's plate
        W, H = fr.size
        pad = 400
        canvas = Image.new('RGBA', (W + 2 * pad, H + 2 * pad), (0, 0, 0, 0))
        canvas.alpha_composite(fr, (pad + int(round(dx)), pad + int(round(dy))))
        bx0, by0, bx1, by1 = box(canvas)
        cx = ax + pad
        half = max(cx - bx0, bx1 - cx)
        top = min(by0, y0 + pad)
        bottom = y1 + pad
        crop = canvas.crop((int(round(cx - half)), top, int(round(cx + half)), bottom))
        w = max(1, int(round(crop.size[0] * scale)))
        h = max(1, int(round(crop.size[1] * scale)))
        out = crop.resize((w, h), Image.LANCZOS)
        out.save(os.path.join(out_dir, name), optimize=True)
        if lut is not None:
            apply_lut(out, lut).save(os.path.join(tan_dir, name), optimize=True)
        print('%s  plate shift (%+.1f, %+d) px  -> %dx%d (idle %dx%d)' % (name, dx, dy, w, h, idle.size[0], idle.size[1]))


if __name__ == '__main__':
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
