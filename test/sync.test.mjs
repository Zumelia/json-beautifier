/*
 * Копия ядра в пакете расширения обязана совпадать с источником.
 *
 * core/core.js — единственный источник правды, но манифест не может ссылаться
 * на файлы вне корня пакета, поэтому extension-chrome/src/core.js существует
 * как сгенерированная копия (scripts/sync-core.sh). Копия, которую никто не
 * проверяет, рано или поздно расходится с оригиналом — этот тест делает
 * расхождение ошибкой сборки, а не сюрпризом в проде.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

let pass = 0, fail = 0;
const results = [];
const check = (name, ok, detail = "") => {
  results.push([ok ? "✅" : "❌", name, detail]);
  ok ? pass++ : fail++;
};

const SOURCE = path.join(root, "core/core.js");
const COPIES = ["extension-chrome/src/core.js"];
const HEADER_RE = /^\/\* GENERATED FILE[^\n]*\n/;

const canonical = readFileSync(SOURCE, "utf8");
check("источник ядра на месте", canonical.length > 0);

for (const rel of COPIES) {
  const full = path.join(root, rel);
  if (!existsSync(full)) {
    check(`${rel}: копия существует`, false, "нет файла — запустите scripts/sync-core.sh");
    continue;
  }
  const copy = readFileSync(full, "utf8");
  check(`${rel}: помечена как сгенерированная`, HEADER_RE.test(copy), copy.slice(0, 60));
  check(
    `${rel}: совпадает с core/core.js`,
    copy.replace(HEADER_RE, "") === canonical,
    "расхождение — запустите scripts/sync-core.sh"
  );
}

// Манифест обязан грузить ядро ПЕРЕД контент-скриптом: content.js без
// globalThis.JSONBeautifierCore молча выходит, и расширение выглядит мёртвым.
{
  const manifest = JSON.parse(readFileSync(path.join(root, "extension-chrome/manifest.json"), "utf8"));
  const js = manifest.content_scripts?.[0]?.js || [];
  check("манифест Chrome: ядро первым в content_scripts",
    js[0] === "src/core.js" && js.includes("src/content.js"), JSON.stringify(js));
}

// То же для Firefox: манифест-оверлей не обязан переопределять content_scripts,
// но если переопределяет — порядок должен быть тот же.
{
  const ffPath = path.join(root, "extension-firefox/manifest.json");
  if (existsSync(ffPath)) {
    const ff = JSON.parse(readFileSync(ffPath, "utf8"));
    const js = ff.content_scripts?.[0]?.js;
    check("манифест Firefox: ядро первым в content_scripts",
      !js || (js[0] === "src/core.js" && js.includes("src/content.js")), JSON.stringify(js));
    check("манифест Firefox: фон — event page, не service_worker",
      !!ff.background?.scripts && !ff.background?.service_worker, JSON.stringify(ff.background));
    check("манифест Firefox: задан gecko id",
      !!ff.browser_specific_settings?.gecko?.id, JSON.stringify(ff.browser_specific_settings));
  }
}

console.log("");
for (const [m, n, d] of results) console.log(`  ${m} ${n}${d ? "  — " + d : ""}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
