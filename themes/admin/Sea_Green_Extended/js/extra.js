/**
 * DiscoverySurvey admin tweaks for LimeSurvey (admin theme embed).
 * - Replaces navbar logo
 * - Patches statistics headings by removing bracket parts / CSS-like junk
 * - Cleans footer links/buttons
 *
 * Requirements: jQuery is available (LimeSurvey admin usually has it).
 *
 * Place into admin theme JS and include as early as possible (in <head> if you can).
 */
(function (window, document, $) {
  "use strict";

  // ---- CONFIG (adjust paths/text to your theme) ----
  // Лучше указывать путь как URL, который точно доступен в теме.
  // Например: '/upload/themes/admin/Sea_Green_Extended/files/img/logo.png'
  // или относительный путь от текущей страницы, если он стабилен.
  var LOGO_URL = "images/logo-santa-152x164-transparent-outline-v2.png";
  var BRAND_FALLBACK_TEXT = "DiscoverySurvey";

  // ---- Helpers ----
  function sanitizeText(s) {
    if (!s) return s;

    // 1) убрать всё в квадратных скобках: [....]
    s = s.replace(/\s*\[[^\]]*]/g, "");

    // 2) убрать CSS правила целиком: ".x { ... }", "#x { ... }"
    s = s.replace(/(?:^|\s)(?:\.[\w-]+|#[\w-]+)(?::[\w-]+)?[^{]*\{[\s\S]*?\}/g, " ");

    // 3) убрать @media/@keyframes блоки (если вдруг попадаются)
    s = s.replace(/@[\w-]+\s*[^{]*\{[\s\S]*?\}/g, " ");

    // 4) если остались фигурные скобки и это похоже на CSS ("prop: value;") — вырезаем блок
    if (s.indexOf("{") !== -1 && s.indexOf("}") !== -1 && /[a-z-]+\s*:\s*[^;]+;/i.test(s)) {
      s = s.replace(/\{[\s\S]*\}/, " ");
    }

    // финальная чистка
    s = s.replace(/[{}]/g, " ");
    s = s.replace(/\s{2,}/g, " ");
    return s;
  }

  function trimTrailingWhitespaceAndBr(el) {
    while (el.lastChild) {
      var n = el.lastChild;

      if (n.nodeType === Node.TEXT_NODE && !n.textContent.trim()) {
        el.removeChild(n);
        continue;
      }
      if (n.nodeType === Node.ELEMENT_NODE && n.tagName === "BR") {
        el.removeChild(n);
        continue;
      }
      break;
    }
  }

  // ---- Patchers ----
  function replaceNavbarLogo() {
    // Селектор из твоего скрипта; оставляем, но делаем мягче.
    var $img = $("nav.navbar a.navbar-brand img").first();
    if (!$img.length) return;

    if ($img.attr("data-ds-replaced") === "1") {
      $img.css("visibility", "visible");
      return;
    }

    // Максимально быстро: просто меняем src на доступный URL
    $img.attr("src", LOGO_URL);
    $img.removeAttr("srcset");
    $img.css("visibility", "visible");
    $img.attr("data-ds-ready", "1");
    $img.attr("data-ds-replaced", "1");
  }

  function patchStatisticsHeadings() {
    var root = document.querySelector("#statisticsoutput");
    if (!root) return;

    var h4s = root.querySelectorAll("h4");
    for (var i = 0; i < h4s.length; i++) {
      var h4 = h4s[i];

      if (h4.dataset.dsPatched === "1") {
        h4.setAttribute("data-ds-ready", "1");
        continue;
      }

      var walker = document.createTreeWalker(h4, NodeFilter.SHOW_TEXT);
      var node;
      var changed = false;

      while ((node = walker.nextNode())) {
        var orig = node.nodeValue;
        var cleaned = sanitizeText(orig);
        if (cleaned !== orig) {
          node.nodeValue = cleaned;
          changed = true;
        }
      }

      if (changed) {
        h4.normalize();
        trimTrailingWhitespaceAndBr(h4);
      }

      h4.dataset.dsPatched = "1";
      h4.setAttribute("data-ds-ready", "1");
    }
  }

  function patchFooter() {
    var footer = document.querySelector("footer.footer");
    if (!footer) return;

    var donate = footer.querySelector("#donate-button");
    if (donate) donate.remove();

    var help = footer.querySelector("#help-button-dropup");
    if (help) help.remove();

    var communityLink = footer.querySelector('a[href^="https://community.limesurvey.org"]');
    if (communityLink && !communityLink.dataset.dsReplaced) {
      communityLink.replaceWith(document.createTextNode(BRAND_FALLBACK_TEXT));
      // dataset у текст-ноды нет, поэтому ставим флаг на footer
      footer.setAttribute("data-ds-footer", "1");
    }
  }

  // ---- Fast scheduler (coalescing) ----
  var scheduled = false;
  function scheduleRun() {
    if (scheduled) return;
    scheduled = true;

    // Самый быстрый “не мешающий” запуск — в следующий кадр
    window.requestAnimationFrame(function () {
      scheduled = false;
      try {
        patchFooter();
        replaceNavbarLogo();
        patchStatisticsHeadings();
      } catch (e) {
        // по умолчанию молчим (в админке лучше без шума)
        // console.warn("DS tweaks failed:", e);
      }
    });
  }

  // ---- Boot ASAP ----
  // 1) мгновенная попытка (если скрипт подключён рано — часть DOM может быть ещё не готова, но это ок)
  scheduleRun();

  // 2) DOM ready (jQuery)
  $(function () {
    scheduleRun();
  });

  // 3) PJAX (LimeSurvey часто использует pjax в админке)
  // Слушаем и jQuery-события, и DOM-события на всякий случай
  $(document).on("pjax:success pjax:complete", scheduleRun);
  document.addEventListener("pjax:success", scheduleRun);
  document.addEventListener("pjax:complete", scheduleRun);

  // 4) MutationObserver — самый надёжный и быстрый способ поймать позднюю подгрузку navbar/statistics
  // Ограничиваемся body и коалесим через scheduleRun (чтобы не лупить патчи на каждый узел)
  if ("MutationObserver" in window) {
    var mo = new MutationObserver(function () {
      scheduleRun();
    });

    // Вешаемся когда body есть
    function attachMO() {
      var body = document.body;
      if (!body) {
        window.requestAnimationFrame(attachMO);
        return;
      }
      mo.observe(body, { childList: true, subtree: true });
    }
    attachMO();
  } else {
    // fallback: один короткий таймаут (как у тебя)
    window.setTimeout(scheduleRun, 300);
  }
})(window, document, window.jQuery);
