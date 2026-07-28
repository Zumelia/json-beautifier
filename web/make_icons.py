#!/usr/bin/env python3
"""
Иконки продукта: набор для расширения, store-иконка и фавиконки сайта.

Отрисовка макета Claude Design («JSON Beautifier - Brand Assets», блок 1 ·
ICONS) по его же `iconSpec`. Ключевая мысль макета — иконка рисуется под
каждый размер, а не масштабируется: на 16px пара скобок смыкается в кашу,
поэтому там остаётся одна `{` потяжелее. Силуэт выживает, а больше на этом
размере всё равно ничего не читается.

Начертания. В макете знак набран IBM Plex Mono 500/600, а сайт отдаёт только
Regular (400) — вариативной оси у этого шрифта в нашем сабсете нет. Вес
добирается обводкой в доли пикселя: разница 400→600 у Plex Mono около 0.025em
по толщине штриха, её и воспроизводим. Это заметно на 16px и незаметно на 128,
то есть ровно там, где нужно.

    python3 make_icons.py     # → assets/brand/, favicon.*, apple-touch-icon.png
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
FONTS = HERE / ".fonts-ttf"
BRAND_DIR = HERE / "assets" / "brand"
# Иконки расширения пишутся отсюда же. Раньше они жили сами по себе и остались
# в прежней паре «чернила + teal», когда сайт, og и store-иконка уже переехали
# на --brand: продукт выглядел двумя разными продуктами в зависимости от того,
# куда смотришь. Один генератор — расходиться больше нечему.
EXT_DIR = HERE.parent / "extension-chrome" / "icons"

SS = 8  # мелкие размеры без запаса не сгладить

BRAND = "#6c4df6"  # --brand, одинаков в обеих темах
GLYPH = "#ffffff"

# Толщина штриха относительно кегля: сколько добавить к Regular, чтобы получить
# нужный вес. По половине на сторону, поэтому делим пополам при отрисовке.
WEIGHT_STROKE = {400: 0.0, 500: 0.006, 600: 0.0125}

# размер, радиус, кегль знака, сам знак, вес, трекинг
ICONS = [
    (16, 4, 12, "{", 600, 0.0),
    (32, 8, 19, "{}", 500, -0.04),
    (48, 12, 26, "{}", 500, -0.04),
    (128, 30, 66, "{}", 500, -0.04),
]


def draw_mark(size, radius, glyph_px, mark, weight, tracking, alpha=True):
    """Плитка со знаком. Знак центрируется по чернилам, а не по метрикам
    шрифта: у `{}` метрический бокс сильно выше самих скобок, и центровка по
    нему уводит знак вверх — на 16px это уже видно."""
    px = size * SS
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if radius:
        d.rounded_rectangle([0, 0, px - 1, px - 1], radius=radius * SS, fill=BRAND)
    else:
        d.rectangle([0, 0, px - 1, px - 1], fill=BRAND)

    f = ImageFont.truetype(str(FONTS / "plexmono-400.ttf"), glyph_px * SS)
    stroke = round(WEIGHT_STROKE[weight] * glyph_px * SS / 2)
    track = tracking * glyph_px * SS

    # Знак рисуется на отдельном слое, оттуда берутся его настоящие границы и
    # уже они ставятся в центр плитки. Считать по метрикам шрифта нельзя:
    # у одиночной `{` чернила заметно смещены внутри её ширины, и на 16px знак
    # уезжает влево — это видно глазом.
    layer = Image.new("RGBA", (px * 2, px * 2), (0, 0, 0, 0))
    dl = ImageDraw.Draw(layer)
    for i, ch in enumerate(mark):
        dl.text((px / 2 + dl.textlength(mark[:i], font=f) + track * i, px), ch,
                font=f, fill=GLYPH, anchor="ls", stroke_width=stroke, stroke_fill=GLYPH)
    ink = layer.getbbox()
    glyph = layer.crop(ink)
    img.paste(glyph, (round((px - glyph.width) / 2), round((px - glyph.height) / 2)), glyph)

    img = img.resize((size, size), Image.LANCZOS)
    if not alpha:
        flat = Image.new("RGB", (size, size), BRAND)
        flat.paste(img, mask=img.split()[3])
        return flat
    return img


def main():
    BRAND_DIR.mkdir(parents=True, exist_ok=True)
    made = {}
    for size, radius, glyph, mark, weight, track in ICONS:
        img = draw_mark(size, radius, glyph, mark, weight, track)
        made[size] = img
        img.save(BRAND_DIR / f"icon{size}.png", optimize=True)
        img.save(EXT_DIR / f"icon{size}.png", optimize=True)
        print(f"  assets/brand/icon{size}.png  +  extension-chrome/icons/")

    # Store-иконка: квадрат без скругления и без прозрачности — стор рисует
    # маску сам, а свои скруглённые углы под его маской дают двойной кант.
    # Внутренний отступ 16px по каждой стороне — зона, в которую он может
    # врезаться; знак туда не заходит.
    store = draw_mark(128, 0, 62, "{}", 500, -0.04, alpha=False)
    store.save(BRAND_DIR / "icon_store_128.png", optimize=True)
    print("  assets/brand/icon_store_128.png")

    # Фавиконка: в .ico кладём три размера, каждый — своя отрисовка, а не
    # ужатая большая. Ради этого весь набор и рисуется под размер.
    made[48].save(HERE / "favicon.ico", format="ICO",
                  sizes=[(16, 16), (32, 32), (48, 48)],
                  append_images=[made[16], made[32]])
    made[48].save(HERE / "favicon.png", optimize=True)
    print("  favicon.ico (16·32·48), favicon.png")

    # iOS кладёт свою маску и не любит прозрачность — отдаём плотный квадрат.
    draw_mark(180, 0, 92, "{}", 500, -0.04, alpha=False).save(
        HERE / "apple-touch-icon.png", optimize=True)
    print("  apple-touch-icon.png")


if __name__ == "__main__":
    main()
