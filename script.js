const DATA_URL = "data.json";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const html = document.documentElement;
const body = document.body;

const nav = $("#nav");
let navItems = $$(".nav-item");
const menuBtn = $("#menuBtn");
const themeBtn = $("#themeBtn");
const themeIcon = $("#themeIcon");

const hero = $("#home");
const brandName = $("#brandName");
const brandIcon = $("#brandIcon");

const heroName = $("#heroName");
const mainPhoto = $("#mainPhoto");
const mainPhotoEffects = $("#mainPhotoEffects");
const mainPhotoImg = $("#mainPhotoImg");
const mainPhotoCaption = $("#mainPhotoCaption");
const waitingBook = $("#waitingBook");
const waitingCount = $("#waitingCount"); // optional: removed when WAITING label is hidden

const modal = $("#imageModal");
const modalImage = $("#modalImage");
const modalCaption = $("#modalCaption");
const modalClose = $("#modalClose");

const cursorCore = $("#cursorCore");
const cursorHalo = $("#cursorHalo");

const siteLoader = $("#siteLoader");
const loaderLogo = $("#loaderLogo");
const loaderBar = $("#loaderBar");
const loaderPercent = $("#loaderPercent");
const loaderStatus = $("#loaderStatus");
const loaderProgress = $("#loaderProgress");
const ASSET_CACHE_NAME = "ameng-portfolio-assets-v4";
const ASSET_SIGNATURE_KEY = "ameng-portfolio-asset-signature-v4";

let appData = null;
let galleryFilter = "all";
let profilePhotos = [];
let activePhotoIndex = -1;
let heroTimer = null;
let currentBrandText = "";

init();

async function init() {
  setupTheme();
  setupMenu();
  setupCursor();
  setupModal();
  updateLoaderProgress(3, "Loading profile data...");

  try {
    const response = await fetch(DATA_URL, { cache: "default" });
    if (!response.ok) throw new Error(`Could not load ${DATA_URL}`);

    appData = await response.json();
    setLoaderLogo(appData);

    const preloadAssets = collectPreloadAssets(appData);
    await registerServiceWorker();
    await preloadImageAssets(preloadAssets);

    applySectionVisibility(appData.sections || {});
    applyHeadBranding(appData);
    renderProfile(appData);
    renderLogo(appData);
    renderStory(appData.about || {});
    renderSkills(appData.skills || []);
    renderAchievements(appData.achievements || []);
    renderHero(appData.gallery?.profile || []);
    renderGallery();
    renderCreator(appData.creator);
    setupReveal();
    setupGalleryTabs();
    setupMainPhotoTilt();
    setupScrollSpy();

    updateLoaderProgress(100, "Ready");
    hideLoader();
  } catch (error) {
    console.error(error);
    heroName.textContent = "Portfolio";
    updateLoaderProgress(100, "Loaded with some missing assets");
    hideLoader();
  }
}


function updateLoaderProgress(value, status = "Loading...") {
  const percent = Math.max(0, Math.min(100, Math.round(value)));

  if (loaderBar) loaderBar.style.width = `${percent}%`;
  if (loaderPercent) loaderPercent.textContent = `${percent}%`;
  if (loaderStatus) loaderStatus.textContent = status;
  if (loaderProgress) loaderProgress.setAttribute("aria-valuenow", String(percent));
}

function hideLoader() {
  window.setTimeout(() => {
    body.classList.add("app-loaded");
    body.classList.remove("loader-active");
  }, 380);
}

function setLoaderLogo(data) {
  const logo = data?.gallery?.logo || getImageUrl(data?.gallery?.profile?.[0]) || "";
  if (loaderLogo && logo) loaderLogo.src = logo;
}

function collectPreloadAssets(data) {
  const gallery = data?.gallery || {};
  const achievements = Array.isArray(data?.achievements) ? data.achievements : [];
  const assets = [
    gallery.logo,
    ...(gallery.profile || []).map(getImageUrl),
    ...(gallery.picture || []).map(getImageUrl),
    ...achievements.map((item) => item?.img)
  ];

  return [...new Set(assets.map(resolveAssetUrl).filter(Boolean))];
}

function getImageUrl(item) {
  return item?.img || item?.url || "";
}

function resolveAssetUrl(url) {
  if (!valid(url)) return "";
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return "";
  }
}

