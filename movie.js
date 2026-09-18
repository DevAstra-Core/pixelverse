import { supabase } from "./supabase-config.js";
import { API_BASE } from "./config.js";
import { requireAuth } from "./auth-guard.js";

requireAuth();

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";


const params = new URLSearchParams(window.location.search);
const tmdbMovieId = params.get("id");

const posterEl = document.getElementById("movie-poster");
const titleEl = document.getElementById("movie-title");
const keywordBox = document.getElementById("keyword-box");
const releaseDateEl = document.getElementById("release-date");
const detailsEl = document.getElementById("movie-details");
const directorNameEl = document.getElementById("director-name");
const wishlistBtn = document.getElementById("wishlist-box");
const likeBtn = document.getElementById("like-box");
const playBtn = document.getElementById("play-movie");

const posterBox = document.getElementById("movie-poster-box");
const loadingBox = document.getElementById("movie-loading-box");
const loadingState = document.getElementById("trailer-loading-state");
const errorState = document.getElementById("trailer-error-state");

const similarWrapper = document.querySelector(".similar-movies-wrapper");
const suggestionWrapper = document.querySelector(".suggestion-movies-wrapper");

let currentUserToken = null;

let inWishlist = false;
let isLiked = false;

// ---------- Get current session token (needed for library calls AND to respect adult-content pref) ----------
async function getToken() {
  if (currentUserToken) return currentUserToken;
  const { data: { session } } = await supabase.auth.getSession();
  currentUserToken = session?.access_token;
  return currentUserToken;
}

