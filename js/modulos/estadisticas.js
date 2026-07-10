// js/modulos/estadisticas.js

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar que el cliente de Supabase esté inicializado globalmente
    if (!window.supabaseClient) {
        console.error("El cliente de Supabase no está disponible.");
        return;
    }

    // Ejecutar la carga de datos inicial
    await cargarKPIs();
    await cargarGraficoCategorias();
    await cargarGraficoMermas();
    await cargarTablaTraslados();
});

// 1. Cargar contadores rápidos (KPIs)
async function cargarKPIs() {
    const supabase = window.supabaseClient;

    // Contar total de donaciones registradas
    const { count: totalDonaciones } = await supabase
        .from('donaciones_ingresos')
        .select('*', { count: 'exact', head: true });

    // Contar traslados actualmente en camino
    const { count: enTransito } = await supabase
        .from('traslados_entre_centros')
        .select('*', { count: 'exact', head: true })
        .eq('estado_traslado', 'EN_TRANSITO');

    // Actualizar el HTML de forma segura (con textContent, evitando XSS)
    document.getElementById('kpi-donaciones').textContent = totalDonaciones || 0;
    document.getElementById('kpi-transito').textContent = `${enTransito || 0} camiones`;
}

// 2. Gráfico de Barras: Inventario por Categoría
async function cargarGraficoCategorias() {
    const supabase = window.supabaseClient;

    // Consultamos directamente el inventario agrupado
    // Nota: Para una estadística más limpia, aquí idealmente consumirías una vista agrupada por categoría
    const { data, error } = await supabase
        .from('productos_maestro')
        .select('categoria, id'); // Una consulta base simplificada para este ejemplo

    if (error) return console.error("Error cargando categorías:", error);

    // Procesamos los datos para contar cuántos productos hay por categoría
    const conteoCategorias = {};
    data.forEach(item => {
        conteoCategorias[item.categoria] = (conteoCategorias[item.categoria] || 0) + 1;
    });

    const etiquetas = Object.keys(conteoCategorias);
    const valores = Object.values(conteoCategorias);

    // Inicializar Chart.js
    const ctx = document.getElementById('graficoCategorias').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: etiquetas,
            datasets: [{
                label: 'Variedad de Ítems registrados',
                data: valores,
                backgroundColor: '#0284c7', // Azul principal de nuestro CSS
                borderWidth: 0,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

// 3. Gráfico de Líneas/Radar: Control de Mermas (Consumiendo la Vista de Supabase)
async function cargarGraficoMermas() {
    const supabase = window.supabaseClient;

    // Consumimos la vista SQL exacta que creamos anteriormente
    const { data: mermas, error } = await supabase
        .from('vista_control_mermas_traslados')
        .select('*')
        .limit(10); // Traer los últimos 10 traslados evaluados

    if (error) return console.error("Error cargando vista de mermas:", error);

    const etiquetas = mermas.map(m => `T-${m.traslado_id} (${m.nombre_producto.substring(0,10)}...)`);
    const despachado = mermas.map(m => m.cantidad_despachada);
    const recibido = mermas.map(m => m.cantidad_recibida);

    const ctx = document.getElementById('graficoMermas').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: etiquetas,
            datasets: [
                {
                    label: 'Cant. Despachada',
                    data: despachado,
                    borderColor: '#ea580c',
                    backgroundColor: 'transparent',
                    tension: 0.2
                },
                {
                    label: 'Cant. Recibida',
                    data: recibido,
                    borderColor: '#16a34a',
                    backgroundColor: 'transparent',
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// 4. Llenar la Tabla de Monitoreo de Camiones en tiempo real
async function cargarTablaTraslados() {
    const supabase = window.supabaseClient;

    // Hacer un JOIN básico mediante la sintaxis de selección de relaciones de Supabase
    const { data: traslados, error } = await supabase
        .from('traslados_entre_centros')
        .select(`
            id,
            estado_traslado,
            transportista_nombre,
            vehiculo_placa,
            centros_acopio!centro_origen_id(nombre),
            centro_destino:centros_acopio!centro_destino_id(nombre)
        `)
        .order('fecha_despacho', { ascending: false })
        .limit(5);

    if (error) return console.error("Error cargando tabla de traslados:", error);

    const cuerpoTabla = document.getElementById('tabla-traslados-cuerpo');
    cuerpoTabla.innerHTML = ''; // Limpiar

    traslados.forEach(t => {
        // Determinar el estilo del badge según el estado
        let badgeClass = 'badge-transito';
        if (t.estado_traslado.startsWith('RECIBIDO')) badgeClass = 'badge-recibido';

        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>#${t.id}</td>
            <td>${t.centros_acopio?.nombre || 'N/A'}</td>
            <td>${t.centro_destino?.nombre || 'N/A'}</td>
            <td>${t.vehiculo_placa}</td>
            <td>${t.transportista_nombre}</td>
            <td><span class="badge ${badgeClass}">${t.estado_traslado}</span></td>
        `;
        cuerpoTabla.appendChild(fila);
    });
}