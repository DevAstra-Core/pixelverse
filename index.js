import { requireAuth } from "./auth-guard.js";
import { API_BASE } from "./config.js";
requireAuth();

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";


// ---------- Seeded shuffle: stable for the life of the 3hr backend cache ----------
// Using Math.random() here would reshuffle on every single refresh even
// though the backend is now serving the exact same cached list for hours.
// Seeding off a time bucket keeps the order fixed within that window and
// only changes it once the cache actually refreshes.
const CACHE_WINDOW_HOURS = 3;

function getUserSeed() {
  let seed = localStorage.getItem("pixelverse_shuffle_seed");
  if (!seed) {
    seed = Math.floor(Math.random() * 1000000).toString();
    localStorage.setItem("pixelverse_shuffle_seed", seed);
  }
  return parseInt(seed, 10);
}

function getCacheWindowSeed() {
  return Math.floor(Date.now() / (CACHE_WINDOW_HOURS * 60 * 60 * 1000));
}

function shuffle(array, seed = getCacheWindowSeed() + getUserSeed()) {
  const arr = [...array];
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function noPosterIconHTML() {
  return `
    <div class="no-poster-icon">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 6.94975C2 6.06722 2 5.62595 2.06935 5.25839C2.37464 3.64031 3.64031 2.37464 5.25839 2.06935C5.62595 2 6.06722 2 6.94975 2C7.33642 2 7.52976 2 7.71557 2.01738C8.51665 2.09229 9.27652 2.40704 9.89594 2.92051C10.0396 3.03961 10.1763 3.17633 10.4497 3.44975L11 4C11.8158 4.81578 12.2237 5.22367 12.7121 5.49543C12.9804 5.64471 13.2651 5.7626 13.5604 5.84678C14.0979 6 14.6747 6 15.8284 6H16.2021C18.8345 6 20.1506 6 21.0062 6.76946C21.0849 6.84024 21.1598 6.91514 21.2305 6.99383C22 7.84935 22 9.16554 22 11.7979V14C22 17.7712 22 19.6569 20.8284 20.8284C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.8284C2 19.6569 2 17.7712 2 14V6.94975Z" stroke="currentColor" stroke-width="1.5"/>
        <path opacity="0.5" d="M10.5 15L13.5 12M13.5 15L10.5 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </div>
  `;
}

function renderSkeletons(wrapperEl, count = 6) {
  if (!wrapperEl) return;
  wrapperEl.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const skel = document.createElement("div");
    skel.className = "card-skeleton";
    wrapperEl.appendChild(skel);
  }
}







const logo = document.getElementById('logo');
const heroSection = document.getElementById('herosection');

const observerOptions = {
    root: null, // Relative to viewport
    threshold: .45, // Triggers as soon as hero starts going out of view
    // Triggers when hero hits bottom of navbar (adjust 70px to match navbar height)
};

const heroObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) {
            logo.classList.add('scrolled');
        } else {
            logo.classList.remove('scrolled');
        }
    });
}, observerOptions);

heroObserver.observe(heroSection);


// ---------- Continuous scroll-proportional squeeze (0 to 1) instead of a binary on/off toggle ----------
let squeezeTicking = false;

window.addEventListener('scroll', () => {
  if (!squeezeTicking) {
    window.requestAnimationFrame(() => {
      const maxScroll = heroSection.offsetHeight * 0.3; // distance over which the squeeze fully completes
      const progress = Math.min(window.scrollY / maxScroll, 1);
      heroSection.style.setProperty('--squeeze', progress);
      squeezeTicking = false;
    });
    squeezeTicking = true;
  }
});









// ---------- Generic movie carousel renderer ----------
function renderCarousel(wrapperEl, movies, cardClass, posterClass, detailsClass) {
  if (!wrapperEl) return;
  wrapperEl.innerHTML = "";

  movies.forEach((movie, index) => {
    const card = document.createElement("div");
    card.className = cardClass;
    card.style.cursor = "pointer";
    card.style.transitionDelay = `${index * 0.05}s`; // stagger, applied once revealed
    card.addEventListener("click", () => {
      window.location.href = `movie.html?id=${movie.id}`;
    });

    const posterDiv = document.createElement("div");
    posterDiv.className = posterClass;

    if (movie.poster_path) {
      const img = document.createElement("img");
      img.src = `${TMDB_IMAGE_BASE}${movie.poster_path}`;
      img.alt = movie.title || "";
      posterDiv.appendChild(img);
    } else {
      posterDiv.innerHTML = noPosterIconHTML();
    }

    const detailsDiv = document.createElement("div");
    detailsDiv.className = detailsClass;
    const titleP = document.createElement("p");
    titleP.textContent = movie.title || "Untitled";
    detailsDiv.appendChild(titleP);

    card.appendChild(posterDiv);
    card.appendChild(detailsDiv);
    wrapperEl.appendChild(card);
  });
}


