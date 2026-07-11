// js/modulos/donaciones.js

let productosDonados = []; // Array temporal para guardar lo cargado en la sesión actual

// 1. ARRANQUE ÚNICO Y SEGURO DEL SISTEMA
document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabaseClient) {
        console.error("Error: El cliente de Supabase no está inicializado globalmente.");
        return;
    }

    // Cargar dependencias de la interfaz en orden
    await cargarCentrosReceptores();
    inicializarEscaner();
    configurarEventosModal();
});

// 2. CARGAR CENTROS DE ACOPIO EN EL SELECTOR
async function cargarCentrosReceptores() {
    const selector = document.getElementById('centro-receptor');
    if (!selector) return;

    const { data: centros, error } = await window.supabaseClient
        .from('centros_acopio')
        .select('id, nombre');
    
    if (error) {
        console.error("Error cargando centros:", error.message);
        return;
    }

    selector.innerHTML = '<option value="">Seleccione un Centro...</option>';
    centros?.forEach(c => {
        const opcion = document.createElement('option');
        opcion.value = c.id;
        opcion.textContent = c.nombre;
        selector.appendChild(opcion);
    });
}

// 3. INICIALIZAR EL ESCÁNER DE CÁMARA
function inicializarEscaner() {
    const contenedorCamara = document.getElementById('lector-camara');
    if (!contenedorCamara) return;

    const html5QrcodeScanner = new Html5QrcodeScanner(
        "lector-camara", { fps: 15, qrbox: { width: 250, height: 150 } }
    );
    html5QrcodeScanner.render(onScanSuccess);
}

// 4. ACCIÓN AL DETECTAR UN CÓDIGO POR CÁMARA
async function onScanSuccess(decodedText) {
    const contenedorCodigo = document.getElementById('codigo-detectado');
    if (contenedorCodigo) contenedorCodigo.textContent = decodedText;
    
    // Cambiado .single() por .maybeSingle() para evitar el error 406 en consola
    const { data: producto, error } = await window.supabaseClient
        .from('productos_maestro')
        .select('*')
        .eq('codigo_barras', decodedText)
        .maybeSingle();

    if (error) {
        console.error("Error al buscar producto:", error.message);
        return;
    }

    if (!producto) {
        // Si el código no existe en el catálogo maestro, abre el modal con el código listo
        abrirModalProducto(decodedText);
    } else {
        // Si ya existe, solicita la cantidad e indexa a la tabla
        let cantidad = parseInt(prompt(`¿Cuántas unidades de "${producto.nombre_producto}" ingresan?`, "1")) || 1;
        agregarAFormularioTemporal(producto, cantidad);
    }
}

// 5. CONTROL DE LA INTERFAZ FLOTANTE (MODAL MANUAL)
function configurarEventosModal() {
    const btnAbrir = document.getElementById('btn-manual-abrir');
    const btnCancelar = document.getElementById('btn-modal-cancelar');
    const btnGuardar = document.getElementById('btn-modal-guardar');

    // Verificaciones preventivas para evitar errores si las ID no se encuentran en el HTML
    if (btnAbrir) btnAbrir.addEventListener('click', () => abrirModalProducto(''));
    if (btnCancelar) btnCancelar.addEventListener('click', cerrarModalProducto);
    if (btnGuardar) btnGuardar.addEventListener('click', procesarGuardadoModal);
}

function abrirModalProducto(codigo = '') {
    const mCodigo = document.getElementById('modal-codigo');
    const mNombre = document.getElementById('modal-nombre');
    const mCantidad = document.getElementById('modal-cantidad');
    const modal = document.getElementById('modal-producto');

    if (mCodigo) mCodigo.value = codigo;
    if (mNombre) mNombre.value = '';
    if (mCantidad) mCantidad.value = '1';
    if (modal) {
        modal.style.display = 'flex';
        if (mNombre) mNombre.focus();
    }
}

function cerrarModalProducto() {
    const modal = document.getElementById('modal-producto');
    if (modal) modal.style.display = 'none';
}

