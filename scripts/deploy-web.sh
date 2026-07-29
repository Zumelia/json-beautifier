#!/usr/bin/env bash
#
# Сборка и выкладка сайта на ops-de.
#
# Порядок здесь не декоративный. stamp.py обязан отработать ПОСЛЕ генераторов и
# ДО копирования: он проставляет в ссылки хэш содержимого, и без этого шага
# Cloudflare продолжит отдавать посетителям старые css и js часами, потому что
# имя файла не изменилось. Ровно так /uninstall/ однажды показалась с новой
# разметкой и прошлыми стилями.
#
set -euo pipefail

cd "$(dirname "$0")/../web"
ROOT=/var/www/jsonbeautifier.dev

echo "1. генерация"
python3 build.py
python3 build_pages.py
python3 build_docs.py
python3 build_reviewers.py

echo "2. версии ассетов"
python3 stamp.py

echo "3. выкладка"
mkdir -p "$ROOT/assets"
cp -R assets/. "$ROOT/assets/"
cp index.html 404.html "$ROOT/"
cp favicon.ico favicon.png apple-touch-icon.png "$ROOT/"
# Файл подтверждения Search Console, если он заведён. Лежит в репозитории, а не
# кладётся руками в вебрут: подтверждение проверяется повторно и молча слетает,
# если файл однажды не переживёт выкладку. Забытая верификация не падает с
# ошибкой — сайт просто перестаёт числиться нашим.
for v in google*.html; do
  [ -e "$v" ] && cp "$v" "$ROOT/"
done
for dir in */; do
  [ -f "$dir/index.html" ] || continue
  mkdir -p "$ROOT/$dir"
  cp "$dir/index.html" "$ROOT/$dir"
done
# Образцы: large.json в git не хранится, генерируется на месте
if [ -d samples ]; then
  [ -f samples/large.json ] || python3 samples/build.py --large >/dev/null
  cp samples/*.json samples/index.html "$ROOT/samples/" 2>/dev/null || true
fi

echo "4. проверка"
for u in "" docs/ changelog/ uninstall/ feedback/ rate/ welcome/ privacy/ \
         json-formatter/ json-validator/ json-minifier/ samples/ no-such-page/; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "https://jsonbeautifier.dev/$u")
  printf "   %-20s %s\n" "/$u" "$code"
done
