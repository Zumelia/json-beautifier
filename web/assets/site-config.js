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
  };
})();
