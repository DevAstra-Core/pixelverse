import { supabase } from "./supabase-config.js";
import { requireAuth } from "./auth-guard.js";
import { API_BASE } from "./config.js";
requireAuth();

//back to previous page
document.getElementById("back-to-home").addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "index.html";
  }
});




const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";


const params = new URLSearchParams(window.location.search);
const type = params.get("type");

const headingEl = document.getElementById("page-heading");
const containerEl = document.getElementById("director-movies-container");

const MAX_CARDS = 80;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { "Authorization": `Bearer ${session.access_token}` } : {};
}

function renderMovieCards(movies) {
  containerEl.innerHTML = "";

  if (!movies || movies.length === 0) {
    containerEl.innerHTML = "<p style='opacity:0.6;'>No movies found.</p>";
    return;
  }

  const limited = movies.slice(0, MAX_CARDS);

  limited.forEach((movie) => {
    const card = document.createElement("div");
    card.className = "director-movie-card";
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      window.location.href = `movie.html?id=${movie.id}`;
    });

    const posterHolder = document.createElement("div");
    posterHolder.className = "director-movie-poster-holder";

    if (movie.poster_path) {
      const img = document.createElement("img");
      img.src = `${TMDB_IMAGE_BASE}${movie.poster_path}`;
      img.alt = movie.title || "";
      posterHolder.appendChild(img);
    } else {
      posterHolder.classList.add("no-poster");
      posterHolder.innerHTML = `
        <div class="no-poster-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 6.94975C2 6.06722 2 5.62595 2.06935 5.25839C2.37464 3.64031 3.64031 2.37464 5.25839 2.06935C5.62595 2 6.06722 2 6.94975 2C7.33642 2 7.52976 2 7.71557 2.01738C8.51665 2.09229 9.27652 2.40704 9.89594 2.92051C10.0396 3.03961 10.1763 3.17633 10.4497 3.44975L11 4C11.8158 4.81578 12.2237 5.22367 12.7121 5.49543C12.9804 5.64471 13.2651 5.7626 13.5604 5.84678C14.0979 6 14.6747 6 15.8284 6H16.2021C18.8345 6 20.1506 6 21.0062 6.76946C21.0849 6.84024 21.1598 6.91514 21.2305 6.99383C22 7.84935 22 9.16554 22 11.7979V14C22 17.7712 22 19.6569 20.8284 20.8284C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.8284C2 19.6569 2 17.7712 2 14V6.94975Z" stroke="currentColor" stroke-width="1.5"/>
            <path opacity="0.5" d="M10.5 15L13.5 12M13.5 15L10.5 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
      `;
    }

    const details = document.createElement("div");
    details.className = "director-movie-details";
    const titleP = document.createElement("p");
    titleP.className = "director-movie-title";
    titleP.textContent = movie.title || "Untitled";
    details.appendChild(titleP);

    card.appendChild(posterHolder);
    card.appendChild(details);
    containerEl.appendChild(card);
  });
}

async function loadDirectorMovies() {
  const name = params.get("name");
  headingEl.textContent = name || "Director";

  try {
    const headers = await authHeaders();
    const response = await fetch(`${API_BASE}/api/movies/director/${encodeURIComponent(name)}`, { headers });
    const data = await response.json();
    renderMovieCards(data.movies || []);
  } catch (err) {
    console.error("Failed to load director movies:", err);
    containerEl.innerHTML = "<p style='opacity:0.6;'>Couldn't load movies right now.</p>";
  }
}

async function loadGenreMovies() {
  const genreId = params.get("id");
  const label = params.get("label") || "Genre";
  headingEl.textContent = label;

  try {
    const headers = await authHeaders();
    const response = await fetch(`${API_BASE}/api/movies/genre/${genreId}`, { headers });
    const data = await response.json();
    renderMovieCards(data.results || []);
  } catch (err) {
    console.error("Failed to load genre movies:", err);
    containerEl.innerHTML = "<p style='opacity:0.6;'>Couldn't load movies right now.</p>";
  }
}

async function loadKeywordMovies() {
  const keyword = params.get("q");
  headingEl.textContent = `"${keyword}"`;

  try {
    const headers = await authHeaders();
    const response = await fetch(`${API_BASE}/api/movies/keyword/${encodeURIComponent(keyword)}`, { headers });
    const data = await response.json();
    renderMovieCards(data.results || []);
  } catch (err) {
    console.error("Failed to load keyword movies:", err);
    containerEl.innerHTML = "<p style='opacity:0.6;'>Couldn't load movies right now.</p>";
  }
}

async function loadYearMovies() {
  const year = params.get("year");
  const label = params.get("label") || `${year} Movies`;
  headingEl.textContent = label;

  try {
    const headers = await authHeaders();
    const response = await fetch(`${API_BASE}/api/movies/year/${year}`, { headers });
    const data = await response.json();
    renderMovieCards(data.results || []);
  } catch (err) {
    console.error("Failed to load year movies:", err);
    containerEl.innerHTML = "<p style='opacity:0.6;'>Couldn't load movies right now.</p>";
  }
}

async function loadCompanyMovies() {
  const companyId = params.get("id");
  const label = params.get("label") || "Studio";
  headingEl.textContent = label;

  try {
    const headers = await authHeaders();
    const response = await fetch(`${API_BASE}/api/movies/company/${companyId}`, { headers });
    const data = await response.json();
    renderMovieCards(data.results || []);
  } catch (err) {
    console.error("Failed to load company movies:", err);
    containerEl.innerHTML = "<p style='opacity:0.6;'>Couldn't load movies right now.</p>";
  }
}

async function loadTrendingMovies() {
  const window_ = params.get("window") || "week";
  const label = params.get("label") || "Trending";
  headingEl.textContent = label;

  try {
    const headers = await authHeaders();
    const response = await fetch(`${API_BASE}/api/movies/trending?time_window=${window_}`, { headers });
    const data = await response.json();
    renderMovieCards(data.results || []);
  } catch (err) {
    console.error("Failed to load trending movies:", err);
    containerEl.innerHTML = "<p style='opacity:0.6;'>Couldn't load movies right now.</p>";
  }
}

async function loadNowPlayingMovies() {
  const label = params.get("label") || "Recent Releases";
  headingEl.textContent = label;

  try {
    const headers = await authHeaders();
    const response = await fetch(`${API_BASE}/api/movies/now-playing`, { headers });
    const data = await response.json();
    renderMovieCards(data.results || []);
  } catch (err) {
    console.error("Failed to load now-playing movies:", err);
    containerEl.innerHTML = "<p style='opacity:0.6;'>Couldn't load movies right now.</p>";
  }
}

// ---------- Route to the right loader based on ?type= ----------
if (type === "director") {
  loadDirectorMovies();
} else if (type === "genre") {
  loadGenreMovies();
} else if (type === "keyword") {
  loadKeywordMovies();
} else if (type === "year") {
  loadYearMovies();
} else if (type === "company") {
  loadCompanyMovies();
} else if (type === "trending") {
  loadTrendingMovies();
} else if (type === "now-playing") {
  loadNowPlayingMovies();
} else {
  headingEl.textContent = "Browse";
  containerEl.innerHTML = "<p style='opacity:0.6;'>No filter specified.</p>";
}