from PIL import Image, ImageDraw, ImageFont

S = 2
W = 1600 * S
HEADER = 58 * S
ROW = 150 * S
FOOT = 46 * S
LW = 180 * S
COLS = ["Trigger", "Context", "Input", "AI", "Processing", "Output"]
CW = (W - LW) / len(COLS)
BG = (28, 28, 30)
GRID = (52, 52, 58)
WHITE = (240, 240, 242)
GREY = (170, 170, 178)
ARROW = (140, 140, 150)

import os
# Linux (Liberation) or macOS (Arial)
FONTS = [("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
         ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf")]
REG, BOLD = next(f for f in FONTS if os.path.exists(f[0]))
def font(sz, bold=False):
    return ImageFont.truetype(BOLD if bold else REG, int(sz * S))

ROWS = [
    ("Scheduler", "(Vercel Cron)", (110, 155, 255)),
    ("System", "(Vercel + Next.js)", (79, 209, 122)),
    ("Live sources", "(public web)", (63, 208, 192)),
    ("AI", "(Gemini 3.7 Flash)", (255, 154, 77)),
    ("Data store", "(Neon Postgres)", (165, 139, 255)),
    ("Dashboard", "(Next.js, read-only)", (255, 111, 156)),
    ("Founder", "(Vikram)", (242, 201, 76)),
]
NR = len(ROWS)
H = HEADER + NR * ROW + FOOT

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

def tint(c, a=0.10):
    return tuple(int(BG[i] * (1 - a) + c[i] * a) for i in range(3))

# header
d.rectangle([0, 0, W, HEADER], fill=(27, 27, 31))
d.text((LW / 2, HEADER / 2), "Actor", font=font(17, True), fill=WHITE, anchor="mm")
for i, name in enumerate(COLS):
    d.text((LW + CW * i + CW / 2, HEADER / 2), name, font=font(17, True), fill=WHITE, anchor="mm")

# rows
for r, (name, sub, col) in enumerate(ROWS):
    y0 = HEADER + r * ROW
    d.rectangle([LW, y0, W, y0 + ROW], fill=tint(col))
    d.rectangle([0, y0, LW, y0 + ROW], fill=(33, 33, 36))
    d.text((LW / 2, y0 + ROW / 2 - 9 * S), name, font=font(17, True), fill=WHITE, anchor="mm")
    d.text((LW / 2, y0 + ROW / 2 + 12 * S), sub, font=font(12), fill=GREY, anchor="mm")
    d.line([0, y0, W, y0], fill=GRID, width=S)
for i in range(len(COLS) + 1):
    x = LW + CW * i
    d.line([x, 0, x, HEADER + NR * ROW], fill=GRID, width=S)
d.line([0, HEADER, W, HEADER], fill=GRID, width=S)
d.line([0, 0, 0, HEADER + NR * ROW], fill=GRID, width=S)

MX, MY = 10 * S, 14 * S
def box_rect(r, c):
    x0 = LW + CW * c + MX
    y0 = HEADER + r * ROW + MY
    return (x0, y0, x0 + CW - 2 * MX, y0 + ROW - 2 * MY)

def wrap(text, fnt, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=fnt) <= maxw:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def draw_box(r, c, title, body):
    col = ROWS[r][2]
    x0, y0, x1, y1 = box_rect(r, c)
    d.rounded_rectangle([x0, y0, x1, y1], radius=10 * S, fill=(26, 26, 31), outline=col, width=2 * S)
    tf, bf = font(15, True), font(12)
    lines = wrap(body, bf, (x1 - x0) - 22 * S)
    lh = 16 * S
    total = 20 * S + len(lines) * lh
    avail = (y1 - y0)
    assert total <= avail - 6 * S, f"overflow in {title}: {len(lines)} lines"
    ty = y0 + (avail - total) / 2 + 10 * S
    d.text(((x0 + x1) / 2, ty), title, font=tf, fill=WHITE, anchor="mm")
    ty += 12 * S
    for ln in lines:
        ty += lh
        d.text(((x0 + x1) / 2, ty - 6 * S), ln, font=bf, fill=(205, 205, 212), anchor="mm")

def dashed(points, dash=9 * S, gap=6 * S):
    for (ax, ay), (bx, by) in zip(points[:-1], points[1:]):
        dx, dy = bx - ax, by - ay
        L = (dx * dx + dy * dy) ** 0.5
        if L == 0: continue
        ux, uy = dx / L, dy / L
        pos = 0
        while pos < L:
            e = min(pos + dash, L)
            d.line([ax + ux * pos, ay + uy * pos, ax + ux * e, ay + uy * e], fill=ARROW, width=int(1.6 * S))
            pos += dash + gap

def arrowhead(p, q, size=8 * S):
    (px, py), (qx, qy) = p, q
    dx, dy = qx - px, qy - py
    L = (dx * dx + dy * dy) ** 0.5
    ux, uy = dx / L, dy / L
    nx, ny = -uy, ux
    d.polygon([(qx, qy), (qx - ux * size + nx * size * 0.55, qy - uy * size + ny * size * 0.55),
               (qx - ux * size - nx * size * 0.55, qy - uy * size - ny * size * 0.55)], fill=ARROW)

def route(points):
    dashed(points)
    arrowhead(points[-2], points[-1])

def label(x, y, text, r, anchor="lm"):
    f = font(11)
    w = d.textlength(text, font=f)
    px = x if anchor == "lm" else x - w
    d.rectangle([px - 3 * S, y - 8 * S, px + w + 3 * S, y + 8 * S], fill=tint(ROWS[r][2]))
    d.text((px, y), text, font=f, fill=GREY, anchor="lm")

def xb(i): return LW + CW * i

# boxes
draw_box(0, 0, "Run starts", "Cron Mon & Thu 08:00 IST, or Run now from the dashboard (3-hour cooldown)")
draw_box(1, 1, "Loads context", "50 VCs, identifiers, fit profiles, status. Vikram's columns are read-only")
draw_box(1, 4, "Verify + score", "URL resolves, date within 30 days, dedupe; fit rules, stage, triangulation, 0-100")
draw_box(1, 5, "Protected write", "update_vc_signals(): 4 columns only; app role can't UPDATE vcs")
draw_box(2, 2, "Fetches live data", "Bing News RSS, Tavily (Exa fallback), LinkedIn index, YouTube, blogs, Inc42, SEC Form D, portfolio diff")
draw_box(3, 3, "Gemini 3.7 Flash", "Google Search + URL context; classifies sector, B2B/B2C, offering, stage as JSON")
draw_box(4, 5, "Neon tables", "vcs (O1), signals, run log (O3); daily keep-alive")
draw_box(5, 5, "Dashboard (O2)", "Reach out, Nudge, Quiet; evidence links, fit badges, run status")
draw_box(6, 5, "Acts on the list", "Reaches out, nudges or skips; his notes stay his")

# arrows
def mid_right(r, c): b = box_rect(r, c); return (b[2], (b[1] + b[3]) / 2)
def mid_left(r, c): b = box_rect(r, c); return (b[0], (b[1] + b[3]) / 2)
def mid_bottom(r, c): b = box_rect(r, c); return ((b[0] + b[2]) / 2, b[3])
def mid_top(r, c): b = box_rect(r, c); return ((b[0] + b[2]) / 2, b[1])

def elbow(r0, c0, r1, c1, bx):
    a, b = mid_right(r0, c0), mid_left(r1, c1)
    route([a, (bx, a[1]), (bx, b[1]), b])

elbow(0, 0, 1, 1, xb(1))
elbow(1, 1, 2, 2, xb(2))
elbow(2, 2, 3, 3, xb(3))
elbow(3, 3, 1, 4, xb(4))
route([mid_right(1, 4), mid_left(1, 5)])
route([mid_bottom(1, 5), mid_top(4, 5)])
route([mid_bottom(4, 5), mid_top(5, 5)])
route([mid_bottom(5, 5), mid_top(6, 5)])

# labels
label(xb(2) + 6 * S, HEADER + 1.5 * ROW + 6 * S, "per VC", 1)
label(xb(3) + 6 * S, HEADER + 2.5 * ROW + 6 * S, "raw items", 2)
label(xb(4) + 6 * S, HEADER + 2.5 * ROW + 6 * S, "typed signals", 2)
cx = box_rect(1, 5)[0] + (box_rect(1, 5)[2] - box_rect(1, 5)[0]) / 2
label(cx + 8 * S, HEADER + 2.5 * ROW, "4 columns", 2)
label(cx + 8 * S, HEADER + 5 * ROW - 2 * S, "read-only views", 4)

# footer
d.text((LW, H - FOOT / 2),
       "Gemini is the only AI in the app. The dashboard never writes. Public pages and APIs only, no logged-in scraping. "
       "A failed source is logged and the run continues.",
       font=font(11.5), fill=GREY, anchor="lm")

img.save("docs/components-map.png", optimize=True)
print(img.size)
