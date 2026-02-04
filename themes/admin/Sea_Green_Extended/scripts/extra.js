(function (window, document, $) {
  "use strict";

  // ---- helpers ----
  function normalizeSpaces(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  function getAdminNicknameFromDropdown() {
    // li with user dropdown (the one that contains personalsettings/logout)
    var $li = $("li.nav-item.dropdown:has(#admin-menu-item-account)").first();
    if (!$li.length) return null;

    // Preferred: extract nickname from text nodes inside the <a> (more robust vs extra spans/icons)
    var $a = $li.find("a.nav-link.dropdown-toggle").first();
    if (!$a.length) return null;

    // Collect direct text nodes of <a> (nickname is usually there as a text node)
    var nickname = null;
    $a.contents().each(function () {
      if (this.nodeType === Node.TEXT_NODE) {
        var t = normalizeSpaces(this.nodeValue);
        if (t) {
          nickname = t;
          return false; // break
        }
      }
    });

    if (nickname) return nickname;

    // Fallback: from full anchor text, remove common junk
    var full = normalizeSpaces($a.text());
    if (!full) return null;

    // Often it looks like: "A admin" (avatar letter + nickname)
    // Remove leading single-letter avatar if present
    full = full.replace(/^[A-ZА-Я]\s+/, "");
    // Remove caret if somehow included
    full = full.replace(/\s*caret\s*/i, " ");
    return normalizeSpaces(full) || null;
  }

  // ---- main ----
  function logAdminNickname() {
    var nick = getAdminNicknameFromDropdown();
    if (nick) {
      console.log("[DS] Admin nickname/login:", nick);
    } else {
      console.log("[DS] Admin nickname/login: not found");
    }
  }

  // ---- fast run strategy (dom ready + pjax + mutation observer) ----
  var scheduled = false;
  function scheduleRun() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function () {
      scheduled = false;
      try {
        logAdminNickname();
      } catch (e) {
        // keep admin console clean unless needed
        // console.warn("[DS] nickname log failed", e);
      }
    });
  }

  // ASAP attempt
  scheduleRun();

  // DOM ready
  $(function () {
    scheduleRun();
  });

  // PJAX hooks (admin loads content dynamically sometimes)
  $(document).on("pjax:success pjax:complete", scheduleRun);
  document.addEventListener("pjax:success", scheduleRun);
  document.addEventListener("pjax:complete", scheduleRun);

  // MutationObserver (catches late navbar render)
  if ("MutationObserver" in window) {
    var mo = new MutationObserver(function () {
      scheduleRun();
    });

    function attachMO() {
      if (!document.body) {
        window.requestAnimationFrame(attachMO);
        return;
      }
      mo.observe(document.body, { childList: true, subtree: true });
    }
    attachMO();
  } else {
    window.setTimeout(scheduleRun, 300);
  }
})(window, document, window.jQuery);
