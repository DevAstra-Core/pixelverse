import { supabase } from "./supabase-config.js";
import { redirectIfAuthenticated } from "./auth-guard.js";

document.addEventListener("DOMContentLoaded", () => {
  redirectIfAuthenticated();

  // ---------- Elements ----------
  const loginForm = document.getElementById("login-form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const errorMessage = document.getElementById("error-message");
  const loginBtn = document.getElementById("login-btn");

  const forgetPasswordLink = document.getElementById("forget-password");
  const verificationContainer = document.querySelector(".verification-form-container");
  const verificationForm = document.querySelector(".verification-form");
  const logInContainer = document.querySelector(".log-in-form");
  const backToLoginBtn = document.getElementById("back-to-login");

  const resetStatusText = document.getElementById("reset-status-text");
  const otpInput = document.getElementById("otp-input");
  const otpErrorMessage = document.getElementById("otp-error-message");
  const verifyOtpBtn = document.getElementById("verify-otp-btn");

  // Fail loudly instead of silently halting the whole file
  const required = {
    loginForm, emailInput, passwordInput, errorMessage, loginBtn,
    forgetPasswordLink, verificationContainer, verificationForm, logInContainer,
    backToLoginBtn, resetStatusText, otpInput, otpErrorMessage, verifyOtpBtn
  };
  let missing = false;
  for (const [name, el] of Object.entries(required)) {
    if (!el) {
      console.error(`login.js: could not find element for "${name}" — check the HTML id/class matches.`);
      missing = true;
    }
  }
  if (missing) return; // stop here instead of throwing later on a null element

  let pendingResetEmail = null;

  // ---------- View toggles ----------
  function showVerificationForm() {
    logInContainer.style.display = "none";
    verificationContainer.style.display = "flex";
    verificationForm.style.display = "flex";
  }

  function showLoginForm() {
    verificationContainer.style.display = "none";
    logInContainer.style.display = "flex";
    otpInput.value = "";
    otpErrorMessage.textContent = "";
  }

  verificationContainer.style.display = "none";

  // ---------- Login ----------
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorMessage.textContent = "";

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      errorMessage.textContent = "Please fill in both fields.";
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    loginBtn.disabled = false;
    loginBtn.textContent = "Login";

    if (error) {
      console.error("Login failed:", error);
      errorMessage.textContent = "Invalid email or password.";
      return;
    }

    window.location.href = "index.html";
  });

  // ---------- Forget password: step 1 (check email, send OTP) ----------
  forgetPasswordLink.addEventListener("click", async () => {
    errorMessage.textContent = "";
    const email = emailInput.value.trim();

    if (!email) {
      errorMessage.textContent = "Please enter your email above first.";
      return;
    }

    forgetPasswordLink.style.pointerEvents = "none";

    const { data: existingProfile, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (checkError) {
      console.error("Email check failed:", checkError);
      errorMessage.textContent = "Something went wrong. Please try again.";
      forgetPasswordLink.style.pointerEvents = "auto";
      return;
    }

    if (!existingProfile) {
      errorMessage.textContent = "No account found with this email.";
      forgetPasswordLink.style.pointerEvents = "auto";
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);

    forgetPasswordLink.style.pointerEvents = "auto";

    if (resetError) {
      console.error("Failed to send reset code:", resetError);
      errorMessage.textContent = "Failed to send reset code. Try again.";
      return;
    }

    pendingResetEmail = email;
    resetStatusText.textContent = `A 8-digit code has been sent to ${email}. Enter it below.`;
    showVerificationForm();
  });

  // ---------- Forget password: step 2 (verify OTP) ----------
  verifyOtpBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    otpErrorMessage.textContent = "";

    const otp = otpInput.value.trim();

    if (!otp) {
      otpErrorMessage.textContent = "Please enter the code sent to your email.";
      return;
    }

    if (!/^\d{8}$/.test(otp)) {
      otpErrorMessage.textContent = "Code must be 8 digits.";
      return;
    }

    verifyOtpBtn.disabled = true;
    verifyOtpBtn.textContent = "Verifying...";

    const { error } = await supabase.auth.verifyOtp({
      email: pendingResetEmail,
      token: otp,
      type: "recovery",
    });

    verifyOtpBtn.disabled = false;
    verifyOtpBtn.textContent = "Verify";

    if (error) {
      console.error("OTP verification failed:", error);
      otpErrorMessage.textContent = "Invalid or expired code. Try again.";
      return;
    }

    // verifyOtp with type "recovery" creates a valid session on success
    window.location.href = "index.html";
  });

  // ---------- Back to login ----------
  backToLoginBtn.addEventListener("click", () => {
    pendingResetEmail = null;
    showLoginForm();
  });
});