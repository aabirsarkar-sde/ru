# Generates the made-up app screens for B.Design D2 ("Design for People").
# Each screen deliberately contains usability problems; their areas are printed
# as % zones for content/programs/bdes.yaml. Replace with real screenshots any
# time — just update the image path and zones in the YAML.
import json
W, H = 360, 760
F = 'font-family="Helvetica, Arial, sans-serif"'
OUT = "public/media/bdes/ux/"
zones_out = {}

def svg(body, bg="#FFFFFF"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><rect width="{W}" height="{H}" fill="{bg}"/>{body}</svg>'

def text(x, y, s, size=12, fill="#1F2224", weight=400, anchor="start", extra=""):
    s = s.replace("&", "&amp;")
    return f'<text x="{x}" y="{y}" {F} font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" {extra}>{s}</text>'

def status_bar(dark=False):
    c = "#FFFFFF" if dark else "#1F2224"
    return text(18, 17, "9:41", 11, c, 600) + f'<rect x="300" y="8" width="22" height="10" rx="2" fill="none" stroke="{c}"/><rect x="302" y="10" width="14" height="6" fill="{c}"/>' + \
        "".join(f'<rect x="{276+i*5}" y="{16-i*2}" width="3" height="{3+i*2}" fill="{c}"/>' for i in range(4))

def zone(screen, zid, label, x, y, w, h):
    zones_out.setdefault(screen, []).append({"id": zid, "label": label, "x": round(x / W * 100, 1), "y": round(y / H * 100, 1), "w": round(w / W * 100, 1), "h": round(h / H * 100, 1)})

# ──────────────────────────────────────────────── Jaldi: home / reorder (A1)
TEAL = "#0E8C7E"
b = status_bar()
b += text(18, 52, "jaldi", 26, TEAL, 800) + f'<rect x="92" y="34" width="54" height="18" rx="9" fill="#FFE8A3"/>' + text(119, 47, "⚡ 10 min", 9, "#7A5A00", 700, "middle")
b += text(18, 70, "Deliver to Home — B-42, Sector 9, Jaipur ▾", 8, "#8A9094")
b += f'<circle cx="330" cy="46" r="14" fill="#E8F4F2"/>' + f'<circle cx="330" cy="42" r="5" fill="{TEAL}"/><path d="M321 54 q9 -9 18 0" fill="{TEAL}"/>'
b += f'<rect x="16" y="84" width="328" height="40" rx="12" fill="#F2F4F5"/>' + text(44, 109, "Search 'atta', 'dudh', 'sabzi'…", 12, "#9AA0A4")
b += '<circle cx="31" cy="103" r="6" fill="none" stroke="#9AA0A4" stroke-width="2"/><line x1="35" y1="108" x2="39" y2="112" stroke="#9AA0A4" stroke-width="2"/>'
# festive banner (pushes everything down)
b += '<defs><linearGradient id="fest" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8E2DE2"/><stop offset="1" stop-color="#FF6A3D"/></linearGradient></defs>'
b += '<rect x="16" y="136" width="328" height="128" rx="14" fill="url(#fest)"/>'
b += text(32, 170, "DIWALI DHAMAKA", 20, "#FFFFFF", 800) + text(32, 196, "UP TO 70% OFF", 26, "#FFE14D", 900) + text(32, 218, "on sweets, dry fruits & gifts*", 10, "#FFFFFF")
b += '<rect x="32" y="230" width="84" height="22" rx="11" fill="#FFFFFF"/>' + text(74, 245, "Shop now", 10, "#8E2DE2", 700, "middle")
for i, cx in enumerate([270, 300, 320]):
    b += f'<circle cx="{250+i*14}" cy="252" r="3.5" fill="{"#FFFFFF" if i == 0 else "#FFFFFF88"}"/>'
b += '<g fill="#FFD166"><circle cx="300" cy="170" r="16"/><path d="M300 150 q6 10 0 16 q-6 -6 0 -16z" fill="#FFF3B0"/></g>'
zone("jaldi-home", "banner", "Big festive banner takes the prime space", 16, 136, 328, 128)
# category icons — no labels
icons = [
    '<path d="M-8 6 h16 l-3 -12 h-10 z" fill="#0E8C7E"/>',                      # bag
    '<rect x="-7" y="-9" width="14" height="18" rx="3" fill="#2F6DB0"/><rect x="-4" y="-12" width="8" height="4" fill="#2F6DB0"/>',  # bottle
    '<circle r="8" fill="#6FA34A"/><path d="M0 -8 q4 -6 8 -4" stroke="#3F6B2A" stroke-width="2" fill="none"/>',  # veg
    '<ellipse rx="9" ry="6" fill="#E0A800"/>',                                     # bread
    '<path d="M-8 -6 h16 v12 h-16z M-4 -10 h8 v4 h-8z" fill="#B20E38"/>',        # box
]
for i, ic in enumerate(icons):
    cx = 46 + i * 67
    b += f'<circle cx="{cx}" cy="306" r="24" fill="#F2F4F5"/><g transform="translate({cx} 306)">{ic}</g>'
zone("jaldi-home", "icons", "Category icons have no words under them", 16, 276, 328, 60)
# trending products
b += text(18, 364, "Trending near you", 14, "#1F2224", 700) + text(342, 364, "See all", 10, TEAL, 700, "end")
prods = [("Toned Milk", "500 ml", "₹29", "#DDEFFB"), ("Chakki Atta", "5 kg", "₹245", "#FBEBD2"), ("Tomato", "500 g", "₹24", "#FDE0DC")]
for i, (n, size, price, bg) in enumerate(prods):
    x = 16 + i * 112
    b += f'<rect x="{x}" y="376" width="104" height="166" rx="12" fill="#FFFFFF" stroke="#E6E9EB"/>'
    b += f'<rect x="{x+8}" y="384" width="88" height="72" rx="8" fill="{bg}"/>'
    b += f'<rect x="{x+34}" y="396" width="36" height="50" rx="6" fill="#FFFFFF" opacity=".8"/>'
    b += text(x + 8, 474, n, 11, "#1F2224", 600) + text(x + 8, 488, size, 8, "#B8BDC0") + text(x + 8, 522, price, 12, "#1F2224", 700)
    b += f'<rect x="{x+60}" y="508" width="36" height="20" rx="6" fill="#FFFFFF" stroke="{TEAL}"/>' + text(x + 78, 522, "ADD", 9, TEAL, 800, "middle")
zone("jaldi-home", "sizes", "Pack size is in tiny, faint text", 16, 478, 328, 14)
zone("jaldi-home", "add", "Small 'ADD' buttons are easy to miss", 70, 504, 280, 28)
# buy again — buried
b += text(18, 574, "Buy again", 14, "#1F2224", 700) + text(92, 574, "· your usual items", 9, "#9AA0A4")
for i in range(4):
    x = 16 + i * 84
    b += f'<rect x="{x}" y="586" width="76" height="96" rx="10" fill="#F7F8F9" stroke="#E6E9EB"/><rect x="{x+10}" y="594" width="56" height="44" rx="6" fill="{["#DDEFFB","#FBEBD2","#E3F2D9","#FDE0DC"][i]}"/>'
zone("jaldi-home", "buyagain", "'Buy again' (her usual order) is buried at the bottom", 16, 560, 328, 124)
# bottom nav — icons only
b += '<rect x="0" y="690" width="360" height="70" fill="#FFFFFF"/><line x1="0" y1="690" x2="360" y2="690" stroke="#E6E9EB"/>'
for i in range(4):
    cx = 45 + i * 90
    col = TEAL if i == 0 else "#9AA0A4"
    shapes = [f'<path d="M-9 2 L0 -8 L9 2 V10 H-9Z" fill="{col}"/>', f'<rect x="-9" y="-9" width="8" height="8" fill="{col}"/><rect x="1" y="-9" width="8" height="8" fill="{col}"/><rect x="-9" y="1" width="8" height="8" fill="{col}"/><rect x="1" y="1" width="8" height="8" fill="{col}"/>',
              f'<path d="M-10 -6 h4 l3 12 h12 l3 -9 h-16" stroke="{col}" stroke-width="2.4" fill="none"/>', f'<circle r="9" fill="none" stroke="{col}" stroke-width="2.4"/><circle cy="-2" r="3" fill="{col}"/>']
    b += f'<g transform="translate({cx} 722)">{shapes[i]}</g>'
zone("jaldi-home", "nav", "Bottom menu is icons only", 0, 692, 360, 68)
open(OUT + "jaldi-home.svg", "w").write(svg(b))

# ──────────────────────────────────────────────── Jaldi: checkout (A2)
b = status_bar()
b += text(18, 56, "←", 20, "#1F2224", 700) + text(48, 55, "Checkout", 17, "#1F2224", 700)
b += '<rect x="0" y="70" width="360" height="34" fill="#FFE3E3"/>' + text(180, 92, "⏱ Hurry! Your offer ends in 04:59", 12, "#C62828", 800, "middle")
items = [("Toned Milk 1 L", "× 2", "₹58"), ("Chakki Atta 5 kg", "× 1", "₹245"), ("Onion 1 kg", "× 1", "₹0 FREE*")]
for i, (n, q, p) in enumerate(items):
    y = 128 + i * 40
    b += f'<rect x="16" y="{y-16}" width="28" height="28" rx="6" fill="{["#DDEFFB","#FBEBD2","#FDE0DC"][i]}"/>' + text(54, y, n, 12, "#1F2224", 600) + text(54, y + 13, q, 9, "#9AA0A4") + text(344, y + 4, p, 12, "#1F2224", 700, "end")
b += '<line x1="16" y1="238" x2="344" y2="238" stroke="#EEF0F1"/>'
b += text(18, 262, "Tip your delivery partner", 13, "#1F2224", 700) + text(18, 278, "100% of the tip goes to them", 9, "#9AA0A4")
for i, (lbl, sel) in enumerate([("₹10", False), ("₹20", True), ("₹30", False), ("Other", False)]):
    x = 18 + i * 80
    b += f'<rect x="{x}" y="288" width="72" height="30" rx="15" fill="{TEAL if sel else "#FFFFFF"}" stroke="{TEAL if sel else "#D5D9DB"}"/>' + text(x + 36, 307, lbl + (" ✓" if sel else ""), 11, "#FFFFFF" if sel else "#1F2224", 700, "middle")
b += f'<rect x="18" y="336" width="18" height="18" rx="4" fill="{TEAL}"/>' + text(27, 350, "✓", 12, "#FFFFFF", 800, "middle") + text(46, 349, "Donate ₹2 to Feed a Child", 12, "#1F2224", 600)
b += '<line x1="16" y1="372" x2="344" y2="372" stroke="#EEF0F1"/>' + text(18, 396, "Bill details", 13, "#1F2224", 700)
bill = [("Item total", "₹303", 12, "#1F2224"), ("Delivery fee", "FREE", 12, "#0E8C7E"), ("Handling charge ⓘ", "₹15", 8, "#B8BDC0"), ("Delivery partner tip", "₹20", 12, "#1F2224"), ("Donation", "₹2", 12, "#1F2224")]
for i, (k, v, sz, col) in enumerate(bill):
    y = 422 + i * 22
    b += text(18, y, k, sz, "#5B6366" if sz > 8 else col) + text(344, y, v, sz, col, 600, "end")
b += '<line x1="16" y1="530" x2="344" y2="530" stroke="#EEF0F1"/>' + text(18, 554, "To pay", 14, "#1F2224", 800) + text(344, 554, "₹340", 14, "#1F2224", 800, "end")
b += '<rect x="16" y="574" width="328" height="44" rx="10" fill="#F2F8F7"/>' + text(32, 601, "🛵 Arriving in 9 mins", 12, "#0E8C7E", 700)
b += f'<rect x="16" y="680" width="328" height="54" rx="12" fill="{TEAL}"/>' + text(180, 713, "Pay ₹340", 17, "#FFFFFF", 800, "middle")
open(OUT + "jaldi-checkout.svg", "w").write(svg(b))

# ──────────────────────────────────────────────── Thali Express: cart (B1)
NAVY = "#1B3A6B"
SAFF = "#F28C28"
b = status_bar()
b += text(18, 56, "←", 20, "#1F2224", 700) + text(46, 55, "Your cart", 17, "#1F2224", 700)
b += text(344, 54, "Place order", 10, SAFF, 800, "end")
zone("thali-cart", "placeorder", "'Place order' sits in the top corner, far from her thumb", 270, 38, 90, 26)
b += '<rect x="16" y="76" width="328" height="52" rx="12" fill="#F6F7FB"/>' + text(30, 98, "Annapurna Kitchen", 13, NAVY, 700) + text(30, 116, "2.1 km · 35–40 min", 10, "#8A9094")
cart = [("Paneer Butter Masala", "#2E7D32", "₹280"), ("Chicken Biryani", "#C62828", "₹320"), ("Butter Naan", "#2E7D32", "₹160")]
for i, (n, dot, p) in enumerate(cart):
    y = 160 + i * 58
    b += text(20, y - 6, "✕", 8, "#B8BDC0", 700)
    b += f'<rect x="32" y="{y-12}" width="8" height="8" fill="none" stroke="{dot}"/><circle cx="36" cy="{y-8}" r="2" fill="{dot}"/>'
    b += text(46, y - 3, n, 12, "#1F2224", 600) + text(46, y + 13, p, 11, "#5B6366")
    b += f'<rect x="264" y="{y-14}" width="80" height="28" rx="8" fill="#FFF4E8" stroke="{SAFF}"/>' + text(278, y + 5, "−", 14, SAFF, 800) + text(304, y + 5, "1" if i < 2 else "4", 12, "#1F2224", 700, "middle") + text(330, y + 5, "+", 14, SAFF, 800, "middle")
zone("thali-cart", "remove", "Tiny ✕ to remove items, right next to the names", 14, 140, 26, 136)
zone("thali-cart", "vegdots", "Veg / non-veg shown only by tiny coloured squares", 28, 140, 16, 136)
b += '<rect x="16" y="318" width="328" height="42" rx="10" fill="#FFFFFF" stroke="#E3E6EA"/>' + text(30, 344, "✎ Add cooking instructions", 11, "#8A9094")
b += text(18, 390, "Have a coupon code?", 12, "#1F2224", 700)
b += '<rect x="16" y="400" width="240" height="40" rx="8" fill="#FFFFFF" stroke="#D5D9DB"/>' + text(30, 425, "Type your code", 11, "#B8BDC0")
b += f'<rect x="264" y="400" width="80" height="40" rx="8" fill="#FFFFFF" stroke="{SAFF}"/>' + text(304, 425, "APPLY", 11, SAFF, 800, "middle")
zone("thali-cart", "coupon", "Coupons need a code typed in", 16, 380, 328, 62)
b += text(18, 474, "Bill summary", 13, "#1F2224", 700)
for i, (k, v) in enumerate([("Item total", "₹760"), ("Delivery fee", "₹39"), ("Platform fee", "₹6"), ("GST & charges", "₹42"), ("Discount", "−₹163")]):
    y = 498 + i * 20
    b += text(18, y, k, 11, "#5B6366") + text(344, y, v, 11, "#1F2224", 600, "end")
b += text(18, 612, "Cutlery", 11, "#5B6366") + text(344, 612, "Don't send ☑", 11, "#1F2224", 600, "end")
b += f'<rect x="16" y="676" width="328" height="58" rx="29" fill="{NAVY}"/><circle cx="46" cy="705" r="24" fill="{SAFF}"/>' + text(46, 711, "›››", 14, "#FFFFFF", 900, "middle") + text(200, 710, "Swipe to pay ₹684", 15, "#FFFFFF", 700, "middle")
zone("thali-cart", "swipe", "'Swipe to pay' needs a long, careful swipe", 16, 676, 328, 58)
open(OUT + "thali-cart.svg", "w").write(svg(b))

# ──────────────────────────────────────────────── Thali Express: tracking (B2)
b = '<rect x="0" y="0" width="360" height="430" fill="#E9EEF3"/>'
for x in [40, 130, 220, 310]:
    b += f'<rect x="{x}" y="0" width="14" height="430" fill="#FFFFFF"/>'
for y in [80, 190, 300, 400]:
    b += f'<rect x="0" y="{y}" width="360" height="12" fill="#FFFFFF"/>'
b += '<rect x="60" y="100" width="60" height="80" fill="#D8E6D0"/><rect x="240" y="210" width="60" height="80" fill="#D8E6D0"/>'
b += f'<path d="M140 400 L140 196 L226 196 L226 90" stroke="{SAFF}" stroke-width="4" fill="none" stroke-dasharray="8 6"/>'
b += f'<circle cx="226" cy="120" r="14" fill="{NAVY}"/>' + text(226, 125, "🛵", 13, "#FFFFFF", 400, "middle")
b += f'<circle cx="140" cy="398" r="10" fill="{SAFF}" stroke="#FFFFFF" stroke-width="3"/>'
b += status_bar()
b += '<rect x="12" y="40" width="40" height="40" rx="20" fill="#FFFFFF"/>' + text(32, 66, "←", 18, "#1F2224", 700, "middle")
# upsell card covering the map
b += f'<rect x="16" y="236" width="328" height="84" rx="14" fill="#1F2224"/>' + text(32, 264, "⭐ Get FREE delivery with Thali Gold", 13, "#FFD166", 800) + text(32, 284, "Join today for just ₹99 / 3 months", 11, "#FFFFFF")
b += f'<rect x="32" y="292" width="92" height="20" rx="10" fill="#FFD166"/>' + text(78, 306, "Join now", 10, "#1F2224", 800, "middle") + text(334, 254, "×", 10, "#8A9094", 700, "end")
zone("thali-track", "upsell", "A 'Thali Gold' ad covers the map", 16, 236, 328, 84)
# sheet
b += '<rect x="0" y="416" width="360" height="344" rx="20" fill="#FFFFFF"/><rect x="160" y="426" width="40" height="4" rx="2" fill="#D5D9DB"/>'
b += '<rect x="16" y="444" width="328" height="96" rx="12" fill="#FFF7E6" stroke="#FFE0A3"/>' + text(32, 470, "How was your last order?", 13, "#1F2224", 700)
b += text(32, 498, "★ ★ ★ ★ ★", 20, "#E0A800", 400) + f'<rect x="240" y="480" width="88" height="28" rx="14" fill="{SAFF}"/>' + text(284, 499, "Rate now", 11, "#FFFFFF", 800, "middle") + text(32, 526, "Earn 10 Thali coins for every review!", 9, "#8A9094")
zone("thali-track", "rating", "A pop-up asks her to rate her *last* order", 16, 444, 328, 96)
b += text(18, 574, "Your order is on the way!", 16, "#1F2224", 800) + text(18, 596, "Arriving soon", 13, SAFF, 700)
zone("thali-track", "eta", "'Arriving soon' instead of a time", 16, 582, 200, 22)
b += '<line x1="16" y1="614" x2="344" y2="614" stroke="#EEF0F1"/>'
b += f'<circle cx="42" cy="652" r="22" fill="#DDE4EE"/><circle cx="42" cy="646" r="8" fill="#8A9AB0"/><path d="M28 666 q14 -14 28 0" fill="#8A9AB0"/>'
b += text(76, 648, "Suresh", 13, "#1F2224", 700) + text(76, 666, "Scooter · UP32 AB 1234", 10, "#8A9094")
b += text(334, 656, "⋮", 22, "#5B6366", 700, "end")
zone("thali-track", "menu", "Calling the rider is hidden behind the ⋮ menu", 300, 630, 60, 44)
b += text(18, 716, "Delivering to: Home · Gomti Nagar", 11, "#5B6366")
open(OUT + "thali-track.svg", "w").write(svg(b, "#FFFFFF"))

print(json.dumps(zones_out, indent=1))

# ──────────────────────────────────────────────── persona illustrations
def persona_card(bg, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 300"><rect width="480" height="300" fill="{bg}"/>{body}</svg>'

# Kamla-ji: 68, glasses, dupatta, phone held close, cup of chai
k = '<rect x="0" y="236" width="480" height="64" fill="#E9C58F"/><g transform="translate(110 0)">'
k += '<path d="M150 300 Q150 170 240 160 Q330 170 330 300 Z" fill="#81204D"/>'                 # kurta
k += '<path d="M168 190 Q240 150 312 190 L300 300 L180 300 Z" fill="#B24A7A" opacity=".55"/>'   # dupatta
k += '<rect x="226" y="136" width="28" height="30" fill="#B07850"/>'
k += '<ellipse cx="240" cy="108" rx="42" ry="48" fill="#B98158"/>'
k += '<path d="M196 104 Q198 52 240 52 Q284 52 286 104 Q270 76 240 74 Q210 76 196 104 Z" fill="#D9D4CE"/>'  # grey hair
k += '<circle cx="240" cy="54" r="14" fill="#CFC9C2"/>'                                          # bun
k += '<g fill="none" stroke="#3A2E28" stroke-width="3"><circle cx="224" cy="110" r="11"/><circle cx="256" cy="110" r="11"/><path d="M235 110 h10"/></g>'
k += '<circle cx="224" cy="111" r="2.5" fill="#3A2E28"/><circle cx="256" cy="111" r="2.5" fill="#3A2E28"/>'
k += '<path d="M228 134 Q240 142 252 134" stroke="#6E3B2A" stroke-width="2.5" fill="none"/>'
k += '<circle cx="240" cy="92" r="3" fill="#B20E38"/>'                                          # bindi
k += '<path d="M200 230 Q220 200 250 206" stroke="#B98158" stroke-width="18" fill="none" stroke-linecap="round"/>'  # arm
k += '<rect x="240" y="176" width="40" height="66" rx="7" fill="#1F2224" transform="rotate(-12 260 209)"/><rect x="245" y="182" width="30" height="50" rx="3" fill="#8EC5E8" transform="rotate(-12 260 209)"/>'
k += '</g><g transform="translate(110 208)"><path d="M-18 0 h36 l-5 28 h-26z" fill="#F4F1EA" stroke="#B8A58A" stroke-width="2"/><path d="M-6 -8 q4 -8 0 -14 M4 -8 q4 -8 0 -14" stroke="#FFFFFF" stroke-width="3" fill="none" opacity=".8"/></g>'
k += '<g font-family="Georgia, serif" fill="#561842"><text x="28" y="52" font-size="30">Kamla-ji, 68</text><text x="28" y="78" font-size="15" font-style="italic">Jaipur · reading glasses · Hindi first</text></g>'
open(OUT + "persona-kamla.svg", "w").write(persona_card("#FFEDD2", k))

# Farida: 34, office clothes, toddler on hip, phone in one hand
f = '<rect x="0" y="236" width="480" height="64" fill="#D6C4A6"/>'
f += '<rect x="30" y="112" width="92" height="56" rx="6" fill="#FFF8EE" stroke="#D6C4A6" stroke-width="3"/><text x="76" y="150" font-family="Helvetica, Arial" font-size="26" fill="#B20E38" text-anchor="middle">7:32</text>'
f += '<g transform="translate(120 0)">'
f += '<path d="M150 300 Q150 172 238 162 Q326 172 326 300 Z" fill="#104477"/>'
f += '<rect x="224" y="138" width="28" height="30" fill="#A0673A"/>'
f += '<ellipse cx="238" cy="108" rx="40" ry="46" fill="#A0673A"/>'
f += '<path d="M194 118 Q192 56 238 56 Q286 56 282 118 Q272 84 238 82 Q206 84 194 118 Z" fill="#1E1A18"/>'
f += '<path d="M198 100 Q196 150 212 170" stroke="#1E1A18" stroke-width="12" fill="none"/>'
f += '<circle cx="224" cy="112" r="3" fill="#2B2F31"/><circle cx="252" cy="112" r="3" fill="#2B2F31"/><path d="M228 134 Q238 138 248 134" stroke="#5A3020" stroke-width="2.5" fill="none"/>'
# toddler on left hip
f += '<ellipse cx="170" cy="206" rx="34" ry="40" fill="#E0A800"/><circle cx="160" cy="160" r="28" fill="#C68B59"/><path d="M134 154 Q140 128 162 130 Q184 132 188 150 Q170 140 150 146 Z" fill="#2A1C14"/>'
f += '<circle cx="152" cy="162" r="2.5" fill="#2B2F31"/><circle cx="168" cy="162" r="2.5" fill="#2B2F31"/><path d="M154 174 Q160 178 166 174" stroke="#5A3020" stroke-width="2" fill="none"/>'
f += '<path d="M196 214 Q180 240 150 236" stroke="#A0673A" stroke-width="18" fill="none" stroke-linecap="round"/>'  # arm holding child
# phone in right hand
f += '<path d="M300 250 Q320 214 300 196" stroke="#A0673A" stroke-width="18" fill="none" stroke-linecap="round"/>'
f += '<rect x="282" y="152" width="38" height="64" rx="7" fill="#1F2224" transform="rotate(10 300 184)"/><rect x="287" y="158" width="28" height="48" rx="3" fill="#FDD9B5" transform="rotate(10 300 184)"/>'
f += '</g><g font-family="Georgia, serif" fill="#062E56"><text x="28" y="52" font-size="30">Farida, 34</text><text x="28" y="78" font-size="15" font-style="italic">Lucknow · one free hand · two minutes</text></g>'
open(OUT + "persona-farida.svg", "w").write(persona_card("#E2ECF6", f))

# Caption-free version of Kamla-ji for the landing-page hero crop.
import re
art = re.sub(r'<g font-family="Georgia, serif".*?</g>', '', k)
open(OUT + "persona-kamla-art.svg", "w").write(persona_card("#FFEDD2", art))