async function preloadImageAssets(assets) {
  if (!assets.length) {
    updateLoaderProgress(100, "No images to preload");
    return;
  }

  const signature = assets.join("|");
  const cached = await areAssetsCached(assets);

  if (localStorage.getItem(ASSET_SIGNATURE_KEY) === signature && cached) {
    updateLoaderProgress(100, "Loaded from cache");
    return;
  }

  let completed = 0;
  updateLoaderProgress(6, `Preparing ${assets.length} image${assets.length === 1 ? "" : "s"}...`);

  await runWithConcurrency(assets, 4, async (asset) => {
    await Promise.allSettled([
      decodeImage(asset),
      warmAssetCache(asset)
    ]);

    completed += 1;
    const progress = 6 + (completed / assets.length) * 94;
    updateLoaderProgress(progress, `Loading images ${completed}/${assets.length}`);
  });

  localStorage.setItem(ASSET_SIGNATURE_KEY, signature);
}

async function runWithConcurrency(items, limit, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });

  await Promise.allSettled(workers);
}

function decodeImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (img.decode) {
        img.decode().catch(() => {}).finally(resolve);
      } else {
        resolve();
      }
    };
    img.onerror = resolve;
    img.src = src;
  });
}

async function warmAssetCache(url) {
  if (!("caches" in window)) return;

  try {
    const cache = await caches.open(ASSET_CACHE_NAME);
    const request = new Request(url, { mode: "no-cors" });
    const existing = await cache.match(request) || await cache.match(url);

    if (existing) return;

    const response = await fetch(request);
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn("Asset cache skipped:", url, error);
  }
}

async function areAssetsCached(assets) {
  if (!("caches" in window)) return localStorage.getItem(ASSET_SIGNATURE_KEY) === assets.join("|");

  try {
    const cache = await caches.open(ASSET_CACHE_NAME);
    const checks = await Promise.all(assets.map(async (asset) => {
      const request = new Request(asset, { mode: "no-cors" });
      return Boolean(await cache.match(request) || await cache.match(asset));
    }));

    return checks.every(Boolean);
  } catch {
    return false;
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const isSecure = window.isSecureContext || location.hostname === "localhost";
  if (!isSecure) return;

  try {
    await navigator.serviceWorker.register("sw.js");
  } catch (error) {
    console.warn("Service worker registration skipped:", error);
  }
}

function applyHeadBranding(data) {
  const profile = data?.profile || {};
  const gallery = data?.gallery || {};
  const profilePhotos = (gallery.profile || [])
    .map((item) => item?.img || item?.url)
    .filter(Boolean);

  const logo = gallery.logo || profilePhotos[0] || "";
  const title = data?.site?.title || `${profile.name || "Portfolio"} | Portfolio`;
  const description = document.querySelector('meta[name="description"]')?.getAttribute("content")
    || `Discover ${profile.name || "this portfolio"}'s personal website.`;

  const randomImage = profilePhotos.length
    ? profilePhotos[Math.floor(Math.random() * profilePhotos.length)]
    : (logo || "");

  const favicon = document.getElementById("siteFavicon");
  const shortcut = document.querySelector('link[rel="shortcut icon"]');
  const appleTouch = document.getElementById("siteAppleTouchIcon");
  const ogImage = document.getElementById("metaOgImage");
  const ogImageAlt = document.getElementById("metaOgImageAlt");
  const ogUrl = document.getElementById("metaOgUrl");
  const twitterImage = document.getElementById("metaTwitterImage");

  document.title = title;

  if (favicon && logo) favicon.href = logo;
  if (shortcut && logo) shortcut.href = logo;
  if (appleTouch && logo) appleTouch.href = logo;

  if (ogImage && randomImage) ogImage.setAttribute("content", randomImage);
  if (twitterImage && randomImage) twitterImage.setAttribute("content", randomImage);
  if (ogImageAlt) ogImageAlt.setAttribute("content", profile.name || "Profile image");
  if (ogUrl) ogUrl.setAttribute("content", window.location.href);

  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', description);

  // Note:
  // Runtime-random meta images work in the browser, but many social crawlers do not run JavaScript.
  // On purely static hosting like GitHub Pages, the HTML fallback image is what most platforms will use.
}

function setMetaContent(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute("content", value);
}

function applySectionVisibility(sections) {
  const showAchievements = sections.achievements !== false;
  const achievementSection = $("#achievements");
  const achievementNav = $('[data-nav-section="achievements"]');

  if (!showAchievements) {
    achievementSection.hidden = true;
    achievementSection.classList.remove("nav-section");
    achievementNav.hidden = true;
  }

  navItems = $$(".nav-item:not([hidden])");
}

function renderProfile(data) {
  const profile = data.profile;

  document.title = data.site?.title || `${profile.name} | Portfolio`;
  setBrandName(profile.nickname || profile.name, true);
  renderHeroName(profile.name || "Portfolio");
  $("#aboutTagline").textContent = pickText(profile.tagline);
}

function renderHeroName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 3) {
    const firstLine = parts.slice(0, -1).map(renderNameWord).join(" ");
    const lastLine = renderNameWord(parts.at(-1));
    heroName.innerHTML = `
      <span class="name-line">${firstLine}</span>
      <span class="name-line">${lastLine}</span>
    `;
  } else {
    heroName.innerHTML = `<span class="name-line">${parts.map(renderNameWord).join(" ")}</span>`;
  }
}