// 6. PROCESAR E INSERTAR DESDE EL MODAL MANUAL
async function procesarGuardadoModal() {
    const supabase = window.supabaseClient;
    let codigo = document.getElementById('modal-codigo')?.value.trim();
    const nombre = document.getElementById('modal-nombre')?.value.trim();
    const categoria = document.getElementById('modal-categoria')?.value;
    const cantidad = parseInt(document.getElementById('modal-cantidad')?.value) || 1;

    if (!nombre) return alert("El nombre del producto es obligatorio.");
    
    // Si es un ingreso manual puro sin etiqueta de barras, creamos un indicativo único
    if (!codigo) codigo = 'MAN-' + Date.now();

    // Comprobar si ya existe para mitigar duplicaciones manuales
    let { data: producto } = await supabase
        .from('productos_maestro')
        .select('*')
        .eq('codigo_barras', codigo)
        .maybeSingle();

    if (!producto) {
        // Registro en caliente en la base del catálogo general
        const { data: nuevoProd, error } = await supabase
            .from('productos_maestro')
            .insert([{ codigo_barras: codigo, nombre_producto: nombre, categoria: categoria }])
            .select()
            .maybeSingle();
        
        if (error) return alert("Error al registrar producto base: " + error.message);
        producto = nuevoProd;
    }

    agregarAFormularioTemporal(producto, cantidad);
    cerrarModalProducto();
}

// 7. INSERCIÓN VISUAL EN LA TABLA TEMPORAL
function agregarAFormularioTemporal(producto, cantidad) {
    productosDonados.push({
        producto_id: producto.id,
        nombre: producto.nombre_producto,
        categoria: producto.categoria,
        cantidad: cantidad
    });
    
    const cuerpoTabla = document.getElementById('lista-cuerpo');
    if (cuerpoTabla) {
        cuerpoTabla.innerHTML += `
            <tr>
                <td><strong>${producto.nombre_producto}</strong></td>
                <td><span class="badge badge-transito">${producto.categoria}</span></td>
                <td>${cantidad} u.</td>
            </tr>
        `;
    }
}

// 8. CONSOLIDACIÓN E INCREMENTO DE INVENTARIOS EN EMERGENCIAS
const btnGuardarDonacion = document.getElementById('btn-guardar-donacion');
if (btnGuardarDonacion) {
    btnGuardarDonacion.addEventListener('click', async () => {
        const supabase = window.supabaseClient;
        const centroId = document.getElementById('centro-receptor').value;
        const nombreDonante = document.getElementById('donante-nombre').value.trim() || "Anónimo";

        if (!centroId) return alert("Por favor, seleccione el centro receptor.");
        if (productosDonados.length === 0) return alert("No hay productos en la lista.");

        let donanteId = null;
        if (nombreDonante !== "Anónimo") {
            const { data: donanteExistente } = await supabase
                .from('donantes')
                .select('id')
                .eq('nombre_o_razon_social', nombreDonante)
                .maybeSingle();

            if (donanteExistente) {
                donanteId = donanteExistente.id;
            } else {
                const { data: nuevoDonante } = await supabase.from('donantes').insert([{
                    nombre_o_razon_social: nombreDonante,
                    tipo_donante: document.getElementById('donante-tipo').value,
                    telefono: document.getElementById('donante-telefono').value
                }]).select().maybeSingle();
                donanteId = nuevoDonante?.id;
            }
        }

        // Crear registro cabecera
        const { data: cabecera, error: errCab } = await supabase
            .from('donaciones_ingresos')
            .insert([{ centro_receptor_id: parseInt(centroId), donante_id: donanteId }])
            .select()
            .maybeSingle();

        if (errCab) return alert("Error al abrir manifiesto: " + errCab.message);

        // Desglose masivo utilizando llamadas RPC para proteger la concurrencia de stock
        for (const prod of productosDonados) {
            await supabase.from('detalle_donacion_ingreso').insert([{
                donacion_id: cabecera.id,
                producto_id: prod.producto_id,
                cantidad: prod.cantidad
            }]);

            await supabase.rpc('ingresar_o_sumar_stock', {
                p_centro_id: parseInt(centroId),
                p_producto_id: parseInt(prod.producto_id),
                p_cantidad: parseInt(prod.cantidad)
            });
        }

        alert("✓ Registro consolidado con éxito. El inventario físico ha sido actualizado.");
        location.reload();
    });
}