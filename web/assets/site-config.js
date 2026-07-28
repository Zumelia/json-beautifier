/*
 * Единственное место со ссылкой на стор. Меняется здесь и только здесь.
 *
 * Параметра hl нет намеренно: без него Chrome Web Store показывает листинг на
 * языке пользователя, а он у нас переведён на 52 локали — это наша ось
 * отстройки, и глушить её принудительным английским нельзя.
 */
window.JB_CONFIG = (() => {
  const STORE_ID = "mpeomjgcmddedcglokpmeideoelaidbn";
  const STORE_URL = `https://chromewebstore.google.com/detail/${STORE_ID}`;
  return {
    STORE_ID,
    STORE_URL,
    REVIEWS_URL: `${STORE_URL}/reviews`,
    GITHUB_URL: "https://github.com/Zumelia/json-beautifier",
    // slot — место, откуда пришёл клик: hero · header · tool-hint · tool-prompt ·
    // faq · footer · rate · mobile-menu. По нему в дашборде CWS видно, какая
    // кнопка работает, а какая стоит зря.
    cta: (slot) =>
      `${STORE_URL}?utm_source=jsonbeautifier.dev&utm_medium=site&utm_campaign=${slot}`,

    /*
     * Локали. Переключатель языка показывается только когда доступна больше
     * одной — иначе он ведёт в 404, а мёртвая ссылка хуже отсутствующей.
     * Появится перевод — ставим available: true, и переключатель включается сам.
     *
     * Порядок не случайный: японский первым, потому что это единственная локаль
     * с реальным поисковым потенциалом (`json 整形` 18 100 против английского
     * 4 400 в японской базе). Остальные — по размеру аудитории разработчиков,
     * и работают на конверсию, а не на новый трафик.
     */
    LOCALES: [
      { code: "en", name: "English", note: "x-default", href: "/", available: true },
      { code: "ja", name: "日本語", note: "priority", href: "/ja/", available: false },
      { code: "de", name: "Deutsch", note: "", href: "/de/", available: false },
      { code: "fr", name: "Français", note: "", href: "/fr/", available: false },
      { code: "es", name: "Español", note: "", href: "/es/", available: false },
      { code: "pt-BR", name: "Português (BR)", note: "", href: "/pt-br/", available: false },
      { code: "ru", name: "Русский", note: "", href: "/ru/", available: false },
      { code: "zh-CN", name: "简体中文", note: "", href: "/zh-cn/", available: false },
      { code: "ko", name: "한국어", note: "", href: "/ko/", available: false },
      { code: "it", name: "Italiano", note: "", href: "/it/", available: false },
    ],
  };
})();