function renderNameWord(word) {
  return `<span class="name-word">${String(word)
    .split("")
    .map((letter) => `<span class="name-letter">${escapeHtml(letter)}</span>`)
    .join("")}</span>`;
}

function setBrandName(text, immediate = false) {
  if (currentBrandText === text) return;
  currentBrandText = text;

  if (immediate) {
    brandName.textContent = text;
    return;
  }

  brandName.classList.add("switching");
  setTimeout(() => {
    brandName.textContent = text;
    brandName.classList.remove("switching");
  }, 160);
}

function renderLogo(data) {
  const logo = data.gallery?.logo;

  if (valid(logo)) {
    brandIcon.classList.add("has-img");
    brandIcon.innerHTML = `<img src="${escapeHtml(logo)}" alt="${escapeHtml(data.profile?.nickname || "Logo")}">`;
  } else {
    brandIcon.textContent = (data.profile?.nickname || data.profile?.name || "A").trim().charAt(0);
  }
}

function renderStory(about) {
  const storyHolder = $("#storyText");
  storyHolder.innerHTML = "";

  const story = Array.isArray(about.story) ? about.story : [];
  story.forEach((paragraph) => {
    if (!valid(paragraph)) return;
    const p = document.createElement("p");
    p.textContent = paragraph;
    storyHolder.appendChild(p);
  });

  $("#schoolLife").textContent = about.schoolLife || "";
  $("#yearlyGrowth").textContent = about.growth || "";
}

function renderHero(profileItems) {
  profilePhotos = profileItems
    .filter((photo) => valid(photo.img || photo.url))
    .map((photo, index) => ({
      img: photo.img || photo.url,
      description: photo.description || "",
      index
    }));

  waitingBook.innerHTML = "";
  if (waitingCount) waitingCount.textContent = `${profilePhotos.length} photo${profilePhotos.length === 1 ? "" : "s"}`;

  // Recommended: 4 to 12 profile images.
  // Excessive profile images may still fit in one row, but the waiting-book thumbnails may become too narrow.
  if (profilePhotos.length > 12) {
    console.warn("This hero waiting-book layout works best with 4 to 12 profile images. Too many images may look too narrow.");
  }

  profilePhotos.forEach((photo, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "waiting-card";
    button.dataset.index = String(index);
    button.setAttribute("aria-label", `Use profile photo ${index + 1}`);

    button.innerHTML = `
      <span class="waiting-card-inner">
        <img src="${escapeHtml(photo.img)}" alt="${escapeHtml(photo.description || `Profile photo ${index + 1}`)}" loading="${index < 4 ? "eager" : "lazy"}">
        ${valid(photo.description) ? `<span class="waiting-caption">${escapeHtml(photo.description)}</span>` : ""}
      </span>
    `;

    button.addEventListener("click", () => {
      setMainPhoto(index, { manual: true });
    });

    button.addEventListener("dblclick", () => {
      openModal(photo.img, photo.description);
    });

    waitingBook.appendChild(button);
  });

  if (profilePhotos.length) {
    setMainPhoto(randomPhotoIndex(), { initial: true });
  }
}

