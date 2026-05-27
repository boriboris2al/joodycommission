// supabase-config.js

const SUPABASE_URL = "https://ryispebnhelbmspmxggn.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5aXNwZWJuaGVsYm1zcG14Z2duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDc3NTIsImV4cCI6MjA5NTQyMzc1Mn0.B0OuyglOOu7n7W-YvcK5vTXIgRO1AAuqsz0Sep8NYfw";



// 전역에서 사용할 수 있도록 window 객체에 등록

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
