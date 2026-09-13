import { supabase } from "./supabase-config.js";
import { redirectIfAuthenticated } from "./auth-guard.js";

// Redirect if already logged in
redirectIfAuthenticated();

const form = document.getElementById("signup-form");
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("error-message");
const submitBtn = document.getElementById("create-account-btn");

function showError(msg) {
  errorMessage.textContent = msg;
}

function clearError() {
  errorMessage.textContent = "";
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Creating..." : "Create Account";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // 1. Empty field check
  if (!username || !email || !password) {
    showError("Please fill in all fields.");
    return;
  }

  // Basic email format check (native input type="email" also helps, but double-check)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError("Please enter a valid email address.");
    return;
  }

  if (password.length < 6) {
    showError("Password must be at least 6 characters.");
    return;
  }

  setLoading(true);

  try {
    // 2. Check if email already exists in profiles table
    const { data: existingProfile, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (checkError) {
      console.error("Email check error:", checkError);
      showError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    if (existingProfile) {
      showError("An account with this email already exists.");
      setLoading(false);
      return;
    }

    // 3. Create the auth user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      console.error("Signup error:", signUpError);
      showError(signUpError.message || "Failed to create account.");
      setLoading(false);
      return;
    }

    const user = signUpData.user;
    if (!user) {
      showError("Signup failed. Please try again.");
      setLoading(false);
      return;
    }

    // 4. Insert username + email into profiles table
    const { error: insertError } = await supabase.from("profiles").insert([
      {
        id: user.id,
        username: username,
        email: email,
      },
    ]);

    if (insertError) {
      console.error("Profile insert error:", insertError);
      showError("Account created, but saving profile failed. Contact support.");
      setLoading(false);
      return;
    }

    // 5. Success - redirect to index (or login, if email confirmation required)
    if (signUpData.session) {
      window.location.replace("index.html");
    } else {
      showError("");
      alert("Account created! Please check your email to confirm before logging in.");
      window.location.href = "login.html";
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    showError("Something went wrong. Please try again.");
    setLoading(false);
  }
});