async function authHeaders() {
  const token = await getToken();
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

// ---------- Fetch with a timeout, so a stuck request fails visibly instead of hanging forever ----------
async function fetchWithTimeout(url, ms = 12000, extraHeaders = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: extraHeaders });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
function isUpcoming(movie) {

  if (movie.status && movie.status !== "Released") {
    return true;
  }

  // Fallback for cases where status is missing: use the date if we have one
  if (movie.release_date) {
    const releaseDate = new Date(movie.release_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return releaseDate > today;
  }
  return true;
}


// ---------- Load raw TMDB data immediately (fast, no AI wait) ----------
async function loadMovieBasics() {
  if (!tmdbMovieId) {
    detailsEl.textContent = "No movie selected.";
    return;
  }

  try {
    const headers = await authHeaders();
    const response = await fetchWithTimeout(`${API_BASE}/api/movies/${tmdbMovieId}`, 10000, headers);
    const movie = await response.json();

    if (!response.ok) {
      detailsEl.textContent = "Movie not found.";
      return;
    }

    if (movie.poster_path) {
      posterEl.src = `${TMDB_IMAGE_BASE}${movie.poster_path}`;
    }

    titleEl.textContent = movie.title || "Untitled";

   const upcoming = isUpcoming(movie);

    if (upcoming) {
      // Full "Upcoming DD Month YYYY" style date instead of just the year
      const formatted = new Date(movie.release_date).toLocaleDateString("en-US", {
        day: "numeric", month: "long", year: "numeric"
      });
      releaseDateEl.textContent = `Upcoming — ${formatted}`;
      playBtn.style.display = "none";
    } else {
      releaseDateEl.textContent = movie.release_date ? movie.release_date.slice(0, 4) : "N/A";
      playBtn.style.display = "flex";
    }

    const director = (movie.credits?.crew || []).find(c => c.job === "Director");
    directorNameEl.textContent = director?.name || "Unknown";
    if (director?.name) {
      directorNameEl.style.cursor = "pointer";
      directorNameEl.style.textDecoration = "underline";
      directorNameEl.onclick = () => {
        window.location.href = `director-page.html?type=director&name=${encodeURIComponent(director.name)}`;
      };
    }

    detailsEl.textContent = "Generating summary...";
    keywordBox.innerHTML = "<p style='opacity:0.5;'>Loading tags...</p>";

  } catch (err) {
    console.error("Failed to load movie basics:", err);
    detailsEl.textContent = "Something went wrong loading this movie.";
  }
}
// ---------- Load AI-enriched data separately (may take longer, doesn't block the rest of the page) ----------
async function loadMovieEnrichment() {
  if (!tmdbMovieId) return;

  try {
    const headers = await authHeaders();
    const response = await fetchWithTimeout(`${API_BASE}/api/ai/movie/${tmdbMovieId}`, 25000, headers);
    const movie = await response.json();

    if (!response.ok) return;

    detailsEl.textContent = movie.ai_summary || "No description available.";

    keywordBox.innerHTML = "";
    (movie.ai_keywords || []).forEach((keyword) => {
      const tag = document.createElement("p");
      tag.textContent = keyword;
      tag.style.cursor = "pointer";
      tag.addEventListener("click", () => {
        window.location.href = `director-page.html?type=keyword&q=${encodeURIComponent(keyword)}`;
      });
      keywordBox.appendChild(tag);
    });

  } catch (err) {
    console.error("Failed to load enrichment:", err);
    if (err.name === "AbortError") {
      detailsEl.textContent = "Taking longer than usual to generate — refresh in a moment.";
    } else {
      detailsEl.textContent = "Couldn't load the summary right now.";
    }
    keywordBox.innerHTML = "";
  }
}

// ---------- Check current wishlist/like status ----------
async function loadLibraryStatus() {
  const headers = await authHeaders();
  if (!headers.Authorization || !tmdbMovieId) return;

  try {
    const [wishlistRes, likedRes] = await Promise.all([
      fetch(`${API_BASE}/api/library/wishlist`, { headers }),
      fetch(`${API_BASE}/api/library/liked`, { headers }),
    ]);

    const wishlist = await wishlistRes.json();
    const liked = await likedRes.json();

    inWishlist = wishlist.some(item => item.tmdb_movie_id === Number(tmdbMovieId));
    isLiked = liked.some(item => item.tmdb_movie_id === Number(tmdbMovieId));

    updateButtonStates();
  } catch (err) {
    console.error("Failed to load library status:", err);
  }
}

function updateButtonStates() {
  wishlistBtn.classList.toggle("active", inWishlist);
  likeBtn.classList.toggle("active", isLiked);
}

// ---------- Toast ----------
const actionToast = document.getElementById("action-toast");
let toastTimeout;

function showToast(message) {
  clearTimeout(toastTimeout);
  actionToast.textContent = message;
  actionToast.classList.add("show");
  toastTimeout = setTimeout(() => {
    actionToast.classList.remove("show");
  }, 2000);
}

// ---------- Toggle wishlist ----------
wishlistBtn.addEventListener("click", async () => {
  const token = await getToken();
  if (!token) return;

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  if (inWishlist) {
    await fetch(`${API_BASE}/api/library/wishlist/${tmdbMovieId}`, {
      method: "DELETE",
      headers,
    });
    inWishlist = false;
    showToast("Removed from wishlist");
  } else {
    await fetch(`${API_BASE}/api/library/wishlist`, {
      method: "POST",
      headers,
      body: JSON.stringify({ tmdb_movie_id: Number(tmdbMovieId) }),
    });
    inWishlist = true;
    showToast("Saved to wishlist");
  }

  updateButtonStates();
});

// ---------- Toggle like ----------
likeBtn.addEventListener("click", async () => {
  const token = await getToken();
  if (!token) return;

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  if (isLiked) {
    await fetch(`${API_BASE}/api/library/liked/${tmdbMovieId}`, {
      method: "DELETE",
      headers,
    });
    isLiked = false;
    showToast("Removed from liked");
  } else {
    await fetch(`${API_BASE}/api/library/liked`, {
      method: "POST",
      headers,
      body: JSON.stringify({ tmdb_movie_id: Number(tmdbMovieId) }),
    });
    isLiked = true;
    showToast("Saved to liked");
  }

  updateButtonStates();
});

// ---------- Play/Pause toggle ----------
let isPlaying = false;
let wasTrailerShowing = false;

playBtn.addEventListener("click", async () => {
  const trailerBox = document.getElementById("auto-trailer-box");

  if (!isPlaying) {
    isPlaying = true;
    playBtn.textContent = "pause";

    const token = await getToken();
    if (token) {
      fetch(`${API_BASE}/api/library/watched`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ tmdb_movie_id: Number(tmdbMovieId), watch_progress: 0 }),
      }).catch(err => console.error("Failed to log watched:", err));
    }

    wasTrailerShowing = trailerBox.style.display !== "none";
    if (wasTrailerShowing && ytPlayer) {
      ytPlayer.pauseVideo();
      trailerBox.style.display = "none";
      stopTrailerTimer();
    }

    posterBox.style.display = "none";
    loadingBox.style.display = "flex";
    loadingState.style.display = "flex";
    errorState.style.display = "none";

    setTimeout(() => {
      loadingState.style.display = "none";
      errorState.style.display = "flex";
    }, 1500);

  } else {
    isPlaying = false;
    playBtn.textContent = "play";

    loadingBox.style.display = "none";

    if (wasTrailerShowing && ytPlayer) {
      trailerBox.style.display = "block";
      ytPlayer.playVideo();
      startTrailerTimer();
    } else {
      posterBox.style.display = "flex";
    }
  }
});


