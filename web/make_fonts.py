#!/usr/bin/env python3
"""
Готовит TTF для отрисовки картинок (make_og.py) из тех же woff2, что отдаёт сайт.

Зачем: og-картинки и текст на сайте должны быть набраны одним и тем же шрифтом
в том же начертании. Скачивать TTF отдельно с Google Fonts — значит завести
второй источник правды и однажды разъехаться с сайтом на полделения веса.

Шрифты на сайте вариативные, а PIL умеет только статику, поэтому здесь
вариативный woff2 разворачивается в TTF и «замораживается» на нужной оси:
Bricolage — на весе и оптическом размере, Jakarta — на весе.

Каталог `.fonts-ttf/` в git не хранится: это производное от woff2, которые
уже лежат в репозитории.

    python3 make_fonts.py       # → .fonts-ttf/*.ttf
"""

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = Path(__file__).resolve().parent
SRC = HERE / "assets" / "fonts"
OUT = HERE / ".fonts-ttf"

# (файл-источник, имя на выходе, оси)
# Латинского сабсета хватает: в картинках только ASCII плюс «·», «—» и кавычки,
# и все они попадают в диапазоны U+0000-00FF и U+2000-206F.
BUILDS = [
    ("bricolage-grotesque-latin.woff2", "bricolage-700.ttf", {"wght": 700, "opsz": 58}),
    ("plus-jakarta-sans-latin.woff2", "jakarta-600.ttf", {"wght": 600}),
    ("plus-jakarta-sans-latin.woff2", "jakarta-700.ttf", {"wght": 700}),
    ("ibm-plex-mono-latin.woff2", "plexmono-400.ttf", {}),
]


def build(src_name, out_name, axes):
    # Именно latin, а не latin-ext: второй — дополняющий сабсет, в нём нет
    # базовой латиницы, и текст из него вышел бы пустым.
    src = SRC / src_name
    font = TTFont(src)
    if axes and "fvar" in font:
        font = instancer.instantiateVariableFont(font, axes, updateFontNames=False)
    font.flavor = None  # woff2 → обычный TTF, иначе PIL его не откроет
    OUT.mkdir(exist_ok=True)
    font.save(OUT / out_name)
    axis_note = ", ".join(f"{k} {v}" for k, v in axes.items()) or "статический"
    print(f"  {out_name:22} ← {src.name}  ({axis_note})")


def main():
    for src_name, out_name, axes in BUILDS:
        build(src_name, out_name, axes)


if __name__ == "__main__":
    main()