function setMainPhoto(index, options = {}) {
  if (!profilePhotos.length || !profilePhotos[index]) return;

  clearTimeout(heroTimer);

  const photo = profilePhotos[index];
  const previousSrc = mainPhotoImg.getAttribute("src") || "";
  const selectedThumb = $(`.waiting-card[data-index="${index}"] img`);
  activePhotoIndex = index;

  $$(".waiting-card").forEach((card) => {
    card.classList.toggle("is-active", Number(card.dataset.index) === index);
  });

  const temp = new Image();

  temp.onload = () => {
    const runChange = () => {
      mainPhoto.classList.remove("is-ready", "is-receiving");
      mainPhoto.classList.add("is-changing");

      if (!options.initial && previousSrc) {
        createBurnLayer(previousSrc);
      }

      if (!options.initial && selectedThumb) {
        animateThumbToMain(selectedThumb, () => {
          placeMainPhoto(photo, index);
        });
      } else {
        placeMainPhoto(photo, index);
      }
    };

    requestAnimationFrame(runChange);
  };

  temp.onerror = () => {
    scheduleNextMainPhoto();
  };

  temp.src = photo.img;
}


function placeMainPhoto(photo, index) {
  mainPhotoImg.src = photo.img;
  mainPhotoImg.alt = photo.description || `Profile photo ${index + 1}`;

  if (valid(photo.description)) {
    mainPhotoCaption.textContent = photo.description;
    mainPhotoCaption.classList.add("has-text");
  } else {
    mainPhotoCaption.textContent = "";
    mainPhotoCaption.classList.remove("has-text");
  }

  mainPhoto.classList.remove("is-changing");

  requestAnimationFrame(() => {
    mainPhoto.classList.add("is-ready", "is-receiving");

    window.setTimeout(() => {
      mainPhoto.classList.remove("is-receiving");

      // Start the next 10-second cycle only after the image is loaded,
      // in place, glowing, and the receiving animation has settled.
      scheduleNextMainPhoto();
    }, 780);
  });
}

function animateThumbToMain(sourceImg, onArrive) {
  const sourceRect = sourceImg.getBoundingClientRect();
  const targetRect = mainPhoto.getBoundingClientRect();

  const clone = sourceImg.cloneNode(true);
  clone.className = "fly-clone";
  clone.style.left = `${sourceRect.left}px`;
  clone.style.top = `${sourceRect.top}px`;
  clone.style.width = `${sourceRect.width}px`;
  clone.style.height = `${sourceRect.height}px`;
  clone.style.opacity = "0.96";

  document.body.appendChild(clone);

  const dx = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
  const dy = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);
  const scaleX = targetRect.width / Math.max(sourceRect.width, 1);
  const scaleY = targetRect.height / Math.max(sourceRect.height, 1);

  const animation = clone.animate(
    [
      {
        transform: "translate3d(0, 0, 0) scale(1) rotate(-2deg)",
        opacity: 0.92,
        filter: "blur(0px) saturate(1)"
      },
      {
        transform: `translate3d(${dx * 0.48}px, ${dy * 0.26 - 46}px, 0) scale(${Math.min(scaleX, scaleY) * 0.52}) rotate(8deg)`,
        opacity: 1,
        filter: "blur(0px) saturate(1.25)"
      },
      {
        transform: `translate3d(${dx}px, ${dy}px, 0) scale(${Math.max(scaleX, scaleY)}) rotate(0deg)`,
        opacity: 0,
        filter: "blur(2px) saturate(1.1)"
      }
    ],
    {
      duration: 860,
      easing: "cubic-bezier(.18,.9,.22,1.04)",
      fill: "forwards"
    }
  );

  animation.onfinish = () => {
    clone.remove();
    onArrive();
  };

  animation.oncancel = () => {
    clone.remove();
    onArrive();
  };
}

function createBurnLayer(src) {
  const layer = document.createElement("div");
  layer.className = "burn-layer";
  layer.innerHTML = `<img src="${escapeHtml(src)}" alt="">`;
  if (!mainPhotoEffects) {
    layer.remove();
    return;
  }

  mainPhotoEffects.appendChild(layer);

  window.setTimeout(() => {
    layer.remove();
  }, 820);
}

