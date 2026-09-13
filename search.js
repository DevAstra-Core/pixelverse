import { requireAuth } from "./auth-guard.js";
import { API_BASE } from "./config.js";
requireAuth();

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";


const searchInput = document.getElementById("search-input");
const recommendationSection = document.getElementById("recommedation-movies-container");
const resultSection = document.getElementById("searched-result-movies-container");
const recommendationWrapper = document.querySelector(".recommendation-wrapper");
const resultWrapper = document.querySelector(".result-wrapper");

let debounceTimer = null;

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

// ---------- Shared card renderer ----------
function renderCards(wrapperEl, movies, cardClass, posterClass, titleClass, emptyMessage) {
  wrapperEl.innerHTML = "";

  if (!movies || movies.length === 0) {
    wrapperEl.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
    return;
  }

  movies.forEach((movie) => {
    const card = document.createElement("div");
    card.className = cardClass;

    const posterHolder = document.createElement("div");
    posterHolder.className = posterClass;
    posterHolder.style.cursor = "pointer";
    posterHolder.addEventListener("click", () => {
      window.location.href = `movie.html?id=${movie.id}`;
    });

    if (movie.poster_path) {
      const img = document.createElement("img");
      img.src = `${TMDB_IMAGE_BASE}${movie.poster_path}`;
      img.alt = movie.title || "";
      posterHolder.appendChild(img);
    } else {
      posterHolder.innerHTML = noPosterIconHTML();
    }

    const details = document.createElement("div");
    details.className = cardClass.replace("-card", "-details");

    const titleP = document.createElement("p");
    titleP.className = titleClass;
    titleP.textContent = movie.title || "Untitled";
    titleP.addEventListener("click", () => {
      window.location.href = `movie.html?id=${movie.id}`;
    });

    details.appendChild(titleP);
    card.appendChild(posterHolder);
    card.appendChild(details);
    wrapperEl.appendChild(card);
  });
}

// ---------- Recommendations (placeholder: trending, until Phase 5 exists) ----------
async function loadRecommendations() {
  renderCards(recommendationWrapper, [], "recommendation-movie-card", "recommendation-movie-poster-holder", "recommendation-movie-title", "Loading...");

  try {
    const { supabase } = await import("./supabase-config.js");
    const { data: { session } } = await supabase.auth.getSession();

    let movies = [];

    if (session) {
      const response = await fetch(`${API_BASE}/api/recommendations/for-you`, {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      movies = data.results || [];
    }

    if (movies.length === 0) {
      // Cold start or logged out — fall back to trending, and say so honestly
      const headingEl = document.querySelector("#recommedation-movies-container p");
      if (headingEl) headingEl.textContent = "Trending Now";

      const trendingRes = await fetch(`${API_BASE}/api/movies/trending?time_window=day`);
      const trendingData = await trendingRes.json();
      movies = (trendingData.results || []).slice(0, 12);
    }

    renderCards(
      recommendationWrapper,
      movies,
      "recommendation-movie-card",
      "recommendation-movie-poster-holder",
      "recommendation-movie-title",
      "No recommendations yet."
    );
  } catch (err) {
    console.error("Failed to load recommendations:", err);
    recommendationWrapper.innerHTML = "<p class='empty-state'>Couldn't load recommendations.</p>";
  }
}

// ---------- Search ----------
let activeController = null; // tracks the current in-flight request

async function performSearch(query) {
  if (activeController) {
    activeController.abort();
  }
  activeController = new AbortController();
  const thisController = activeController;

  resultWrapper.innerHTML = "<p class='empty-state'>Searching...</p>";

  try {
    const { supabase } = await import("./supabase-config.js");
    const { data: { session } } = await supabase.auth.getSession();

    const headers = {};
    if (session) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    const response = await fetch(
      `${API_BASE}/api/movies/search?q=${encodeURIComponent(query)}`,
      { signal: thisController.signal, headers }
    );
    const data = await response.json();

    if (thisController === activeController) {
      renderCards(
        resultWrapper,
        data.results || [],
        "result-movie-card",
        "result-movie-poster-holder",
        "result-movie-title",
        "No movies found."
      );
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("Search failed:", err);
    if (thisController === activeController) {
      resultWrapper.innerHTML = "<p class='empty-state'>Something went wrong.</p>";
    }
  }
}

// ---------- Toggle between recommendations view and results view ----------
function showRecommendations() {
  recommendationSection.classList.add("active");
  resultSection.classList.remove("active");
}

function showResults() {
  resultSection.classList.add("active");
  recommendationSection.classList.remove("active");
}

// ---------- Input handling (debounced, so it doesn't fire a request per keystroke) ----------
searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim();

  clearTimeout(debounceTimer);

  if (!query) {
    showRecommendations();
    return;
  }

  showResults();
  debounceTimer = setTimeout(() => {
    performSearch(query);
  }, 400);
});

// ---------- Init ----------
loadRecommendations();




//back to previous page
document.getElementById("back-to-home").addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "index.html";
  }
});
