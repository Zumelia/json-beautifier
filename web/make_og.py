#!/usr/bin/env python3
"""
Картинки для превью ссылок (og:image), 1200×630.

Зачем скриптом, а не в макете: превью нужно уже сейчас — без него любая ссылка
на сайт в чате, письме или посте выглядит голым текстом, — а рисованный вариант
из Claude Design появится позже и просто заменит эти файлы. Токены здесь те же,
что в site.css, так что расхождения с сайтом не будет.

Главное требование к такой картинке — читаемость в размер почтовой марки:
в ленте она показывается сильно уменьшенной. Отсюда крупный текст, много
воздуха и никаких мелких деталей.

    python3 make_og.py        # → assets/og/*.png
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
FONTS = HERE / ".fonts-ttf"
OUT = HERE / "assets" / "og"

W, H = 1200, 630

# Токены из site.css, светлая тема
BG = "#fbf7f0"
SURFACE = "#ffffff"
BORDER = "#ece3d5"
TEXT = "#1b1a17"
MUTED = "#6a6459"
FAINT = "#8b8375"
BRAND = "#6c4df6"
J_KEY = "#6c4df6"
J_STR = "#0a7a61"
J_NUM = "#a8360a"
J_PUNCT = "#8b8375"


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def rounded(draw, box, r, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def render(title, tagline, snippet_lines, out_name):
    """Раскладка считается по потоку, а не по фиксированным отступам: заголовок
    бывает в одну строку и в две, и жёсткие координаты в этом случае наезжают
    друг на друга."""
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    f_title = font("bricolage.ttf", 62)
    f_tag = font("jakarta1.ttf", 27)
    f_name = font("jakarta2.ttf", 27)
    f_mark = font("plexmono.ttf", 30)
    f_mono = font("plexmono.ttf", 19)
    f_foot = font("jakarta2.ttf", 22)

    pad = 60
    line_h = 27  # шаг строки внутри карточки
    card_h = len(snippet_lines) * line_h + 40
    foot_h = 46

    # Шапка: знак и название
    mark = 76
    rounded(d, (pad, pad, pad + mark, pad + mark), 22, BRAND)
    bb = d.textbbox((0, 0), "{}", font=f_mark)
    d.text(
        (pad + mark / 2 - (bb[2] - bb[0]) / 2 - bb[0],
         pad + mark / 2 - (bb[3] - bb[1]) / 2 - bb[1]),
        "{}", font=f_mark, fill="#ffffff",
    )
    d.text((pad + mark + 22, pad + 22), "JSON Beautifier", font=f_name, fill=MUTED)

    # Заголовок: считаем реальную высоту блока и от неё пляшем дальше
    y = pad + mark + 44
    tb = d.multiline_textbbox((pad, y), title, font=f_title, spacing=8)
    d.multiline_text((pad, y), title, font=f_title, fill=TEXT, spacing=8)
    y = tb[3] + 22

    d.text((pad, y), tagline, font=f_tag, fill=MUTED)
    y += 52

    # Карточка с кусочком дерева: показывает продукт, а не только называет его.
    # Если места не осталось — не рисуем вовсе, лучше пусто, чем внахлёст.
    if y + card_h <= H - foot_h - pad + 30:
        rounded(d, (pad, y, W - pad, y + card_h), 20, SURFACE, outline=BORDER, width=2)
        ty = y + 20
        for indent, parts in snippet_lines:
            x = pad + 26 + indent * 24
            for text, colour in parts:
                d.text((x, ty), text, font=f_mono, fill=colour)
                x += d.textlength(text, font=f_mono)
            ty += line_h

    d.text((pad, H - pad + 6), "jsonbeautifier.dev  ·  free  ·  MIT  ·  no telemetry",
           font=f_foot, fill=FAINT)

    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / out_name, "PNG", optimize=True)
    size = (OUT / out_name).stat().st_size
    print(f"  {out_name:22} {W}×{H}  {size:>7,} B")


TREE = [
    (0, [("order", J_KEY), (": ", J_PUNCT), ("{", J_PUNCT)]),
    (1, [("id", J_KEY), (": ", J_PUNCT), ('"ord_8123"', J_STR)]),
    (1, [("status", J_KEY), (": ", J_PUNCT), ('"shipped"', J_STR)]),
    (1, [("total", J_KEY), (": ", J_PUNCT), ("173.92", J_NUM)]),
    (0, [("}", J_PUNCT)]),
]

PAGES = [
    ("JSON that reads\nlike a document",
     "Open any JSON URL — it's already formatted.", "default.png"),
    ("JSON Formatter", "Indent, sort and read JSON online.", "formatter.png"),
    ("JSON Validator", "Find the error, with line and column.", "validator.png"),
    ("JSON Minifier", "Strip whitespace, see the saving.", "minifier.png"),
]


def main():
    for title, tagline, name in PAGES:
        render(title, tagline, TREE, name)


if __name__ == "__main__":
    main()
