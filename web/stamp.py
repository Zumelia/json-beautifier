#!/usr/bin/env python3
"""
Проставляет версию содержимого в ссылки на ассеты: /assets/site.css →
/assets/site.css?v=8f3ac21b

Зачем. Сайт стоит за Cloudflare, который кэширует css и js на часы. Пока имя
файла не меняется, посетитель продолжает получать старую версию, даже когда на
сервере лежит новая — именно так вышло с формами на /uninstall/: разметка была
новая, стили старые, и страница выглядела сломанной.

Ровно та же ошибка, что и с перезаписью zip-сборки под прежним именем. Правило
одно: меняется содержимое — меняется адрес. Хэш считается от файла, поэтому
адрес обновляется сам и ровно тогда, когда нужно; сбрасывать кэш руками не надо.

    python3 stamp.py        # после build*.py, перед выкладкой
"""

import hashlib
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASSETS = HERE / "assets"

REF = re.compile(r'(?P<attr>href|src)="(?P<path>/assets/[^"?]+)(?:\?v=[0-9a-f]+)?"')


def digest(rel_path):
    f = ASSETS / rel_path
    if not f.exists():
        return None
    return hashlib.sha1(f.read_bytes()).hexdigest()[:8]


def stamp(text):
    def sub(m):
        rel = m.group("path")[len("/assets/") :]
        h = digest(rel)
        if not h:
            return m.group(0)
        return f'{m.group("attr")}="/assets/{rel}?v={h}"'

    return REF.sub(sub, text)


def main():
    files = [HERE / "index.html", HERE / "404.html"]
    files += [p / "index.html" for p in sorted(HERE.iterdir()) if (p / "index.html").exists()]

    # fonts.css ссылается на файлы шрифтов — их тоже версионируем
    fonts = ASSETS / "fonts.css"
    if fonts.exists():
        src = fonts.read_text(encoding="utf-8")

        def font_sub(m):
            rel = m.group(1)
            h = digest(rel)
            return f"url('{rel}?v={h}')" if h else m.group(0)

        out = re.sub(r"url\('([^']+\.woff2)(?:\?v=[0-9a-f]+)?'\)", font_sub, src)
        if out != src:
            fonts.write_text(out, encoding="utf-8")
            print("  fonts.css: версии шрифтов проставлены")

    changed = 0
    for f in files:
        if not f.exists():
            continue
        src = f.read_text(encoding="utf-8")
        out = stamp(src)
        if out != src:
            f.write_text(out, encoding="utf-8")
            changed += 1
    print(f"  проставлено в {changed} файлах")
    for name in ["site.css", "site.js", "core.js", "site-config.js", "forms.js", "docs.js", "fonts.css"]:
        h = digest(name)
        if h:
            print(f"    {name:16} v={h}")


if __name__ == "__main__":
    main()
