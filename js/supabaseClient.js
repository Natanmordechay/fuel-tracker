// js/supabaseClient.js
    const SUPABASE_URL = 'https://alervamlmqciixpzeprc.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsZXJ2YW1sbXFjaWl4cHplcHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMDc1ODUsImV4cCI6MjA4MDU4MzU4NX0.Hg1nZVHFT6SC5mHeBzhHRCVVX_1EOHBztgP-RZPzK00'; 

window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