// ---------- Trailer elapsed-time timer ----------
let trailerTimerInterval = null;

function startTrailerTimer() {
  const timerEl = document.getElementById("trailer-timer");
  if (!timerEl) return;
  clearInterval(trailerTimerInterval);
  trailerTimerInterval = setInterval(() => {
    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== "function") return;
    const seconds = Math.floor(ytPlayer.getCurrentTime());
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerEl.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
  }, 500);
}

function stopTrailerTimer() {
  clearInterval(trailerTimerInterval);
}


let ytPlayer = null;
let trailerIsPlaying = false;

function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => resolve();
  });
}

async function autoPlayTrailer() {
  if (!tmdbMovieId) return;

  const posterBoxEl = document.getElementById("movie-poster-box");
  const trailerBox = document.getElementById("auto-trailer-box");
  const toggleBtn = document.getElementById("trailer-toggle-btn");
  const pauseIcon = document.getElementById("trailer-pause-icon");
  const playIcon = document.getElementById("trailer-play-icon");

  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    const headers = await authHeaders();
    const response = await fetchWithTimeout(`${API_BASE}/api/movies/${tmdbMovieId}/trailer`, 10000, headers);
    const data = await response.json();

    if (!data.youtube_key) return;

    await loadYouTubeAPI();

    posterBoxEl.style.display = "none";
    trailerBox.style.display = "block";

    ytPlayer = new YT.Player("auto-trailer-player", {
      videoId: data.youtube_key,
      playerVars: {
        autoplay: 1,
        mute: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        iv_load_policy: 3,   // hides annotations
        disablekb: 1,        // disables keyboard shortcuts
        fs: 0,                // hides fullscreen button
      },
        events: {
          onReady: () => {
            trailerIsPlaying = true;
            startTrailerTimer();
          },
        },
      });

    toggleBtn.addEventListener("click", () => {
      if (trailerIsPlaying) {
        ytPlayer.pauseVideo();
        pauseIcon.style.display = "none";
        playIcon.style.display = "block";
        trailerIsPlaying = false;
      } else {
        ytPlayer.playVideo();
        pauseIcon.style.display = "block";
        playIcon.style.display = "none";
        trailerIsPlaying = true;
      }
    });

    // ---------- Mute/unmute control ----------
    const muteBtn = document.getElementById("trailer-mute-btn");
    const mutedIcon = document.getElementById("trailer-muted-icon");
    const unmutedIcon = document.getElementById("trailer-unmuted-icon");
    let trailerMuted = true;

    muteBtn.addEventListener("click", () => {
      if (!ytPlayer) return;
      if (trailerMuted) {
        ytPlayer.unMute();
        mutedIcon.style.display = "none";
        unmutedIcon.style.display = "block";
      } else {
        ytPlayer.mute();
        mutedIcon.style.display = "block";
        unmutedIcon.style.display = "none";
      }
      trailerMuted = !trailerMuted;
    });

  } catch (err) {
    console.error("Auto trailer failed to load:", err);
  }
}