function scheduleNextMainPhoto() {
  const seconds = Number(appData?.hero?.mainChangeSeconds || 10);
  clearTimeout(heroTimer);

  heroTimer = setTimeout(() => {
    setMainPhoto(randomPhotoIndex(activePhotoIndex));
  }, Math.max(3, seconds) * 1000);
}

function randomPhotoIndex(exceptIndex = -1) {
  if (profilePhotos.length <= 1) return 0;

  let next = exceptIndex;
  let guard = 0;

  while (next === exceptIndex && guard < 20) {
    next = Math.floor(Math.random() * profilePhotos.length);
    guard++;
  }

  return next;
}

mainPhoto.addEventListener("click", () => {
  const photo = profilePhotos[activePhotoIndex];
  if (!photo) return;
  openModal(photo.img, photo.description);
});

function renderSkills(skills) {
  const grid = $("#skillGrid");
  grid.innerHTML = "";

  skills.filter((skill) => skill && valid(skill.title)).forEach((skill, index) => {
    const card = document.createElement("article");
    card.className = "skill-card reveal";

    card.innerHTML = `
      <div class="icon-box skill-icon">
        ${index % 2 === 0 ? iconDance() : iconMusic()}
      </div>
      <h3>${escapeHtml(skill.title)}</h3>
      <p>${escapeHtml(skill.description || "I enjoy practicing this skill and improving it little by little.")}</p>
    `;

    grid.appendChild(card);
  });
}

function renderAchievements(achievements) {
  const grid = $("#achievementGrid");
  if (!grid) return;

  grid.innerHTML = "";

  achievements.filter((item) => item && (valid(item.title) || valid(item.img))).forEach((item) => {
    const title = item.title || "Achievement";
    const caption = [title, item.provider, item.year].filter(valid).join(" • ");
    const hasImage = valid(item.img);

    const card = document.createElement("article");
    card.className = "achievement-card reveal";
    card.innerHTML = `
      <button type="button" ${hasImage ? "" : "disabled"} aria-label="View ${escapeHtml(title)}">
        <div class="achievement-image">
          ${hasImage ? `<img src="${escapeHtml(item.img)}" alt="${escapeHtml(title)}" loading="lazy">` : `<span class="achievement-placeholder">Add achievement image</span>`}
        </div>
        <div class="achievement-body">
          <h3>${escapeHtml(title)}</h3>
          ${valid(item.provider) ? `<p>${escapeHtml(item.provider)}</p>` : ""}
          ${valid(item.description) ? `<p>${escapeHtml(item.description)}</p>` : ""}
          ${valid(item.year) ? `<div class="achievement-meta"><span>${escapeHtml(item.year)}</span></div>` : ""}
        </div>
      </button>
    `;

    if (hasImage) {
      $("button", card).addEventListener("click", () => openModal(item.img, caption));
    }

    grid.appendChild(card);
  });
}

function renderGallery() {
  const grid = $("#galleryGrid");
  grid.innerHTML = "";

  const profileGallery = (appData.gallery?.profile || [])
    .filter((photo) => valid(photo.img || photo.url))
    .map((photo) => ({ ...photo, group: "profile", label: "Profile" }));

  const momentGallery = (appData.gallery?.picture || [])
    .filter((photo) => valid(photo.img || photo.url))
    .map((photo) => ({ ...photo, group: "picture", label: "Moment" }));

  const photos = [...profileGallery, ...momentGallery]
    .filter((photo) => galleryFilter === "all" || photo.group === galleryFilter);

  photos.forEach((photo, index) => {
    const img = photo.img || photo.url;
    const desc = photo.description || "";

    const card = document.createElement("article");
    card.className = "gallery-card reveal";
    card.innerHTML = `
      <button type="button" aria-label="Open ${escapeHtml(photo.label)} photo ${index + 1}">
        <span class="gallery-thumb">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(desc || `${photo.label} photo ${index + 1}`)}" loading="lazy">
          <span class="gallery-label">${escapeHtml(photo.label)}</span>
          ${valid(desc) ? `<span class="gallery-caption">${escapeHtml(desc)}</span>` : ""}
        </span>
      </button>
    `;

    $("button", card).addEventListener("click", () => openModal(img, desc));
    grid.appendChild(card);
  });

  setupReveal();
}

