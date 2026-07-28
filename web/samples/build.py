#!/usr/bin/env python3
"""
Генератор демонстрационных JSON для jsonbeautifier.dev/samples/.

Данные полностью выдуманные — никаких чужих API, никаких реальных людей.
Файлы служат трём задачам: кнопка «Open a sample» на /welcome/, скриншоты для
сайта и стора, и ручная проверка расширения после каждого релиза.

Состав подобран так, чтобы за один файл показать всё, что расширение умеет,
и заодно всё, на чём оно исторически ломалось:

  · вложенность до 6 уровней              — сворачивание и авто-раскрытие
  · массив на 140 элементов               — оконный рендер, «show 100 more»
  · ключи не-идентификаторы                — content-type, x-request-id:
                                             copy-path обязан их экранировать
  · юникод, в том числе японский           — JP наша приоритетная локаль
  · экранированные последовательности      — кавычки, переносы, табы, \\u
  · null, true/false, пустые {} и []       — краевые случаи отрисовки
  · числа: дробные, отрицательные, 0, e    — подсветка типов

Детерминирован: без random и без текущей даты, один и тот же вывод при каждом
запуске, чтобы скриншоты не расходились с файлом.

    python3 build.py            # orders.json + broken.json рядом со скриптом
    python3 build.py --large    # ещё и large.json (~2 МБ, в git не хранится)
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE_DAY = "2026-07-28"


def order(n, oid, customer, city, country, lang, items, status, tracking_steps):
    return {
        "id": oid,
        "status": status,
        "placed_at": f"{BASE_DAY}T{9 + n:02d}:14:02.118Z",
        "customer": {
            "id": f"cus_{4100 + n}",
            "name": customer,
            "email": f"user{n}@example.invalid",
            "preferred_language": lang,
            "vip": n == 2,
            "address": {
                "line1": f"{12 + n} Sample Street",
                "line2": None,
                "city": city,
                "postal_code": f"{10000 + n * 7:05d}",
                "country": country,
            },
        },
        "items": items,
        "shipping": {
            "carrier": "Zumelia Post",
            "service": "standard",
            "tracking": {
                "number": f"ZP{700000 + n * 13}",
                "delivered": status == "delivered",
                "events": [
                    {"at": f"{BASE_DAY}T{10 + i:02d}:05:00Z", "step": step, "location": city}
                    for i, step in enumerate(tracking_steps)
                ],
            },
        },
        "payment": {
            "method": "card",
            "brand": "visa",
            "last4": f"{4242 + n}",
            "captured": True,
            "refunded_amount": -12.5 if n == 3 else 0,
        },
        "flags": {"gift": n == 2, "fragile": False, "requires_signature": None},
    }


def item(sku, title, qty, price, tags):
    return {"sku": sku, "title": title, "quantity": qty, "unit_price": price, "tags": tags}


def build_orders():
    return {
        "_about": "A sample JSON response from jsonbeautifier.dev — everything here is invented. "
                  "Open it with the JSON Beautifier extension to see it as a tree.",
        "api": {
            "name": "Zumelia Orders API",
            "version": "2026-07-01",
            "environment": "sandbox",
            "documentation": "https://jsonbeautifier.dev/docs/",
        },
        "request": {
            "id": "req_01J9KQ2R4M",
            "received_at": f"{BASE_DAY}T09:14:02.118Z",
            "duration_ms": 37.482,
            "cached": False,
            # Ключи с дефисами: copy-path обязан отдавать ["content-type"], а не .content-type
            "headers": {
                "content-type": "application/json; charset=utf-8",
                "x-request-id": "01J9KQ2R4M",
                "cache-control": "no-store, max-age=0",
                "accept-language": "en-US,en;q=0.9,ja;q=0.8",
            },
        },
        "pagination": {"page": 1, "per_page": 3, "total": 1284, "next": "/orders?page=2", "previous": None},
        "orders": [
            order(1, "ord_8123", "Ada Sample", "Rotterdam", "NL", "en",
                  [item("SKU-114", "Mechanical keyboard", 1, 129.0, ["hardware", "desk"]),
                   item("SKU-220", "USB-C cable, 2 m", 2, 11.5, ["cable"])],
                  "shipped", ["label_created", "picked_up", "in_transit"]),
            order(2, "ord_8124", "山田 太郎", "東京", "JP", "ja",
                  [item("SKU-901", "Noise-cancelling headphones", 1, 249.99, ["audio", "gift"]),
                   item("SKU-902", "Carrying case", 1, 24.0, ["audio"]),
                   item("SKU-115", "Keycap set 〈日本語配列〉", 1, 58.25, ["hardware", "unicode"])],
                  "delivered", ["label_created", "picked_up", "in_transit", "out_for_delivery", "delivered"]),
            order(3, "ord_8125", "Renée Étoile", "Montréal", "CA", "fr",
                  [item("SKU-330", "Standing desk mat", 1, 74.0, [])],
                  "partially_refunded", ["label_created", "picked_up"]),
        ],
        "totals": {
            "currency": "USD",
            "subtotal": 771.24,
            "shipping": 0,
            "tax": 61.7,
            "discount": -25.0,
            "grand_total": 807.94,
            "exchange_rates": {"EUR": 0.92, "JPY": 157.4, "CAD": 1.37},
        },
        # Глубокая цепочка: показывает сворачивание и то, что дерево не ломается на глубине
        "diagnostics": {
            "trace": {
                "gateway": {
                    "service": {
                        "handler": {
                            "database": {
                                "query": {
                                    "plan": "index_scan",
                                    "rows_examined": 3,
                                    "duration_ms": 1.204,
                                    "index": "orders_placed_at_idx",
                                }
                            }
                        }
                    }
                }
            },
            # 140 элементов: расширение рисует первую сотню и предлагает «show 100 more»
            "events": [
                {
                    "seq": i,
                    "at": f"{BASE_DAY}T09:{i // 60:02d}:{i % 60:02d}Z",
                    "level": ["debug", "info", "warn"][i % 3],
                    "message": f"worker {i % 7} handled batch {i}",
                    "url": f"https://api.example.invalid/v2/orders?batch={i}",
                }
                for i in range(140)
            ],
        },
        "edge_cases": {
            "empty_object": {},
            "empty_array": [],
            "null_value": None,
            "booleans": [True, False],
            "numbers": {
                "integer": 42,
                "negative": -17,
                "zero": 0,
                "float": 3.14159,
                "exponent": 6.022e23,
                "tiny": 1e-7,
            },
            "unicode": {
                "japanese": "JSON 整形 — 読みやすく",
                "greek": "λ-calculus",
                "emoji": "🧹 formatted",
                "rtl": "مرحبا",
            },
            "escapes": "quotes \" backslash \\ newline \n tab \t unicode é",
            "long_string": "This value is deliberately long so you can see how the viewer "
                           "handles a string that does not fit the width of the window without "
                           "breaking the layout or wrapping the tree into something unreadable.",
        },
    }


def build_broken():
    """Валидный на вид, но не разбирающийся JSON: пропущена запятая на 6-й строке."""
    return (
        '{\n'
        '  "_about": "This file is intentionally broken — it is here to show what the",\n'
        '  "_about_2": "extension does when JSON does not parse: a readable error with a",\n'
        '  "_about_3": "line, a column and the offending text, instead of a blank page.",\n'
        '  "order": {\n'
        '    "id": "ord_8126"\n'
        '    "status": "pending",\n'
        '    "total": 42.0\n'
        '  }\n'
        '}\n'
    )


def build_large():
    """~2 МБ: проверка оконного рендера и предупреждения о больших файлах."""
    return {
        "_about": "A large sample (~2 MB) for testing how the viewer copes with volume.",
        "generated_for": "https://jsonbeautifier.dev/samples/",
        "rows": [
            {
                "id": i,
                "sku": f"SKU-{i:06d}",
                "title": f"Sample product {i}",
                "price": round(5 + (i % 400) * 0.37, 2),
                "in_stock": i % 3 != 0,
                "tags": ["sample", f"batch-{i // 1000}"],
                "meta": {"weight_g": 120 + i % 900, "updated_at": f"{BASE_DAY}T00:00:{i % 60:02d}Z"},
            }
            for i in range(12000)
        ],
    }


def main():
    out = HERE
    orders = json.dumps(build_orders(), ensure_ascii=False, indent=2) + "\n"
    (out / "orders.json").write_text(orders, encoding="utf-8")
    print(f"orders.json  {len(orders):>9,} B  {orders.count(chr(10)):>6} строк")

    broken = build_broken()
    (out / "broken.json").write_text(broken, encoding="utf-8")
    print(f"broken.json  {len(broken):>9,} B")

    if "--large" in sys.argv:
        large = json.dumps(build_large(), ensure_ascii=False) + "\n"
        (out / "large.json").write_text(large, encoding="utf-8")
        print(f"large.json   {len(large):>9,} B")


if __name__ == "__main__":
    main()
