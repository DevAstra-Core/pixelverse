import { supabase } from "./supabase-config.js";

function getSupabaseClient() {
  return supabase || window.supabaseClient;
}

/**
 * For Protected Pages (e.g., index.html, account.html):
 * Kick unauthenticated users out to login.html, and re-verify
 * the session any time this page is restored via back/forward cache.
 */
export async function requireAuth() {
  const client = getSupabaseClient();
  if (!client) {
    console.error("Supabase client not initialized.");
    return;
  }

  async function checkSession() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      console.warn("No valid session. Redirecting to login...");
      window.location.replace("login.html");
    }
  }

  await checkSession();

  // Re-verify whenever this page is restored from bfcache
  // (covers your back->forward-to-index.html case).
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      checkSession();
    }
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      console.warn("User signed out. Redirecting to login...");
      window.location.replace("login.html");
    }
  });
}

/**
 * For Public Auth Pages (e.g., signup.html, login.html):
 * Redirect already-logged-in users to index.html — but keep this
 * page in browser history so back button still works.
 */
export async function redirectIfAuthenticated() {
  const client = getSupabaseClient();
  if (!client) {
    console.error("Supabase client not initialized.");
    return;
  }

  const { data: { session } } = await client.auth.getSession();
  if (session) {
    console.log("User already logged in. Redirecting to dashboard...");
    window.location.href = "index.html"; // href, not replace — keeps history entry
    return;
  }

  client.auth.onAuthStateChange((event, session) => {
    if (session) {
      console.log("Session detected. Redirecting to dashboard...");
      window.location.href = "index.html";
    }
  });
}