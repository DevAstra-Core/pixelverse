import { supabase } from "./supabase-config.js";
import { requireAuth } from "./auth-guard.js";
import { API_BASE } from "./config.js";


window.debugToken = async () => { const { data: { session } } = await supabase.auth.getSession(); console.log(session?.access_token); };
// Protect this page
requireAuth();




//back to previous page
document.getElementById("back-to-home").addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "index.html";
  }
});



const usernameDisplay = document.getElementById("username");
const emailDisplay = document.getElementById("user-mail");
const childLockBtn = document.getElementById("child-lock-toggle");
const adultContentBtn = document.getElementById("toggle-adult-content");

const newUsernameInput = document.getElementById("new-username");
const changeUsernameBtn = document.getElementById("change-username");

const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const changePasswordBtn = document.getElementById("change-user-password");

const logoutBtn = document.getElementById("logout-user");

let currentUser = null;
let profile = null;

// ---------- Load profile data ----------
// ---------- Load profile data ----------
async function loadProfile() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error("Failed to get user:", userError);
    return;
  }
  currentUser = user;

  const { data, error } = await supabase
    .from("profiles")
    .select("username, email, child_lock_enabled, adult_content_enabled")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Failed to load profile:", error);
    return;
  }

  profile = data;
  usernameDisplay.textContent = profile.username?.toUpperCase() || "";
  emailDisplay.textContent = profile.email || user.email;

  childLockBtn.textContent = profile.child_lock_enabled ? "Disable" : "Enable";
  styleToggleButton(childLockBtn);

adultContentBtn.textContent = profile.adult_content_enabled ? "Disable" : "Enable";
styleToggleButton(adultContentBtn);
}

loadProfile();

// ---------- Child lock toggle ----------
childLockBtn.addEventListener("click", async () => {
  const newValue = !profile.child_lock_enabled;
  childLockBtn.disabled = true;

  const { error } = await supabase
    .from("profiles")
    .update({ child_lock_enabled: newValue })
    .eq("id", currentUser.id);

  childLockBtn.disabled = false;

  if (error) {
    console.error("Failed to update child lock:", error);
    alert("Failed to update child lock. Try again.");
    return;
  }

  profile.child_lock_enabled = newValue;
  childLockBtn.textContent = newValue ? "Disable" : "Enable";
  styleToggleButton(childLockBtn);
});

// ---------- Recommendations toggle ----------
adultContentBtn.addEventListener("click", async () => {
  const newValue = !profile.adult_content_enabled;
  adultContentBtn.disabled = true;

  const { error } = await supabase
    .from("profiles")
    .update({ adult_content_enabled: newValue })
    .eq("id", currentUser.id);

  adultContentBtn.disabled = false;

  if (error) {
    console.error("Failed to update adult content setting:", error);
    alert("Failed to update setting. Try again.");
    return;
  }

  profile.adult_content_enabled = newValue;
  adultContentBtn.textContent = newValue ? "Disable" : "Enable";
  styleToggleButton(adultContentBtn);
});
// ---------- Button color helper ----------
function styleToggleButton(btn) {
  const label = btn.textContent.trim().toLowerCase();
  if (label === "enable") {
    btn.style.backgroundColor = "#2563eb"; // blue
    btn.style.color = "#fff";
  } else {
    btn.style.backgroundColor = "#444444"; // black
    btn.style.color = "#fff";
    btn.style.border = "1px solid #393939";
  }
}
// ---------- Change username ----------
changeUsernameBtn.addEventListener("click", async () => {
  const newUsername = newUsernameInput.value.trim();

  if (!newUsername) {
    alert("Please enter a new username.");
    return;
  }

  changeUsernameBtn.disabled = true;

  const { error } = await supabase
    .from("profiles")
    .update({ username: newUsername })
    .eq("id", currentUser.id);

  changeUsernameBtn.disabled = false;

  if (error) {
    console.error("Failed to update username:", error);
    alert("Failed to update username. Try again.");
    return;
  }

  profile.username = newUsername;
  usernameDisplay.textContent = newUsername.toUpperCase();
  newUsernameInput.value = "";
  alert("Username updated!");
});

