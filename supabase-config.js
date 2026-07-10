// js/supabase-config.js

// Nota: Asegúrate de haber incluido el CDN de Supabase en tus archivos HTML:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const SUPABASE_URL = "https://tu-proyecto.supabase.co";
const SUPABASE_ANON_KEY = "tu-clave-anonima-aqui";

// Inicializar el cliente global
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Hacerlo accesible globalmente en el navegador
window.supabaseClient = _supabase;
