import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured as configured } from "./config.js";

export const isSupabaseConfigured = configured;

export const supabase = configured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export function showSetupNotice(element) {
  if (!element || configured) return;
  element.classList.remove("hidden");
  element.innerHTML =
    "Add your Supabase URL and anon key in <strong>assets/config.js</strong>, then run the SQL in <strong>supabase/schema.sql</strong>.";
}

export async function requireSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = "login.html";
    return null;
  }
  return data.session;
}

export async function logout() {
  if (supabase) await supabase.auth.signOut();
  window.location.href = "login.html";
}

export function normalizeRegNo(value) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

export function whatsappUrl(mobile) {
  const digits = String(mobile || "").replace(/\D/g, "");
  const number = digits.startsWith("91") ? digits : `91${digits}`;
  return `https://wa.me/${number}`;
}

export function whatsappIcon() {
  return `
    <svg class="whatsapp-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" />
      <path d="M17.5 14.8c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8.9-.1.2-.3.2-.6.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5s-.6-1.5-.9-2c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.5.6.2 1.2.1 1.6.1.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1 0-.2-.2-.3-.4-.4Z" class="phone-mark" />
      <path d="M6.1 18.1 6.9 15A6 6 0 1 1 9 17.1l-2.9 1Zm3.1-2.1.2.1a4.8 4.8 0 1 0-1.3-1.3l.1.2-.4 1.5L9.2 16Z" class="bubble-mark" />
    </svg>
  `;
}

export function daysUntil(dateValue) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateValue);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

export async function loadAdminAvatar(session = null) {
  const image = document.querySelector("#adminAvatarImg");
  const fallback = document.querySelector("#adminAvatarFallback");
  if (!image || !fallback || !supabase) return;

  let activeSession = session;
  if (!activeSession) {
    const { data } = await supabase.auth.getSession();
    activeSession = data.session;
  }

  if (!activeSession) return;

  let profile = null;
  const metadata = activeSession.user.user_metadata || {};

  try {
    const { data, error } = await supabase
      .from("admin_profiles")
      .select("name, profile_photo_url")
      .eq("manager_id", activeSession.user.id)
      .maybeSingle();

    if (!error) profile = data;
  } catch {
    profile = null;
  }

  const name = profile?.name || metadata.name || activeSession.user.email || "Admin";
  const photoUrl = profile?.profile_photo_url || metadata.profile_photo_url || "";

  fallback.textContent = initialsFromName(name);

  if (photoUrl) {
    image.src = photoUrl;
    image.classList.remove("hidden");
    fallback.classList.add("hidden");
    return;
  }

  image.removeAttribute("src");
  image.classList.add("hidden");
  fallback.classList.remove("hidden");
}

function initialsFromName(value) {
  const parts = String(value || "Admin")
    .replace(/@.*/, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (parts[0]?.[0] || "A").toUpperCase() + (parts[1]?.[0] || "D").toUpperCase();
}