// ---------- Change password ----------
changePasswordBtn.addEventListener("click", async () => {
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (!newPassword || !confirmPassword) {
    alert("Please fill in both password fields.");
    return;
  }

  if (newPassword.length < 6) {
    alert("Password must be at least 6 characters.");
    return;
  }

  if (newPassword !== confirmPassword) {
    alert("Passwords do not match.");
    return;
  }

  changePasswordBtn.disabled = true;

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  changePasswordBtn.disabled = false;

  if (error) {
    console.error("Failed to update password:", error);
    alert(error.message || "Failed to update password. Try again.");
    return;
  }

  newPasswordInput.value = "";
  confirmPasswordInput.value = "";
  alert("Password updated!");
});

// ---------- Dropdown effect (username & password sections) ----------
// ---------- Dropdown effect (username & password sections) ----------
function setupDropdown(headerSelector, panelSelector) {
  const header = document.querySelector(headerSelector);
  const panel = document.querySelector(panelSelector);
  const arrow = header.querySelector("svg");

  panel.style.display = "none";
  arrow.style.transition = "transform 0.3s ease";

  header.addEventListener("click", () => {
    const isOpen = panel.style.display === "flex";
    if (isOpen) {
      panel.style.display = "none";
      arrow.style.transform = "rotate(0deg)";
    } else {
      panel.style.display = "flex";
      arrow.style.transform = "rotate(180deg)";
    }
  });
}

setupDropdown(".account-username-data .holder", ".account-username-data .user-data-container");
setupDropdown(".account-password-data .holder", ".account-password-data .user-password-container");
// ---------- Logout ----------
logoutBtn.addEventListener("click", async () => {
  logoutBtn.disabled = true;
  const { error } = await supabase.auth.signOut();
  logoutBtn.disabled = false;

  if (error) {
    console.error("Logout failed:", error);
    alert("Failed to log out. Try again.");
    return;
  }

  // replace, not href — permanently removes account.html from history
  // so back/forward can never restore it without a fresh login
  window.location.replace("login.html");
});








// ---------- User Progress dropdown toggle ----------
const progressToggleBtn = document.getElementById("toggleBtn");
const progressList = document.getElementById("list");

progressToggleBtn.addEventListener("click", () => {
  progressToggleBtn.classList.toggle("open");
  progressList.classList.toggle("open");
});

// ---------- Load and display genre taste scores ----------
async function loadGenreScores() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  try {
    const response = await fetch(`${API_BASE}/api/recommendations/genre-scores`, {
      headers: { "Authorization": `Bearer ${session.access_token}` },
    });
    const data = await response.json();
    const scores = data.scores || {};

    // Maps the HTML's display labels to the backend's genre names
    const labelMap = {
      "Sci-Fi (Science Fiction)": "Science Fiction",
      "Family / Kids": "Family",
      "Music / Musical": "Music",
      "History or Biography": "History",
    };

    document.querySelectorAll("#list li").forEach((li) => {
      const categoryLabel = li.querySelector(".category").textContent.trim();
      const scoreEl = li.querySelector(".score");
      const backendName = labelMap[categoryLabel] || categoryLabel;
      scoreEl.textContent = scores[backendName] ?? 0;
    });

    // Sort so the user's most-loved genres float to the top
    const listEl = document.querySelector("#list ul");
    const items = Array.from(listEl.children);
    items.sort((a, b) => {
      const scoreA = parseInt(a.querySelector(".score").textContent) || 0;
      const scoreB = parseInt(b.querySelector(".score").textContent) || 0;
      return scoreB - scoreA;
    });
    items.forEach((item) => listEl.appendChild(item));

  } catch (err) {
    console.error("Failed to load genre scores:", err);
  }
}

loadGenreScores();

