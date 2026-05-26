import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const form = document.querySelector("#registerForm");
const message = document.querySelector("#authMessage");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";

  const name = document.querySelector("#name").value.trim();
  const mobile = document.querySelector("#mobile").value.trim();
  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;
  const confirmPassword = document.querySelector("#confirmPassword").value;

  if (password !== confirmPassword) {
    message.textContent = "Password and confirm password must match.";
    return;
  }

  if (!isSupabaseConfigured) {
    message.textContent = "Supabase is not configured yet. Add keys in assets/config.js.";
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/login.html`,
      data: { name, mobile },
    },
  });

  if (error) {
    message.textContent = error.message.includes("rate limit")
      ? "Supabase email limit reached. For testing, turn off email confirmations or configure custom SMTP in Supabase."
      : error.message;
    return;
  }

  if (data.session) {
    message.textContent = "Registration successful. Redirecting to dashboard.";
    setTimeout(() => {
      window.location.href = "insurance.html";
    }, 900);
    return;
  }

  message.textContent = "Registration successful. Check your email and click the confirmation link before login.";
});
