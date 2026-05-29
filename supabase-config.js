// supabase-config.js
const SUPABASE_URL = "https://ryispebnhelbmspmxggn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5aXNwZWJuaGVsYm1zcG14Z2duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDc3NTIsImV4cCI6MjA5NTQyMzc1Mn0.B0OuyglOOu7n7W-YvcK5vTXIgRO1AAuqsz0Sep8NYfw";

// 🔴 수정: supabase → window.supabase (CDN 로드 후 올바른 네임스페이스)
window.supabaseClient = window.supabase.createClient("https://ryispebnhelbmspmxggn.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5aXNwZWJuaGVsYm1zcG14Z2duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDc3NTIsImV4cCI6MjA5NTQyMzc1Mn0.B0OuyglOOu7n7W-YvcK5vTXIgRO1AAuqsz0Sep8NYfw");