function observeCarouselReveal(containerEl) {
  if (!containerEl) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const cards = containerEl.children;
        Array.from(cards).forEach((card) => card.classList.add("card-visible"));
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  observer.observe(containerEl);
}

// ---------- Generic fetch + shuffle + render pipeline for one carousel ----------
async function loadCarousel(url, wrapperSelector, cardClass, posterClass, detailsClass, count = 15) {
  const wrapperEl = document.querySelector(wrapperSelector);
  renderSkeletons(wrapperEl);

  try {
    const { supabase } = await import("./supabase-config.js");
    const { data: { session } } = await supabase.auth.getSession();
    const headers = session ? { "Authorization": `Bearer ${session.access_token}` } : {};

    const response = await fetch(url, { headers });
    const data = await response.json();
    const pool = data.results || [];
    const shuffled = shuffle(pool).slice(0, count);
    renderCarousel(wrapperEl, shuffled, cardClass, posterClass, detailsClass);
    observeCarouselReveal(wrapperEl);
  } catch (err) {
    console.error(`Failed to load carousel from ${url}:`, err);
    if (wrapperEl) wrapperEl.innerHTML = "<p style='opacity:0.6; padding:10px;'>Couldn't load right now.</p>";
  }
}

function isUpcoming(movie) {
  if (movie.status && movie.status !== "Released") {
    return true;
  }
  if (movie.release_date) {
    const releaseDate = new Date(movie.release_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return releaseDate > today;
  }
  return true;
}


// ---------- Hero section: fetch the trending pool once, then rotate
// through it every 15 seconds instead of staying fixed on one movie for
// the whole 3hr cache window. ----------
const HERO_ROTATE_INTERVAL_MS = 15000;
let heroRotateTimer = null;

async function renderHeroMovie(movie, session, instant = false) {
  const heroImg = document.getElementById("hero-img-poster");
  const heroTitle = document.getElementById("h-movie-title");
  const heroDesc = document.getElementById("h-movie-description");
  const watchBtn = document.getElementById("watch-now-btn");
  const wishlistBtn = document.getElementById("add-to-watchlist-btn");
  const heroDetailsContainer = document.querySelector(".hero-movie-details-container");

  // Check wishlist status for THIS specific movie before rendering
  let isInWishlist = false;
  if (session) {
    try {
      const res = await fetch(`${API_BASE}/api/library/wishlist`, {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      const wishlist = await res.json();
      isInWishlist = wishlist.some(item => item.tmdb_movie_id === movie.id);
    } catch (err) {
      console.error("Failed to check wishlist status:", err);
    }
  }

  const updateContent = () => {
    if (movie.backdrop_path) {
      heroImg.src = `https://image.tmdb.org/t/p/original${movie.backdrop_path}`;
    }
    heroTitle.textContent = movie.title || "Untitled";
    heroDesc.textContent = movie.overview
      ? movie.overview.slice(0, 160) + (movie.overview.length > 160 ? "..." : "")
      : "";

    // Reflect actual saved state instead of always resetting to "Add"
    wishlistBtn.textContent = isInWishlist ? "Added ✓" : "Add to Watchlist";

    const upcoming = isUpcoming(movie);
    watchBtn.style.display = upcoming ? "none" : "flex";

    if (heroDetailsContainer && !instant) {
      heroDetailsContainer.style.animation = "none";
      void heroDetailsContainer.offsetWidth;
      heroDetailsContainer.style.animation = "";
    }

    watchBtn.onclick = () => {
      window.location.href = `movie.html?id=${movie.id}`;
    };

    wishlistBtn.onclick = async () => {
      if (!session) return;

      if (isInWishlist) {
        // Already saved — clicking again removes it
        await fetch(`${API_BASE}/api/library/wishlist/${movie.id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        isInWishlist = false;
        wishlistBtn.textContent = "Add to Watchlist";
      } else {
        await fetch(`${API_BASE}/api/library/wishlist`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ tmdb_movie_id: movie.id }),
        });
        isInWishlist = true;
        wishlistBtn.textContent = "Added ✓";
      }
    };
  };

  if (instant) {
    updateContent();
    return;
  }

  heroImg.classList.add("fade-out");

  setTimeout(() => {
    updateContent();
    heroImg.classList.remove("fade-out");
  }, 400);
}

async function loadHero() {
  try {
    const { supabase } = await import("./supabase-config.js");
    const { data: { session } } = await supabase.auth.getSession();
    const headers = session ? { "Authorization": `Bearer ${session.access_token}` } : {};

    const response = await fetch(`${API_BASE}/api/movies/trending?time_window=day`, { headers });
    const data = await response.json();
    const pool = data.results || [];
    if (pool.length === 0) return;

    let index = Math.floor(Math.random() * pool.length);
    renderHeroMovie(pool[index], session);

    if (heroRotateTimer) clearInterval(heroRotateTimer);
    heroRotateTimer = setInterval(() => {
      let next;
      do {
        next = Math.floor(Math.random() * pool.length);
      } while (next === index && pool.length > 1); // avoid repeating the same movie back-to-back
      index = next;
      renderHeroMovie(pool[index], session);
    }, HERO_ROTATE_INTERVAL_MS);

  } catch (err) {
    console.error("Failed to load hero section:", err);
  }
}

// ---------- Directors row (curated list, photo + click -> browse page) ----------
const FEATURED_DIRECTORS = [
  "Christopher Nolan",
  "Quentin Tarantino",
  "Steven Spielberg",
  "Martin Scorsese",
  "James Cameron",
  "Denis Villeneuve",
  "Greta Gerwig",
  "Bong Joon-ho",
];

async function loadDirectors() {
  const wrapperEl = document.querySelector(".directors-card-container");
  if (!wrapperEl) return;
  wrapperEl.innerHTML = "";

  // Fire all 8 director-profile requests in parallel instead of one at a
  // time (the old for-loop awaited each fetch before starting the next,
  // making this section as slow as 8 sequential round trips).
  const people = await Promise.all(
    FEATURED_DIRECTORS.map(async (name) => {
      try {
        const response = await fetch(`${API_BASE}/api/movies/people/director-profile?name=${encodeURIComponent(name)}`);
        return await response.json();
      } catch (err) {
        console.error(`Failed to load director profile for ${name}:`, err);
        return null;
      }
    })
  );

  FEATURED_DIRECTORS.forEach((name, i) => {
    const person = people[i];
    if (!person) return;

    const card = document.createElement("div");
    card.className = "directors-cards-template";
    card.style.cursor = "pointer";
    card.style.transitionDelay = `${i * 0.05}s`;
    card.addEventListener("click", () => {
      window.location.href = `director-page.html?type=director&name=${encodeURIComponent(name)}`;
    });

    const imgDiv = document.createElement("div");
    imgDiv.className = "directors-image-icon";
    const img = document.createElement("img");
    img.src = person.profile_path ? `${TMDB_IMAGE_BASE}${person.profile_path}` : "";
    img.alt = name;
    imgDiv.appendChild(img);

    const titleDiv = document.createElement("div");
    titleDiv.className = "director-title";
    const p = document.createElement("p");
    p.textContent = name;
    titleDiv.appendChild(p);

    card.appendChild(imgDiv);
    card.appendChild(titleDiv);
    wrapperEl.appendChild(card);
  });

  observeCarouselReveal(wrapperEl);
}

// ---------- "See all" arrow buttons -> browse page ----------
function wireSeeAllButtons() {
  document.querySelectorAll(".see-all-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      const label = encodeURIComponent(btn.dataset.label || "");

      let url = "";
      if (type === "genre") {
        url = `director-page.html?type=genre&id=${btn.dataset.id}&label=${label}`;
      } else if (type === "company") {
        url = `director-page.html?type=company&id=${btn.dataset.id}&label=${label}`;
      } else if (type === "year") {
        url = `director-page.html?type=year&year=${btn.dataset.year}&label=${label}`;
      } else if (type === "trending") {
        url = `director-page.html?type=trending&window=${btn.dataset.window}&label=${label}`;
      } else if (type === "now-playing") {
        url = `director-page.html?type=now-playing&label=${label}`;
      } else if (type === "hindi-popular") {
        url = `director-page.html?type=hindi-popular&label=${label}`;
      } else if (type === "south-indian") {
        url = `director-page.html?type=south-indian&label=${label}`;
      } else if (type === "hindi-thriller") {
        url = `director-page.html?type=hindi-thriller&label=${label}`;
      }

      if (url) window.location.href = url;
    });
  });
}

// ---------- Init all sections ----------
loadHero();
loadDirectors();
wireSeeAllButtons();

loadCarousel(
  `${API_BASE}/api/movies/now-playing`,
  ".trending-movie-cards-wrapper",
  "trending-moviecard-template",
  "trending-movie-card-poster",
  "trending-movie-card-details",
  15
);

loadCarousel(
  `${API_BASE}/api/movies/hindi-thriller`,
  ".hindi-thriller-movie-cards-wrapper",
  "hindi-thriller-moviecard-template",
  "hindi-thriller-movie-card-poster",
  "hindi-thriller-movie-card-details",
  15
);

loadCarousel(
  `${API_BASE}/api/movies/year/2026`,
  ".best-of-2026-movie-cards-wrapper",
  "best-of-2026-moviecard-template",
  "best-of-2026-movie-card-poster",
  "best-of-2026-movie-card-details",
  15
);

loadCarousel(
  `${API_BASE}/api/movies/genre/27`,
  ".horror-movie-cards-wrapper",
  "horror-moviecard-template",
  "horror-movie-card-poster",
  "horror-movie-card-details",
  15
);

loadCarousel(
  `${API_BASE}/api/movies/marvel`,
  ".marvel-movie-cards-wrapper",
  "marvel-moviecard-template",
  "marvel-movie-card-poster",
  "marvel-movie-card-details",
  15
);

loadCarousel(
  `${API_BASE}/api/movies/genre/28`,
  ".action-movie-cards-wrapper",
  "action-moviecard-template",
  "action-movie-card-poster",
  "action-movie-card-details",
  15
);

loadCarousel(
  `${API_BASE}/api/movies/hindi-popular`,
  ".hindi-popular-movie-cards-wrapper",
  "hindi-popular-moviecard-template",
  "hindi-popular-movie-card-poster",
  "hindi-popular-movie-card-details",
  15
);

loadCarousel(
  `${API_BASE}/api/movies/south-indian`,
  ".south-movies-movie-cards-wrapper",
  "south-movies-moviecard-template",
  "south-movies-movie-card-poster",
  "south-movies-movie-card-details",
  15
);


async function loadTopPicks() {
  const wrapperEl = document.querySelector(".top-picks-movie-cards-wrapper");
  renderSkeletons(wrapperEl);

  try {
    const { supabase } = await import("./supabase-config.js");
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      wrapperEl.innerHTML = "<p style='opacity:0.6; padding:10px;'>Log in to see picks for you.</p>";
      return;
    }

    const response = await fetch(`${API_BASE}/api/recommendations/for-you`, {
      headers: { "Authorization": `Bearer ${session.access_token}` },
    });
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      const headingEl = document.querySelector("#Top-picks-sec .category-titles");
      if (headingEl) headingEl.textContent = "Trending Now";

      const trendingRes = await fetch(`${API_BASE}/api/movies/trending?time_window=day`, {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      const trendingData = await trendingRes.json();
      const shuffled = shuffle(trendingData.results || []).slice(0, 15);
      renderCarousel(wrapperEl, shuffled, "top-picks-moviecard-template", "top-picks-movie-card-poster", "top-picks-movie-card-details");
      observeCarouselReveal(wrapperEl);
      return;
    }

    renderCarousel(wrapperEl, data.results.slice(0, 15), "top-picks-moviecard-template", "top-picks-movie-card-poster", "top-picks-movie-card-details");
    observeCarouselReveal(wrapperEl);
  } catch (err) {
    console.error("Failed to load top picks:", err);
    wrapperEl.innerHTML = "<p style='opacity:0.6; padding:10px;'>Couldn't load right now.</p>";
  }
}

loadTopPicks();