import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://ejsmjsmrqasikneuwahl.supabase.co"; // Replace with your Supabase URL
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqc21qc21ycWFzaWtuZXV3YWhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNzQ2ODksImV4cCI6MjEwMzg1MDY4OX0.P8y9pSyTPFz9Q66eve5r5XdJW1GMRH3k75AeiznOxs8";          // Replace with your Supabase Anon Key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);