function renderCreator(creator) {
  if (!creator) return;

  $("#creatorRole").textContent = creator.role || "Crafted and Designed by";
  $("#creatorName").textContent = creator.name || "Creator";

  const holder = $("#creatorIcons");
  holder.innerHTML = "";

  const links = creator.links || {};
  const items = [
    ["portfolio1", "Portfolio 1", links.portfolio1],
    ["portfolio2", "Portfolio 2", links.portfolio2],
    ["github", "GitHub", links.github],
    ["facebook", "Facebook", links.facebook],
    ["email", "Email", links.email],
    ["contactNumber", "Contact", links.contactNumber],
    ["x", "X", links.x],
    ["telegram", "Telegram", links.telegram],
    ["whatsapp", "WhatsApp", links.whatsapp],
    ["instagram", "Instagram", links.instagram],
    ["linkedin", "LinkedIn", links.linkedin]
  ];

  items.forEach(([type, label, value]) => {
    if (!valid(value)) return;

    const a = document.createElement("a");
    a.className = "creator-icon";
    a.href = normalizeLink(value, type);
    a.target = type === "email" || type === "contactNumber" ? "_self" : "_blank";
    a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", label);
    a.innerHTML = iconSvg(type);
    holder.appendChild(a);
  });
}


function setupMainPhotoTilt() {
  mainPhoto.addEventListener("pointermove", (event) => {
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const rect = mainPhoto.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    mainPhoto.style.setProperty("--main-tilt-x", `${y * -8}deg`);
    mainPhoto.style.setProperty("--main-tilt-y", `${x * 10}deg`);
  });

  mainPhoto.addEventListener("pointerleave", () => {
    mainPhoto.style.setProperty("--main-tilt-x", "0deg");
    mainPhoto.style.setProperty("--main-tilt-y", "0deg");
  });
}

function setupGalleryTabs() {
  $$(".gallery-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      galleryFilter = tab.dataset.filter || "all";
      $$(".gallery-tab").forEach((item) => item.classList.toggle("active", item === tab));
      renderGallery();
    });
  });
}

function setupScrollSpy() {
  function getVisibleSections() {
    return $$(".nav-section:not([hidden])");
  }

  function updateActiveNav() {
    const sections = getVisibleSections();
    const checkLine = window.innerHeight * 0.36;
    let activeId = "home";

    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= checkLine && rect.bottom > checkLine) {
        activeId = section.id;
      }
    });

    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 12) {
      const lastSection = sections.at(-1);
      if (lastSection) activeId = lastSection.id;
    }

    navItems.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${activeId}`);
    });

    const profile = appData?.profile || {};
    const heroVisible = activeId === "home";
    setBrandName(heroVisible ? (profile.nickname || profile.name || "") : (profile.name || profile.nickname || ""));
  }

  updateActiveNav();
  window.addEventListener("scroll", updateActiveNav, { passive: true });
  window.addEventListener("resize", updateActiveNav);

  navItems.forEach((link) => {
    link.addEventListener("click", () => {
      navItems.forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
    });
  });
}

function setupTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  html.dataset.theme = savedTheme;
  themeIcon.textContent = savedTheme === "dark" ? "☾" : "☀";

  themeBtn.addEventListener("click", () => {
    const next = html.dataset.theme === "dark" ? "light" : "dark";
    html.dataset.theme = next;
    localStorage.setItem("theme", next);
    themeIcon.textContent = next === "dark" ? "☾" : "☀";
  });
}

function setupMenu() {
  menuBtn.addEventListener("click", () => {
    const opened = body.classList.toggle("menu-open");
    menuBtn.setAttribute("aria-expanded", String(opened));
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      body.classList.remove("menu-open");
      menuBtn.setAttribute("aria-expanded", "false");
    }
  });
}

function setupReveal() {
  if (!("IntersectionObserver" in window)) {
    $$(".reveal").forEach((item) => item.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  $$(".reveal:not(.visible)").forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 24, 180)}ms`;
    observer.observe(item);
  });
}

