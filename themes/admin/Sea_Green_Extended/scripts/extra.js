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

  function patchFooterHelpMenu() {
    var footer = document.querySelector("footer.footer");
    if (!footer) return;

    // 1) remove donate button
    var donate = footer.querySelector("#donate-button");
    if (donate) donate.remove();

    // 2) remove "Release notes" item if it exists (safety, in case menu isn't rebuilt)
    var helpMenu = footer.querySelector("#help-button-dropup .dropdown-menu");
    if (helpMenu) {
      var releaseNotesLink = helpMenu.querySelector('a[href="https://community.limesurvey.org/releases/"]');
      if (releaseNotesLink) {
        var li = releaseNotesLink.closest("li");
        if (li) li.remove();
        else releaseNotesLink.remove();
      }
    }

    // 3) rebuild help dropdown menu
    var dropup = footer.querySelector("#help-button-dropup");
    if (!dropup) return;

    var menu = dropup.querySelector(".dropdown-menu");
    if (!menu) return;

    // Prevent duplicate rebuilds
    if (menu.dataset.dsRebuilt === "1") return;

    // Clear existing menu
    menu.innerHTML = "";

    // Build new menu
    var headerLi = document.createElement("li");
    var headerSpan = document.createElement("span");
    headerSpan.className = "dropdown-header";
    headerSpan.textContent = "Контакты";
    headerLi.appendChild(headerSpan);
    menu.appendChild(headerLi);

    // Email item
    var emailLi = document.createElement("li");
    var emailA = document.createElement("a");
    emailA.className = "dropdown-item";
    emailA.href = "mailto:info@diveanddiscovery-research.com";
    emailA.textContent = "Email: info@diveanddiscovery-research.com";
    emailLi.appendChild(emailA);
    menu.appendChild(emailLi);

    // Telegram item
    var tgLi = document.createElement("li");
    var tgA = document.createElement("a");
    tgA.className = "dropdown-item";
    tgA.href = "https://t.me/milabalan";
    tgA.target = "_blank";
    tgA.rel = "noopener noreferrer";
    tgA.textContent = "Telegram: @milabalan";
    tgLi.appendChild(tgA);
    menu.appendChild(tgLi);

    // Is Admin Loaded item, not link
    var adminLi = document.createElement("li");
    var adminWrap = document.createElement("div");
    adminWrap.className = "dropdown-item-text";
    adminWrap.textContent = "Admin Loaded: " + (isAdminLoaded() ? "Yes" : "No");
    adminLi.appendChild(adminWrap);
    menu.appendChild(adminLi);

    // Divider
    var divider = document.createElement("li");
    divider.className = "dropdown-divider";
    menu.appendChild(divider);

    // About header
    var aboutHeaderLi = document.createElement("li");
    var aboutHeaderSpan = document.createElement("span");
    aboutHeaderSpan.className = "dropdown-header";
    aboutHeaderSpan.textContent = "Информация о нас";
    aboutHeaderLi.appendChild(aboutHeaderSpan);
    menu.appendChild(aboutHeaderLi);

    // About text (as non-clickable text)
    var aboutLi = document.createElement("li");
    var aboutWrap = document.createElement("div");
    // Use Bootstrap-ish spacing; dropdown-item makes it look like menu content but not a link
    aboutWrap.className = "dropdown-item-text small";
    aboutWrap.style.whiteSpace = "normal";
    aboutWrap.style.maxWidth = "360px"; // tweak if you want
    aboutWrap.textContent =
        "ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ «ДАЙВ ЕНД ДІСКАВЕРІ РІСЬОРЧ» 08297, Україна, Київська обл. Бучанський район, смт. Ворзель, вул.Кондратюка 23/1 ЄДРПОУ 44823765";
    aboutLi.appendChild(aboutWrap);
    menu.appendChild(aboutLi);

    menu.dataset.dsRebuilt = "1";
  }


  function isAdminLoaded() {
    return getAdminNicknameFromDropdown() === "admin";
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
        console.log("[DS] logging admin nickname");
        logAdminNickname();
        console.log("[DS] patching footer help menu");
        patchFooterHelpMenu();
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
