# Figures for B.Design D3 ("How People See & Choose"). Each is an A/B pair of
# ordinary interfaces; the question asks which works better for a real person.
# The underlying principle is never named in the question.
W, H = 760, 560
F = 'font-family="Helvetica, Arial, sans-serif"'
OUT = "public/media/bdes/d3/"
INK, MUTE, LINE = "#1F2224", "#8A9094", "#E3E6EA"

def svg(body, bg="#FFF8EE"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><rect width="{W}" height="{H}" fill="{bg}"/>{body}</svg>'

def t(x, y, s, size=12, fill=INK, weight=400, anchor="start"):
    return f'<text x="{x}" y="{y}" {F} font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}">{s.replace("&","&amp;")}</text>'

def phone(x, y, w=300, h=470, label=""):
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="#FFFFFF" stroke="{INK}" stroke-width="5"/>'
    s += t(x + w / 2, y - 14, label, 20, INK, 800, "middle")
    return s

# ── Hick's law: 24 undifferentiated tiles vs 6 grouped categories ───────────
b = phone(40, 60, label="A") + phone(420, 60, label="B")
dishes = ["Aloo Paratha","Poha","Idli","Vada","Upma","Dosa","Chole","Rajma","Dal Fry","Paneer","Kadhai","Malai Kofta",
          "Veg Biryani","Egg Biryani","Chicken","Mutton","Fried Rice","Hakka","Manchurian","Momos","Lassi","Cold Coffee","Gulab Jamun","Halwa"]
for i, d in enumerate(dishes):
    cx, cy = 56 + (i % 3) * 92, 90 + (i // 3) * 56
    b += f'<rect x="{cx}" y="{cy}" width="84" height="48" rx="6" fill="#F4F6F7" stroke="{LINE}"/>'
    b += t(cx + 42, cy + 22, d[:9], 7.5, INK, 600, "middle") + t(cx + 42, cy + 34, "₹" + str(80 + i * 7), 7, MUTE, 400, "middle")
cats = [("Breakfast", "12 dishes", "#FBEBD2"), ("Thalis", "8 dishes", "#E3F2D9"), ("Biryani", "9 dishes", "#FDE0DC"),
        ("Chinese", "14 dishes", "#DDEFFB"), ("Drinks", "11 dishes", "#F1E2EC"), ("Desserts", "7 dishes", "#FFF3CD")]
for i, (n, c, col) in enumerate(cats):
    cy = 92 + i * 70
    b += f'<rect x="440" y="{cy}" width="260" height="58" rx="10" fill="{col}" stroke="{LINE}"/>'
    b += t(462, cy + 28, n, 15, INK, 700) + t(462, cy + 46, c, 10, MUTE)
    b += t(680, cy + 36, "›", 20, MUTE, 700, "end")
open(OUT + "hicks.svg", "w").write(svg(b))

# ── Fitts's law: crowded small targets vs one big, separated target ─────────
b = phone(40, 60, label="A") + phone(420, 60, label="B")
for x0, lbl in ((56, "A"), (436, "B")):
    b += t(x0 + 16, 110, "Sleeper · 2 tickets", 13, INK, 700) + t(x0 + 16, 130, "Lucknow → Delhi · 9:40 pm", 10, MUTE)
    b += f'<rect x="{x0}" y="150" width="268" height="1" fill="{LINE}"/>'
    b += t(x0 + 16, 180, "Total", 12, MUTE) + t(x0 + 252, 180, "₹1,480", 14, INK, 700, "end")
# A: three small buttons crammed at the top-right
for i, (lbl, col) in enumerate([("Cancel", "#FFFFFF"), ("Change", "#FFFFFF"), ("Pay", "#B20E38")]):
    bx = 120 + i * 62
    b += f'<rect x="{bx}" y="212" width="58" height="26" rx="5" fill="{col}" stroke="{"#B20E38" if col=="#FFFFFF" else "none"}"/>'
    b += t(bx + 29, 229, lbl, 9, "#B20E38" if col == "#FFFFFF" else "#FFFFFF", 700, "middle")
b += t(56, 262, "(buttons 58 × 26 px, 4 px apart)", 9, MUTE)
# B: big primary button at the bottom, cancel far away as a text link
b += f'<rect x="436" y="420" width="268" height="62" rx="12" fill="#B20E38"/>' + t(570, 459, "Pay ₹1,480", 20, "#FFFFFF", 800, "middle")
b += t(570, 505, "Cancel", 12, MUTE, 600, "middle")
b += t(436, 400, "(button 268 × 62 px, at the thumb)", 9, MUTE)
open(OUT + "fitts.svg", "w").write(svg(b))

# ── Jakob's law: conventional shop layout vs a reinvented one ──────────────
b = phone(40, 60, label="A") + phone(420, 60, label="B")
# A — conventional
b += t(60, 100, "kirana.in", 15, "#2E7D4F", 800)
b += '<circle cx="300" cy="94" r="11" fill="none" stroke="#1F2224" stroke-width="2"/><path d="M296 90 h9 l-2 8 h-6z" fill="#1F2224"/>'
b += f'<rect x="56" y="112" width="268" height="30" rx="15" fill="#F4F6F7"/>' + t(76, 132, "Search for products", 11, MUTE)
for i in range(6):
    px, py = 56 + (i % 2) * 140, 156 + (i // 2) * 106
    b += f'<rect x="{px}" y="{py}" width="128" height="96" rx="8" fill="#FFFFFF" stroke="{LINE}"/><rect x="{px+12}" y="{py+10}" width="104" height="46" rx="6" fill="#EDF2F4"/>'
    b += t(px + 12, py + 74, "Product " + str(i + 1), 9, INK, 600) + t(px + 12, py + 88, "₹" + str(49 + i * 30), 10, INK, 700)
# B — reinvented
b += '<circle cx="570" cy="300" r="26" fill="#1F2224"/>' + t(570, 306, "•••", 14, "#FFFFFF", 800, "middle")
import math
for i in range(5):
    a = math.radians(i * 72 - 90)
    px, py = 570 + 96 * math.cos(a), 300 + 96 * math.sin(a)
    b += f'<g transform="rotate({i*15-30} {px:.0f} {py:.0f})"><rect x="{px-44:.0f}" y="{py-30:.0f}" width="88" height="60" rx="8" fill="#F1E2EC" stroke="{LINE}"/></g>'
b += f'<rect x="452" y="420" width="236" height="34" rx="17" fill="#FFF3CD"/>' + t(570, 442, "kirana.in", 14, "#8A6A00", 800, "middle")
b += t(570, 486, "swipe anywhere to browse", 10, MUTE, 400, "middle")
open(OUT + "jakob.svg", "w").write(svg(b))

# ── Von Restorff: one card in a row styled differently ─────────────────────
b = t(40, 56, "Choose a plan", 22, INK, 800)
plans = [("Basic", "₹199", False), ("Plus", "₹299", False), ("Pro", "₹499", True), ("Family", "₹699", False), ("Max", "₹999", False)]
for i, (n, p, hot) in enumerate(plans):
    x = 40 + i * 140
    if hot:
        b += f'<rect x="{x}" y="96" width="120" height="330" rx="14" fill="#B20E38"/>'
        b += f'<rect x="{x+18}" y="74" width="84" height="26" rx="13" fill="#FFD166"/>' + t(x + 60, 92, "POPULAR", 10, "#1F2224", 800, "middle")
        b += t(x + 60, 150, n, 16, "#FFFFFF", 800, "middle") + t(x + 60, 200, p, 26, "#FFFFFF", 800, "middle")
        for k in range(4):
            b += f'<rect x="{x+22}" y="{232+k*34}" width="76" height="8" rx="4" fill="#FFFFFF" opacity=".6"/>'
        b += f'<rect x="{x+18}" y="376" width="84" height="30" rx="8" fill="#FFFFFF"/>' + t(x + 60, 396, "Choose", 11, "#B20E38", 800, "middle")
    else:
        b += f'<rect x="{x}" y="110" width="120" height="300" rx="14" fill="#FFFFFF" stroke="{LINE}"/>'
        b += t(x + 60, 156, n, 15, INK, 700, "middle") + t(x + 60, 202, p, 24, INK, 800, "middle")
        for k in range(4):
            b += f'<rect x="{x+22}" y="{232+k*34}" width="76" height="8" rx="4" fill="#EDF0F2"/>'
        b += f'<rect x="{x+18}" y="364" width="84" height="30" rx="8" fill="#FFFFFF" stroke="{LINE}"/>' + t(x + 60, 384, "Choose", 11, INK, 700, "middle")
open(OUT + "restorff.svg", "w").write(svg(b))
print("wrote 4 figures")
