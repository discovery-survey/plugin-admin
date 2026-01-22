const LOGO_PATH = "img/logo-santa-152x164-transparent-outline-v2.png";
let logoDataUrlPromise = null;

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
    });
}

function sanitizeText(s) {
    if (!s) return s;

    // 1) убрать всё в квадратных скобках: [....]
    s = s.replace(/\s*\[[^\]]*]/g, "");

    // 2) убрать CSS правила целиком: ".x { ... }", "#x { ... }"
    //    (работает и для :hover, etc)
    s = s.replace(/(?:^|\s)(?:\.[\w-]+|#[\w-]+)(?::[\w-]+)?[^{]*\{[\s\S]*?\}/g, " ");

    // 3) убрать @media/@keyframes блоки (если вдруг попадаются)
    s = s.replace(/@[\w-]+\s*[^{]*\{[\s\S]*?\}/g, " ");

    // 4) если остались фигурные скобки и это похоже на CSS (есть "prop: value;"),
    //    то вырезаем всё между первой "{" и последней "}" в этой строке
    if (s.includes("{") && s.includes("}") && /[a-z-]+\s*:\s*[^;]+;/i.test(s)) {
        s = s.replace(/\{[\s\S]*\}/, " ");
    }

    // финальная чистка
    s = s.replace(/[{}]/g, " ");
    s = s.replace(/\s{2,}/g, " ");

    return s;
}

function trimTrailingWhitespaceAndBr(el) {
    while (el.lastChild) {
        const n = el.lastChild;

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

function patchStatisticsHeadings() {
    const root = document.querySelector("#statisticsoutput");
    if (!root) return;

    // можно сузить до ".row .printable h4", но я оставил чуть шире — на всякий случай
    const h4s = root.querySelectorAll("h4");
    h4s.forEach((h4) => {
        if (h4.dataset.dsPatched === "1") {
            // просто снимаем скрытие, если вдруг осталось
            h4.setAttribute("data-ds-ready", "1");
            return;
        }

        const walker = document.createTreeWalker(h4, NodeFilter.SHOW_TEXT);
        let node;
        let changed = false;

        while ((node = walker.nextNode())) {
            const orig = node.nodeValue;
            const cleaned = sanitizeText(orig);
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
        h4.setAttribute("data-ds-ready", "1"); // снимает visibility:hidden из early.css
    });
}

async function getLogoDataUrl() {
    if (!logoDataUrlPromise) {
        logoDataUrlPromise = fetch(chrome.runtime.getURL(LOGO_PATH))
            .then((res) => {
                if (!res.ok) throw new Error(`Failed to load ${LOGO_PATH}: ${res.status}`);
                return res.blob();
            })
            .then(blobToDataUrl);
    }
    return logoDataUrlPromise;
}

async function replaceNavbarLogo() {
    const img = document.querySelector(
        "nav.navbar a.navbar-brand img.d-inline-block.align-bottom"
    );
    if (!img) return;

    if (img.dataset.dsReplaced === "1") {
        // на всякий случай показать, если скрыто CSS-ом
        img.style.visibility = "visible";
        return;
    }

    const dataUrl = await getLogoDataUrl();
    img.src = dataUrl;
    img.srcset = "";
    img.style.visibility = "visible";
    img.setAttribute("data-ds-ready", "1");
    img.dataset.dsReplaced = "1";
}

function patchFooter() {
    const footer = document.querySelector("footer.footer");
    if (!footer) return;

    footer.querySelector("#donate-button")?.remove();
    footer.querySelector("#help-button-dropup")?.remove();

    const communityLink = footer.querySelector('a[href^="https://community.limesurvey.org"]');
    if (communityLink && !communityLink.dataset.dsReplaced) {
        communityLink.replaceWith(document.createTextNode("DiscoverySurvey"));
    }
}

let scheduled = false;
function scheduleRun() {
    if (scheduled) return;
    scheduled = true;

    // запускаем в следующий кадр — чтобы не мешать внутренним операциям PJAX
    requestAnimationFrame(async () => {
        scheduled = false;
        try {
            patchFooter();
            await replaceNavbarLogo();

            patchStatisticsHeadings();
        } catch (e) {
            // можно закомментировать, если шумит
            // console.warn("DS tweaks failed:", e);
        }
    });
}

// 1) старт
scheduleRun();

// 2) когда DOM готов
document.addEventListener("DOMContentLoaded", scheduleRun, { once: true });

// 3) PJAX события (MoOx/pjax обычно кидает их на document)
document.addEventListener("pjax:send", () => {
    // ничего не делаем во время запроса
});

document.addEventListener("pjax:success", scheduleRun);
document.addEventListener("pjax:complete", scheduleRun);

// 4) запасной вариант: если PJAX не кидает события (или тема их режет)
setTimeout(scheduleRun, 500);