function setupCursor() {
  if (!window.matchMedia("(pointer: fine)").matches) return;

  let haloX = 0;
  let haloY = 0;
  let targetX = 0;
  let targetY = 0;

  window.addEventListener("pointermove", (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
    cursorCore.style.left = `${targetX}px`;
    cursorCore.style.top = `${targetY}px`;
  });

  function tick() {
    haloX += (targetX - haloX) * 0.16;
    haloY += (targetY - haloY) * 0.16;
    cursorHalo.style.left = `${haloX}px`;
    cursorHalo.style.top = `${haloY}px`;
    requestAnimationFrame(tick);
  }

  tick();

  document.addEventListener("mouseover", (event) => {
    if (event.target.closest("a, button, .name-letter")) body.classList.add("cursor-hover");
  });

  document.addEventListener("mouseout", (event) => {
    if (event.target.closest("a, button, .name-letter")) body.classList.remove("cursor-hover");
  });
}

function setupModal() {
  modalClose.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
}

function openModal(src, caption) {
  if (!valid(src)) return;

  modalImage.classList.remove("portrait", "landscape");
  modalImage.src = src;
  modalImage.alt = caption || "Selected image";

  if (valid(caption)) {
    modalCaption.textContent = caption;
    modalCaption.classList.add("has-text");
  } else {
    modalCaption.textContent = "";
    modalCaption.classList.remove("has-text");
  }

  modalImage.onload = () => {
    const portrait = modalImage.naturalWidth < modalImage.naturalHeight;
    modalImage.classList.toggle("portrait", portrait);
    modalImage.classList.toggle("landscape", !portrait);
  };

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  body.classList.add("modal-open");
}

function closeModal() {
  if (!modal.classList.contains("open")) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  body.classList.remove("modal-open");
  modalImage.src = "";
  modalCaption.textContent = "";
  modalCaption.classList.remove("has-text");
}

function pickText(value) {
  if (Array.isArray(value)) {
    const clean = value.filter(valid);
    return clean[Math.floor(Math.random() * clean.length)] || "";
  }

  return value || "";
}

function valid(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalizeLink(value, type = "") {
  const raw = String(value).trim();

  if (type === "email") return raw.startsWith("mailto:") ? raw : `mailto:${raw}`;
  if (type === "contactNumber") return raw.startsWith("tel:") ? raw : `tel:${raw.replace(/\s+/g, "")}`;
  if (type === "whatsapp" && /^\+?\d[\d\s-]+$/.test(raw)) return `https://wa.me/${raw.replace(/\D/g, "")}`;
  if (type === "telegram" && !raw.startsWith("http")) return `https://t.me/${raw.replace("@", "")}`;
  if (raw.startsWith("http") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return raw;

  return `https://${raw}`;
}

function iconDance() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.8 4.6a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 0 1 4.8 0ZM8.2 9.1c.45-.9 1.36-1.46 2.36-1.46h1.1c.86 0 1.66.42 2.16 1.12l1.5 2.1 2.22.68-.58 1.9-2.86-.88-1.32-1.84-.92 3.18 2.58 2.42V22h-2v-4.82l-2.06-1.94-.98 2.52-3.14 2.44-1.22-1.58 2.7-2.1 1.16-3.02-1.54-.82-1.28 2.06-1.7-1.06 1.56-2.48c.42-.66 1.26-.9 1.96-.54l.82.42-.5-1.98Z"/></svg>`;
}

function iconMusic() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18 3v12.3A3.4 3.4 0 1 1 16 12.2V7.1l-8 1.7v8.5A3.4 3.4 0 1 1 6 14.2V6.5L18 3Z"/></svg>`;
}

