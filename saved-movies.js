import { supabase } from "./supabase-config.js";
import { requireAuth } from "./auth-guard.js";
import { API_BASE } from "./config.js";

requireAuth();

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";


const wishlistToggle = document.getElementById("wishlist-toggle");
const likedToggle = document.getElementById("liked-toggle");
const wishlistContainer = document.getElementById("wishlisted-movies-container");
const likedContainer = document.getElementById("liked-movies-container");

let token = null;

async function getToken() {
  if (token) return token;
  const { data: { session } } = await supabase.auth.getSession();
  token = session?.access_token;
  return token;
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

// ---------- Fetch a library list (wishlist or liked) and enrich each with real movie data ----------
async function fetchLibraryMovies(endpoint) {
  const t = await getToken();
  if (!t) return [];

  const response = await fetch(`${API_BASE}/api/library/${endpoint}`, {
    headers: { "Authorization": `Bearer ${t}` },
  });
  const rows = await response.json();

  // Each row only has tmdb_movie_id — fetch real movie details for each
  const movies = await Promise.all(
    rows.map(async (row) => {
      try {
        const res = await fetch(`${API_BASE}/api/movies/${row.tmdb_movie_id}`);
        const movie = await res.json();
        return movie;
      } catch {
        return null;
      }
    })
  );

  return movies.filter(Boolean);
}

// ---------- Render cards into a container ----------
function renderCards(containerEl, movies, cardClass, posterHolderClass, titleClass, removeBtnClass, onRemove) {
  containerEl.innerHTML = "";

  if (movies.length === 0) {
    containerEl.innerHTML = "<p class='empty-state'>Nothing saved here yet.</p>";
    return;
  }

  movies.forEach((movie) => {
    const card = document.createElement("div");
    card.className = cardClass;

    const posterHolder = document.createElement("div");
    posterHolder.className = posterHolderClass;
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
    titleP.style.cursor = "pointer";
    titleP.addEventListener("click", () => {
      window.location.href = `movie.html?id=${movie.id}`;
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = removeBtnClass;
    removeBtn.textContent = "x";
    removeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await onRemove(movie.id);
      card.remove();
      // Re-check for empty state after removal
      if (containerEl.children.length === 0) {
        containerEl.innerHTML = "<p class='empty-state'>Nothing saved here yet.</p>";
      }
    });

    details.appendChild(titleP);
    details.appendChild(removeBtn);

    card.appendChild(posterHolder);
    card.appendChild(details);
    containerEl.appendChild(card);
  });
}

// ---------- Load wishlist ----------
async function loadWishlist() {
  wishlistContainer.innerHTML = "<p class='empty-state'>Loading...</p>";
  const movies = await fetchLibraryMovies("wishlist");

  renderCards(
    wishlistContainer,
    movies,
    "wishlist-movie-card",
    "wishlist-movie-poster-holder",
    "wishlist-movie-title",
    "wishlist-movie-remove-button",
    async (movieId) => {
      const t = await getToken();
      await fetch(`${API_BASE}/api/library/wishlist/${movieId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${t}` },
      });
    }
  );
}

// ---------- Load liked ----------
async function loadLiked() {
  likedContainer.innerHTML = "<p class='empty-state'>Loading...</p>";
  const movies = await fetchLibraryMovies("liked");

  renderCards(
    likedContainer,
    movies,
    "liked-movie-card",
    "liked-movie-poster-holder",
    "liked-movie-title",
    "liked-movie-remove-button",
    async (movieId) => {
      const t = await getToken();
      await fetch(`${API_BASE}/api/library/liked/${movieId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${t}` },
      });
    }
  );
}

// ---------- Toggle handlers (your existing logic, unchanged) ----------
wishlistToggle.addEventListener("click", () => {
  wishlistToggle.classList.add("active");
  likedToggle.classList.remove("active");
  wishlistContainer.classList.add("active-box");
  likedContainer.classList.remove("active-box");
});

likedToggle.addEventListener("click", () => {
  likedToggle.classList.add("active");
  wishlistToggle.classList.remove("active");
  likedContainer.classList.add("active-box");
  wishlistContainer.classList.remove("active-box");
});

// ---------- Init ----------
loadWishlist();
loadLiked();




//back to previous page
document.getElementById("back-to-home").addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "index.html";
  }
});
