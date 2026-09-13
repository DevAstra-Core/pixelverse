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


const historyContainer = document.getElementById("history-movies-container");

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

async function loadHistory() {
  historyContainer.innerHTML = "<p class='empty-state'>Loading...</p>";

  const t = await getToken();
  if (!t) return;

  const response = await fetch(`${API_BASE}/api/library/watched`, {
    headers: { "Authorization": `Bearer ${t}` },
  });
  const rows = await response.json();

  if (rows.length === 0) {
    historyContainer.innerHTML = "<p class='empty-state'>No watch history yet.</p>";
    return;
  }

  // Enrich each watched row with real movie details
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

  renderCards(movies.filter(Boolean));
}

function renderCards(movies) {
  historyContainer.innerHTML = "";

  if (movies.length === 0) {
    historyContainer.innerHTML = "<p class='empty-state'>No watch history yet.</p>";
    return;
  }

  movies.forEach((movie) => {
    const card = document.createElement("div");
    card.className = "history-movie-card";

    const posterHolder = document.createElement("div");
    posterHolder.className = "history-movie-poster-holder";
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
    details.className = "history-movie-details";

    const titleP = document.createElement("p");
    titleP.className = "history-movie-title";
    titleP.textContent = movie.title || "Untitled";
    titleP.addEventListener("click", () => {
      window.location.href = `movie.html?id=${movie.id}`;
    });

    const removeBtn = document.createElement("button");
    removeBtn.id = "history-movie-remove-button";
    removeBtn.textContent = "x";
    removeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const t = await getToken();
      await fetch(`${API_BASE}/api/library/watched/${movie.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${t}` },
      });
      card.remove();
      if (historyContainer.children.length === 0) {
        historyContainer.innerHTML = "<p class='empty-state'>No watch history yet.</p>";
      }
    });

    details.appendChild(titleP);
    details.appendChild(removeBtn);

    card.appendChild(posterHolder);
    card.appendChild(details);
    historyContainer.appendChild(card);
  });
}

// ---------- Init ----------
loadHistory();