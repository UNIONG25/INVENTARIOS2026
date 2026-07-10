// js/supabase_config.js

// Nota: Asegúrate de haber incluido el CDN de Supabase en tus archivos HTML:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const SUPABASE_URL = 'https://ajhubmxofzfdelxbgjjf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqaHVibXhvZnpmZGVseGJnampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MzEwOTIsImV4cCI6MjA5OTAwNzA5Mn0.19vQ77T-kjNIu3-VZYrBT8hOnhiJvYtvwTfEiFK_8qU';

// Inicializar el cliente global
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Hacerlo accesible globalmente en el navegador
window.supabaseClient = _supabase;