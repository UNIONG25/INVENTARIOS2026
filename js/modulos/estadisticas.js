// js/modulos/estadisticas.js

let instanciaGraficoCategorias = null;
let instanciaGraficoMermas = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabaseClient) return console.error("Supabase no inicializado en Estadísticas.");
    
    const rolActual = sessionStorage.getItem('usuario_rol');
    
    // 1. Cargar datos base de los selectores de centros
    await cargarSelectoresCentros();

    // 2. Ejecutar la carga paralela de métricas del Dashboard
    await cargarResumenContadores();
    await cargarGraficoCategorias();
    await cargarGraficoMermas();
    await cargarTablaTraslados();

    // 3. Si el usuario es administrador, habilitar herramientas CRUD y filtros avanzados
    if (rolActual === 'admin') {
        const panelAdmin = document.getElementById('panel-crud-admin');
        if (panelAdmin) panelAdmin.style.display = 'block';
        
        await cargarTablaUsuariosAdmin();
        configurarEventosAdmin();
    }
});

// CARGAR DATOS EN LOS SELECTORES DE LA INTERFAZ
async function cargarSelectoresCentros() {
    const { data: centros, error } = await window.supabaseClient
        .from('centros_acopio')
        .select('id, nombre');

    if (error) return console.error("Error cargando centros:", error.message);

    const filtroCentro = document.getElementById('filtro-centro');
    const crudCentro = document.getElementById('crud-centro-asignado');

    if (filtroCentro) {
        filtroCentro.innerHTML = '<option value="todos">Todos los Centros</option>';
        centros?.forEach(c => {
            filtroCentro.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
        });
    }

    if (crudCentro) {
        crudCentro.innerHTML = '<option value="">Acceso Global (Todos los Centros)</option>';
        centros?.forEach(c => {
            crudCentro.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
        });
    }
}

// 1. CARGAR CONTADORES PRINCIPALES (KPIs)
async function cargarResumenContadores(centroId = 'todos', desde = '', hasta = '') {
    const supabase = window.supabaseClient;

    let consultaDonaciones = supabase.from('donaciones_ingresos').select('*', { count: 'exact', head: true });
    let consultaTraslados = supabase.from('traslados').select('*', { count: 'exact', head: true }).eq('estado', 'EN_TRANSITO');

    if (centroId !== 'todos') {
        consultaDonaciones = consultaDonaciones.eq('centro_receptor_id', centroId);
        consultaTraslados = consultaTraslados.or(`centro_origen_id.eq.${centroId},centro_destino_id.eq.${centroId}`);
    }
    if (desde) {
        consultaDonaciones = consultaDonaciones.gte('created_at', desde);
        consultaTraslados = consultaTraslados.gte('fecha_despacho', desde);
    }
    if (hasta) {
        consultaDonaciones = consultaDonaciones.lte('created_at', hasta + ' 23:59:59');
        consultaTraslados = consultaTraslados.lte('fecha_despacho', hasta + ' 23:59:59');
    }

    const { count: totalDonaciones } = await consultaDonaciones;
    const { count: enTransito } = await consultaTraslados;

    const { count: totalAlertas, error: errAlertas } = await supabase
        .from('inventario_centros')
        .select('*', { count: 'exact', head: true })
        .eq('cantidad_unidades', 0);

    if (errAlertas) {
        console.error("Error calculando alertas críticas:", errAlertas.message);
    }

    if (document.getElementById('kpi-donaciones')) {
        document.getElementById('kpi-donaciones').textContent = totalDonaciones || 0;
    }
    if (document.getElementById('kpi-transito')) {
        document.getElementById('kpi-transito').textContent = (enTransito || 0) + " camiones";
    }
    if (document.getElementById('kpi-alertas')) {
        document.getElementById('kpi-alertas').textContent = (totalAlertas || 0) + " ítems";
    }
}