// ---------- Skeleton loading cards ----------
function renderSkeletonCards(wrapperEl, count = 6) {
  if (!wrapperEl) return;
  wrapperEl.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const card = document.createElement("div");
    card.className = "skeleton-card";
    const poster = document.createElement("div");
    poster.className = "skeleton-poster";
    card.appendChild(poster);
    wrapperEl.appendChild(card);
  }
}

// ---------- Generic movie card renderer (used for both similar & suggestions) ----------
function renderMovieCards(wrapperEl, movies, prefix) {
  if (!wrapperEl) return;
  wrapperEl.innerHTML = "";

  movies.forEach((movie) => {
    const card = document.createElement("div");
    card.className = `${prefix}-moviecard-template`;
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      window.location.href = `movie.html?id=${movie.id}`;
    });

    const posterDiv = document.createElement("div");
    posterDiv.className = `${prefix}-movie-card-poster`;
    const img = document.createElement("img");
    img.src = movie.poster_path
      ? `${TMDB_IMAGE_BASE}${movie.poster_path}`
      : "assets/placeholder.jpg";
    img.alt = movie.title || "";
    posterDiv.appendChild(img);

    const detailsDiv = document.createElement("div");
    detailsDiv.className = `${prefix}-movie-card-details`;
    const titleP = document.createElement("p");
    titleP.textContent = movie.title || "Untitled";
    detailsDiv.appendChild(titleP);

    card.appendChild(posterDiv);
    card.appendChild(detailsDiv);
    wrapperEl.appendChild(card);
  });
}

// ---------- Similar movies (same genre/style as this one) ----------
async function loadSimilarMovies() {
  if (!tmdbMovieId) return;
  renderSkeletonCards(similarWrapper);
  try {
    const headers = await authHeaders();
    const response = await fetchWithTimeout(`${API_BASE}/api/movies/${tmdbMovieId}/similar`, 12000, headers);
    const data = await response.json();
    const movies = (data.results || []).slice(0, 10);
    renderMovieCards(similarWrapper, movies, "similar");
  } catch (err) {
    console.error("Failed to load similar movies:", err);
    similarWrapper.innerHTML = "<p style='font-size:13px; opacity:0.6;'>Couldn't load right now.</p>";
  }
}

// ---------- Suggestions (random / trending, unrelated to this specific movie) ----------
async function loadSuggestedMovies() {
  renderSkeletonCards(suggestionWrapper);
  try {
    const headers = await authHeaders();

    let movies = [];

    // Try genuine personalized suggestions first, if the user has enough history
    if (headers.Authorization) {
      const response = await fetchWithTimeout(`${API_BASE}/api/recommendations/for-you`, 12000, headers);
      const data = await response.json();
      movies = data.results || [];
    }

    // Fallback to trending if there's no personalization yet (cold start / logged out)
    if (movies.length === 0) {
      const trendingRes = await fetchWithTimeout(`${API_BASE}/api/movies/trending?time_window=day`, 12000, headers);
      const trendingData = await trendingRes.json();
      movies = trendingData.results || [];
    }

    movies = movies.filter((m) => m.id !== Number(tmdbMovieId));

    // Shuffle so repeat visits don't always show the exact same order
    for (let i = movies.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [movies[i], movies[j]] = [movies[j], movies[i]];
    }

    movies = movies.slice(0, 10);
    renderMovieCards(suggestionWrapper, movies, "suggestion");
  } catch (err) {
    console.error("Failed to load suggestions:", err);
    suggestionWrapper.innerHTML = "<p style='font-size:13px; opacity:0.6;'>Couldn't load right now.</p>";
  }
}

// ---------- Init ----------
loadMovieBasics();
loadMovieEnrichment();
loadLibraryStatus();
loadSimilarMovies();
loadSuggestedMovies();
autoPlayTrailer();


//back to previous page
document.getElementById("back-to-home").addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "index.html";
  }
});