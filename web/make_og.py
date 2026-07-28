#!/usr/bin/env python3
"""
Картинки для превью ссылок (og:image), 1200×630.

Отрисовка макета Claude Design («JSON Beautifier - Brand Assets», блок 4 ·
OG IMAGES). Значения ниже — из его же `ogSpec`, в экспортном масштабе;
в макете артборд нарисован 1:2, поэтому там каждое число вдвое меньше.

Почему скриптом, а не выгрузкой картинок из макета: превью перерисовывается
при каждой правке копирайта, и перерисовка должна быть `python3 make_og.py`,
а не походом в дизайн-инструмент. Шрифты берутся те же, что отдаёт сайт
(см. make_fonts.py), поэтому картинка и страница набраны одинаково.

Главное требование к такой картинке — читаемость в размер почтовой марки:
в ленте она показывается сильно уменьшенной. Отсюда крупный текст, много
воздуха и блок кода вместо описания: код узнаётся формой раньше, чем
прочитывается заголовок, и по нему сразу видно, что это инструмент для JSON.

    python3 make_fonts.py && python3 make_og.py     # → assets/og/*.png
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
FONTS = HERE / ".fonts-ttf"
OUT = HERE / "assets" / "og"

W, H = 1200, 630
SS = 2  # рисуем в двойном размере и ужимаем: PIL не сглаживает скругления

# Раскладка — из ogSpec макета
PAD_X, PAD_TOP, PAD_BOT = 64, 60, 60
TILE, TILE_R, MARK_SIZE, MARK_GAP = 72, 22, 34, 22
KICKER_SIZE = 22
TITLE_SIZE, TITLE_LH, TITLE_CH, TITLE_TRACK = 58, 1.04, 24, -0.04
SUB_SIZE, TITLE_SUB_GAP = 30, 14
CARD_R, CARD_PAD_Y, CARD_PAD_X = 20, 24, 32
MONO_SIZE, MONO_LH, INDENT = 26, 38, 30

# Токены бренда
BRAND, CREAM, WHITE = "#6c4df6", "#fbf7f0", "#ffffff"
TEXT, MUTED, FAINT, BORDER = "#1b1a17", "#4a4536", "#6f6758", "#ece3d5"

# Подсветка — те же значения, что в extension-chrome/src/viewer.css и
# assets/site.css, светлая тема. Ни один цвет не выбран на глаз.
J_KEY, J_STR, J_NUM, J_PUNCT = "#6c4df6", "#0a7a61", "#a8360a", "#8b8375"

# Дерево ровно как во вьюере: ключи без кавычек, запятых нет. Это и есть
# узнаваемость — с кавычками и запятыми картинка станет рекламой редактора.
TREE = [
    (0, [("order", J_KEY), (": {", J_PUNCT)]),
    (1, [("id", J_KEY), (": ", J_PUNCT), ('"ord_8123"', J_STR)]),
    (1, [("status", J_KEY), (": ", J_PUNCT), ('"shipped"', J_STR)]),
    (1, [("total", J_KEY), (": ", J_PUNCT), ("173.92", J_NUM)]),
    (0, [("}", J_PUNCT)]),
]
CARD_H = len(TREE) * MONO_LH + CARD_PAD_Y * 2


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size * SS)


def advance(d, text, f, track):
    return d.textlength(text, font=f) + track * len(text)


def draw_line(d, x, baseline, text, f, fill, track=0):
    """CSS letter-spacing: PIL кладёт строку целиком, трекинг приходится
    расставлять руками. Позиция каждого знака считается от ширины всего
    префикса, а не суммированием ширин — так сохраняется кернинг."""
    if not track:
        d.text((x, baseline), text, font=f, fill=fill, anchor="ls")
        return
    for i, ch in enumerate(text):
        d.text((x + d.textlength(text[:i], font=f) + track * i, baseline),
               ch, font=f, fill=fill, anchor="ls")


def baseline_in_box(top, line_h, f):
    """Где у CSS оказывается базовая линия внутри строки заданной высоты:
    глифовый бокс центрируется, остаток делится поровну (half-leading)."""
    asc, desc = f.getmetrics()
    return top + (line_h - (asc + desc)) / 2 + asc


def wrap(d, text, f, max_w, track):
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if not cur or advance(d, trial, f, track) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    lines.append(cur)
    return lines


def render(spec, out_name):
    img = Image.new("RGBA", (W * SS, H * SS), spec["bg"])
    # Пятна — только сверху, и все заканчиваются выше карточки с кодом:
    # круг, уходящий за неё, читается как случайность, а не как фон.
    for cx, cy, r, rgba in spec["blobs"]:
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse(
            [(cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS], fill=rgba)
        img = Image.alpha_composite(img, layer)
    d = ImageDraw.Draw(img)

    f_title = font("bricolage-700.ttf", TITLE_SIZE)
    f_sub = font("jakarta-600.ttf", SUB_SIZE)
    f_kick = font("jakarta-700.ttf", KICKER_SIZE)
    f_mark = font("plexmono-400.ttf", MARK_SIZE)
    f_mono = font("plexmono-400.ttf", MONO_SIZE)

    track = TITLE_TRACK * TITLE_SIZE * SS
    max_w = TITLE_CH * d.textlength("0", font=f_title)
    lines = wrap(d, spec["title"], f_title, max_w, track)
    title_lh = TITLE_SIZE * TITLE_LH
    sub_asc, sub_desc = f_sub.getmetrics()
    sub_lh = (sub_asc + sub_desc) / SS  # line-height: normal

    # Колонка выложена как space-between: знак прижат к верхнему полю, код —
    # к нижнему, заголовок с подписью плавают между ними. Поэтому заголовок
    # в одну строку и в две одинаково не ломают раскладку.
    text_h = len(lines) * title_lh + TITLE_SUB_GAP + sub_lh
    gap = (H - PAD_TOP - PAD_BOT - TILE - text_h - CARD_H) / 2

    # 1. Знак и домен
    d.rounded_rectangle([PAD_X * SS, PAD_TOP * SS,
                         (PAD_X + TILE) * SS, (PAD_TOP + TILE) * SS],
                        radius=TILE_R * SS, fill=spec["mark_bg"])
    d.text(((PAD_X + TILE / 2) * SS, (PAD_TOP + TILE / 2) * SS), "{}",
           font=f_mark, fill=spec["mark_fg"], anchor="mm")
    d.text(((PAD_X + TILE + MARK_GAP) * SS, (PAD_TOP + TILE / 2) * SS),
           "jsonbeautifier.dev", font=f_kick, fill=spec["kicker"], anchor="lm")

    # 2. Заголовок и подпись
    y = PAD_TOP + TILE + gap
    for line in lines:
        draw_line(d, PAD_X * SS, baseline_in_box(y * SS, title_lh * SS, f_title),
                  line, f_title, spec["title_fg"], track)
        y += title_lh
    y += TITLE_SUB_GAP
    draw_line(d, PAD_X * SS, baseline_in_box(y * SS, sub_lh * SS, f_sub),
              spec["sub"], f_sub, spec["sub_fg"])

    # 3. Карточка с кодом. Непрозрачно-белая: цвет ключа совпадает с фирменным,
    # и на полупрозрачной карточке ключи растворились бы в заливке.
    top = H - PAD_BOT - CARD_H
    d.rounded_rectangle([PAD_X * SS, top * SS, (W - PAD_X) * SS, (top + CARD_H) * SS],
                        radius=CARD_R * SS, fill=WHITE, outline=spec["card_border"],
                        width=2 * SS if spec["card_border"] else 0)
    row = top + CARD_PAD_Y
    for indent, parts in TREE:
        x = (PAD_X + CARD_PAD_X + indent * INDENT) * SS
        baseline = baseline_in_box(row * SS, MONO_LH * SS, f_mono)
        for text, colour in parts:
            d.text((x, baseline), text, font=f_mono, fill=colour, anchor="ls")
            x += d.textlength(text, font=f_mono)
        row += MONO_LH

    OUT.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").resize((W, H), Image.LANCZOS).save(OUT / out_name, "PNG", optimize=True)
    print(f"  {out_name:16} {W}×{H}  {(OUT / out_name).stat().st_size:>7,} B")


BRAND_GROUND = {
    "bg": BRAND,
    "blobs": [(1040, 60, 220, (255, 201, 77, 66)), (1170, 128, 100, (35, 201, 160, 56))],
    "mark_bg": WHITE, "mark_fg": BRAND, "kicker": WHITE,
    "title_fg": WHITE, "sub_fg": "#ded6ff", "card_border": None,
}
CREAM_GROUND = {
    "bg": CREAM,
    "blobs": [(1040, 60, 220, (108, 77, 246, 41)), (1170, 128, 100, (255, 201, 77, 77))],
    "mark_bg": BRAND, "mark_fg": WHITE, "kicker": FAINT,
    "title_fg": TEXT, "sub_fg": MUTED, "card_border": BORDER,
}

# Главная — на фирменной заливке, три инструмента — на кремовой: так они
# читаются как родня друг другу, а не как четыре разных продукта.
PAGES = [
    ("default.png", BRAND_GROUND, "JSON that reads like a document",
     "Free Chrome extension · MIT · zero network requests"),
    ("formatter.png", CREAM_GROUND, "JSON Formatter, in your browser",
     "Nothing uploaded — parsed in the page you are on"),
    ("validator.png", CREAM_GROUND, "JSON Validator, in your browser",
     "Not just “invalid” — the line and the column"),
    ("minifier.png", CREAM_GROUND, "JSON Minifier, in your browser",
     "Strip the whitespace, see exactly what you saved"),
]


def main():
    for name, ground, title, sub in PAGES:
        render({**ground, "title": title, "sub": sub}, name)


if __name__ == "__main__":
    main()
