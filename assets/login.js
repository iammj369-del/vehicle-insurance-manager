import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const form = document.querySelector("#loginForm");
const resetPasswordForm = document.querySelector("#resetPasswordForm");
const message = document.querySelector("#authMessage");
const forgotPasswordBtn = document.querySelector("#forgotPasswordBtn");

if (window.location.hash.includes("type=recovery") || window.location.search.includes("type=recovery")) {
  form.classList.add("hidden");
  resetPasswordForm.classList.remove("hidden");
  forgotPasswordBtn.classList.add("hidden");
  message.textContent = "Enter a new password for your account.";
} else if (window.location.hash.includes("type=signup") || window.location.search.includes("type=signup")) {
  message.textContent = "Email confirmed successfully. Login with your email id and password.";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";

  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;

  if (!isSupabaseConfigured) {
    message.textContent = "Supabase is not configured yet. Add keys in assets/config.js.";
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    message.textContent = error.message.includes("Email not confirmed")
      ? "Email is not confirmed yet. Open your registered email id and click the confirmation link first."
      : error.message;
    return;
  }

  window.location.href = "insurance.html";
});

forgotPasswordBtn.addEventListener("click", async () => {
  message.textContent = "";
  const email = document.querySelector("#email").value.trim();

  if (!email) {
    message.textContent = "Enter email id first, then click Forgot Password.";
    return;
  }

  if (!isSupabaseConfigured) {
    message.textContent = "Supabase is not configured yet. Add keys in assets/config.js.";
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login.html`,
  });

  message.textContent = error
    ? error.message
    : "Password reset link sent to the registered email id.";
});

resetPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";

  const newPassword = document.querySelector("#newPassword").value;
  const confirmNewPassword = document.querySelector("#confirmNewPassword").value;

  if (newPassword !== confirmNewPassword) {
    message.textContent = "New password and confirm password must match.";
    return;
  }

  if (!isSupabaseConfigured) {
    message.textContent = "Supabase is not configured yet. Add keys in assets/config.js.";
    return;
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    message.textContent = error.message;
    return;
  }

  message.textContent = "Password updated successfully. Login with your new password.";
  await supabase.auth.signOut();
  setTimeout(() => {
    window.location.href = "login.html";
  }, 1000);
});