function iconSvg(type) {
  const icons = {
    portfolio1: `<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h5v7H4V5Zm0 9h7v7H6a2 2 0 0 1-2-2v-5Zm9 7v-7h7v5a2 2 0 0 1-2 2h-5Zm7-11h-7V3h5a2 2 0 0 1 2 2v5Z"/></svg>`,
    portfolio2: `<svg viewBox="0 0 24 24"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3L18.6 8 12 11.7 5.4 8 12 4.3ZM5 9.7l6 3.4v6.2l-6-3.4V9.7Zm8 9.6v-6.2l6-3.4v6.2l-6 3.4Z"/></svg>`,
    github: `<svg viewBox="0 0 24 24"><path d="M12 .9a11.1 11.1 0 0 0-3.5 21.6c.56.1.76-.24.76-.54v-2.1c-3.12.68-3.78-1.32-3.78-1.32-.5-1.28-1.24-1.62-1.24-1.62-1.02-.7.08-.68.08-.68 1.12.08 1.72 1.16 1.72 1.16 1 1.7 2.62 1.2 3.26.92.1-.72.4-1.2.72-1.48-2.5-.28-5.12-1.24-5.12-5.54 0-1.22.44-2.22 1.16-3-.12-.28-.5-1.42.1-2.96 0 0 .94-.3 3.08 1.14.9-.24 1.86-.36 2.82-.36s1.92.12 2.82.36c2.14-1.44 3.08-1.14 3.08-1.14.6 1.54.22 2.68.1 2.96.72.78 1.16 1.78 1.16 3 0 4.3-2.62 5.26-5.12 5.54.4.34.76 1.04.76 2.1v3c0 .3.2.64.78.54A11.1 11.1 0 0 0 12 .9Z"/></svg>`,
    facebook: `<svg viewBox="0 0 24 24"><path d="M14.1 8.4V6.6c0-.88.22-1.32 1.42-1.32h1.72V2.1h-2.76c-3.34 0-4.52 1.58-4.52 4.26V8.4H7.9v3.24h2.06v10.26h4.14V11.64h2.78l.38-3.24H14.1Z"/></svg>`,
    email: `<svg viewBox="0 0 24 24"><path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm8 7.4L4.7 7H4v.7l8 5.9 8-5.9V7h-.7L12 12.4Z"/></svg>`,
    contactNumber: `<svg viewBox="0 0 24 24"><path d="M6.6 2.9 10 6.3 8 8.7c.74 1.5 1.7 2.84 2.88 4.02A14.3 14.3 0 0 0 15 15.7l2.3-2 3.8 3.34-1.58 3.74c-.24.56-.82.88-1.42.78C9.92 20.2 3.8 14.08 2.44 5.9c-.1-.6.22-1.18.78-1.42L6.6 2.9Z"/></svg>`,
    x: `<svg viewBox="0 0 24 24"><path d="M14.3 10.2 22.2 1h-1.9l-6.8 7.9L8 1H1.7l8.3 12.1L1.7 23h1.9l7.2-8.4 5.8 8.4h6.3l-8.6-12.8Zm-2.54 2.96-.84-1.2L4.2 2.4h2.9l5.4 7.7.84 1.2 7.06 10.08h-2.9l-5.74-8.22Z"/></svg>`,
    telegram: `<svg viewBox="0 0 24 24"><path d="M21.9 4.1 18.6 20c-.24 1.12-.9 1.4-1.82.86l-5-3.68-2.42 2.32c-.26.26-.5.5-1.02.5l.36-5.08 9.26-8.36c.4-.36-.08-.56-.62-.2L5.9 13.6.98 12.06c-1.08-.34-1.1-1.08.22-1.6L20.44 3.04c.9-.32 1.68.22 1.46 1.06Z"/></svg>`,
    whatsapp: `<svg viewBox="0 0 24 24"><path d="M20.5 3.5A11 11 0 0 0 3.2 16.8L2 22l5.32-1.16A11 11 0 0 0 20.5 3.5ZM12 20a8 8 0 0 1-4.08-1.12l-.3-.18-3.16.7.68-3.08-.2-.32A8.02 8.02 0 1 1 12 20Zm4.4-5.94c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06a6.54 6.54 0 0 1-1.92-1.18 7.22 7.22 0 0 1-1.34-1.66c-.14-.24-.02-.38.1-.5.1-.1.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.42-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.24 1.02.38 1.36.5.58.18 1.1.16 1.52.1.46-.06 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"/></svg>`,
    instagram: `<svg viewBox="0 0 24 24"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.5A4.5 4.5 0 1 1 12 16.5 4.5 4.5 0 0 1 12 7.5Zm0 2A2.5 2.5 0 1 0 12 14.5 2.5 2.5 0 0 0 12 9.5Zm5.25-3a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z"/></svg>`,
    linkedin: `<svg viewBox="0 0 24 24"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.8h4v11.7H3V9.8Zm6.4 0h3.84v1.6h.06c.54-1.02 1.84-2.1 3.78-2.1 4.04 0 4.78 2.66 4.78 6.12v6.08h-4v-5.4c0-1.28-.02-2.94-1.8-2.94-1.8 0-2.08 1.4-2.08 2.86v5.48h-4V9.8Z"/></svg>`
  };

  return icons[type] || icons.portfolio1;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