// 2. GRÁFICO DE STOCK POR CATEGORÍAS (Doughnut)
async function cargarGraficoCategorias(centroId = 'todos') {
    const selectorCtx = document.getElementById('grafico-categorias');
    if (!selectorCtx) return;

    let consulta = window.supabaseClient.from('vista_inventario_unificado').select('categoria, cantidad_unidades');
    
    if (centroId !== 'todos') {
        consulta = consulta.eq('centro_id', centroId);
    }

    const { data, error } = await consulta;
    if (error) return console.error("Error en gráfico categorías:", error.message);

    const resumen = {};
    data?.forEach(item => {
        resumen[item.categoria] = (resumen[item.categoria] || 0) + item.cantidad_unidades;
    });

    if (instanciaGraficoCategorias) instanciaGraficoCategorias.destroy();

    instanciaGraficoCategorias = new Chart(selectorCtx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(resumen),
            datasets: [{
                data: Object.values(resumen),
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

// 3. GRÁFICO DE CONTROL DE LOSS/MERMAS (Barras Comparativas)
async function cargarGraficoMermas(desde = '', hasta = '') {
    const selectorCtx = document.getElementById('grafico-mermas');
    if (!selectorCtx) return;

    let consulta = window.supabaseClient.from('vista_control_mermas_traslados').select('*').limit(15);

    const { data, error } = await consulta;
    if (error) return console.error("Error cargando vista de mermas:", error.message);

    const etiquetas = data.map(d => d.nombre_producto);
    const despachado = data.map(d => d.cantidad_despachada);
    const recibido = data.map(d => d.cantidad_recibida);

    if (instanciaGraficoMermas) instanciaGraficoMermas.destroy();

    instanciaGraficoMermas = new Chart(selectorCtx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: etiquetas,
            datasets: [
                { label: 'Despachado', data: despachado, backgroundColor: '#64748b' },
                { label: 'Recibido', data: recibido, backgroundColor: '#10b981' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

// 4. TABLA DE ÚLTIMOS TRASLADOS EN RUTA
async function cargarTablaTraslados(centroId = 'todos', desde = '', hasta = '') {
    const cuerpoTabla = document.getElementById('tabla-traslados-cuerpo');
    if (!cuerpoTabla) return;

    let consulta = window.supabaseClient
        .from('traslados')
        .select(`
            id, estado, chofer_datos, vehiculo_placa,
            centro_origen:centros_acopio!centro_origen_id(nombre),
            centro_destino:centros_acopio!centro_destino_id(nombre)
        `);

    if (centroId !== 'todos') {
        consulta = consulta.or(`centro_origen_id.eq.${centroId},centro_destino_id.eq.${centroId}`);
    }
    if (desde) consulta = consulta.gte('fecha_despacho', desde);
    if (hasta) consulta = consulta.lte('fecha_despacho', hasta + ' 23:59:59');

    const { data: envios, error } = await consulta.order('id', { ascending: false }).limit(5);

    if (error) {
        console.error("Error cargando tabla de traslados:", error.message);
        cuerpoTabla.innerHTML = `<tr><td colspan="6" style="color:red;">Error al cargar datos remotos.</td></tr>`;
        return;
    }

    cuerpoTabla.innerHTML = "";
    if (!envios || envios.length === 0) {
        cuerpoTabla.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b;">No hay movimientos registrados para este rango.</td></tr>`;
        return;
    }

    envios.forEach(e => {
        const badgeClass = e.estado === 'EN_TRANSITO' ? 'badge-transito' : 'badge-completado';
        cuerpoTabla.innerHTML += `
            <tr>
                <td>#TR-${e.id}</td>
                <td>${e.centro_origen?.nombre || 'Central'}</td>
                <td>${e.centro_destino?.nombre || 'Refugio / Extension'}</td>
                <td><strong>${e.chofer_datos}</strong></td>
                <td><span class="badge" style="background:#475569; color:#fff;">${e.vehiculo_placa}</span></td>
                <td><span class="badge ${badgeClass}">${e.estado}</span></td>
            </tr>
        `;
    });
}

// ==========================================
// 🛡️ CONTROL DE FILTROS AVANZADOS Y REPORTES
// ==========================================
function configurarEventosAdmin() {
    const btnFiltrar = document.getElementById('btn-aplicar-filtros');
    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', async () => {
            const centro = document.getElementById('filtro-centro').value;
            const desde = document.getElementById('filtro-desde').value;
            const hasta = document.getElementById('filtro-hasta').value;

            await cargarResumenContadores(centro, desde, hasta);
            await cargarGraficoCategorias(centro);
            await cargarTablaTraslados(centro, desde, hasta);
        });
    }

    // Evento Submit de Gestión de Usuarios (CRUD) - REPARADO LIMPIO
    const formUsuario = document.getElementById('form-usuario-admin');
    if (formUsuario) {
        formUsuario.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('crud-user-id').value;
            const username = document.getElementById('crud-username').value.trim();
            const password_text = document.getElementById('crud-password').value;
            const nombre_completo = document.getElementById('crud-nombre').value.trim();
            const rol = document.getElementById('crud-rol').value;
            const centro_id = document.getElementById('crud-centro-asignado')?.value;

            const payload = {
                username, 
                password_text, 
                nombre_completo, 
                rol,
                centro_asignado_id: centro_id ? parseInt(centro_id) : null
            };

            if (id) {
                await window.supabaseClient.from('usuarios_sistema').update(payload).eq('id', id);
                alert("✓ Usuario actualizado correctamente.");
            } else {
                await window.supabaseClient.from('usuarios_sistema').insert([payload]);
                alert("✓ Nuevo operador dado de alta con éxito.");
            }

            restablecerFormUsuario();
            await cargarTablaUsuariosAdmin();
        });
    }

    const btnCancelar = document.getElementById('btn-cancelar-edicion');
    if (btnCancelar) btnCancelar.addEventListener('click', restablecerFormUsuario);

    const formCentro = document.getElementById('form-centro-admin');
    if (formCentro) {
        formCentro.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('crud-centro-nombre').value.trim();
            const ubicacion = document.getElementById('crud-centro-ubicacion').value.trim();

            const { error } = await window.supabaseClient.from('centros_acopio').insert([{ nombre, ubicacion }]);
            if (error) return alert("Error al registrar centro: " + error.message);

            alert("✓ Nuevo Centro de Acopio creado.");
            document.getElementById('form-centro-admin').reset();
            await cargarSelectoresCentros();
        });
    }
}

// CARGAR LA TABLA CRUD DE OPERADORES Y CLAVES
async function cargarTablaUsuariosAdmin() {
    const cuerpo = document.getElementById('tabla-usuarios-admin-cuerpo');
    if (!cuerpo) return;

    const { data: usuarios } = await window.supabaseClient.from('usuarios_sistema').select('*');
    const { data: centros } = await window.supabaseClient.from('centros_acopio').select('id, nombre');

    cuerpo.innerHTML = "";
    usuarios?.forEach(u => {
        const centroNombre = centros?.find(c => c.id === u.centro_asignado_id)?.nombre || 'Acceso Global (Admin)';
        cuerpo.innerHTML += `
            <tr style="border-bottom: 1px solid #334155;">
                <td><strong>${u.username}</strong></td>
                <td>${u.nombre_completo}</td>
                <td><span class="badge" style="background:#1e3a8a;">${u.rol}</span></td>
                <td>${centroNombre}</td>
                <td><code style="background:#0f172a; padding:3px 6px; border-radius:4px; color:#38bdf8;">${u.password_text}</code></td>
                <td>
                    <button class="btn btn-azul" onclick="prepararEdicionUsuario('${u.username}', '${u.nombre_completo}', '${u.password_text}', '${u.rol}', '${u.centro_asignado_id || ''}', ${u.id})" style="padding:4px 8px; font-size:0.8rem;">Editar</button>
                    <button class="btn btn-rojo" onclick="eliminarUsuarioAdmin(${u.id})" style="padding:4px 8px; font-size:0.8rem;">Eliminar</button>
                </td>
            </tr>
        `;
    });
}

window.prepararEdicionUsuario = function(username, nombre, clave, rol, centroId, id) {
    document.getElementById('crud-user-id').value = id;
    document.getElementById('crud-username').value = username;
    document.getElementById('crud-password').value = clave;
    document.getElementById('crud-nombre').value = nombre;
    document.getElementById('crud-rol').value = rol;
    
    const selectorCentro = document.getElementById('crud-centro-asignado');
    if (selectorCentro) selectorCentro.value = centroId;

    document.getElementById('btn-cancelar-edicion').style.display = 'inline-block';
};

function restablecerFormUsuario() {
    document.getElementById('form-usuario-admin').reset();
    document.getElementById('crud-user-id').value = '';
    document.getElementById('btn-cancelar-edicion').style.display = 'none';
}

window.eliminarUsuarioAdmin = function(id) {
    if (confirm("¿Estás seguro de que deseas eliminar este usuario y revocar su clave de acceso?")) {
        window.supabaseClient.from('usuarios_sistema').delete().eq('id', id).then(() => {
            cargarTablaUsuariosAdmin();
        });
    }
};