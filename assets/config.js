export const SUPABASE_URL = "https://zzarttypvbpzcpatvpta.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6YXJ0dHlwdmJwemNwYXR2cHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDk4OTgsImV4cCI6MjA5NTI4NTg5OH0.nZT3sQ8n24KA6ZMXLhfBzuUFN-_BNfEphARIZXvw3Zo";

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_ANON_KEY.length > 40 &&
  !SUPABASE_URL.includes("YOUR_") &&
  !SUPABASE_ANON_KEY.includes("YOUR_");
