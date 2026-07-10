// js/modulos/donaciones.js

let productosDonados = []; // Array temporal para guardar lo escaneado en la sesión actual

// Inicializar la cámara al cargar la página
window.addEventListener('DOMContentLoaded', () => {
    const html5QrcodeScanner = new Html5QrcodeScanner(
        "lector-camara", { fps: 10, qrbox: 250 }
    );
    html5QrcodeScanner.render(onScanSuccess);
});

// Función que se ejecuta automáticamente cuando la cámara detecta un código de barras
async function onScanSuccess(decodedText, decodedResult) {
    document.getElementById('codigo-detectado').innerText = decodedText;
    
    // Buscar en la base de datos de Supabase si el código de barras existe
    const { data: producto, error } = await window.supabaseClient
        .from('productos_maestro')
        .select('*')
        .eq('codigo_barras', decodedText)
        .single();

    if (error && error.code === 'PGRST116') {
        // Código no registrado en el catálogo maestro
        let nombre = prompt("Código NUEVO detectado. Ingrese el nombre del producto:");
        let categoria = prompt("Ingrese la categoría (Alimentos, Medicamentos, Agua, Higiene):");
        
        if(nombre && categoria) {
            // Insertar el nuevo producto en el catálogo maestro
            const { data: nuevoProd, error: errIns } = await window.supabaseClient
                .from('productos_maestro')
                .insert([{ codigo_barras: decodedText, nombre_producto: nombre, categoria: categoria }])
                .select()
                .single();
            
            if(!errIns) agregarAFormularioTemporal(nuevoProd);
        }
    } else if (producto) {
        // El producto ya existe en el maestro
        agregarAFormularioTemporal(producto);
    }
}

function agregarAFormularioTemporal(producto) {
    let cantidad = parseInt(prompt(`¿Cuántas unidades de "${producto.nombre_producto}" ingresan?`, "1")) || 1;
    
    // Guardar en la lista en memoria
    productosDonados.push({
        producto_id: producto.id,
        nombre: producto.nombre_producto,
        categoria: producto.categoria,
        cantidad: cantidad
    });
    
    // Renderizar en la tabla HTML
    const cuerpoTabla = document.getElementById('lista-cuerpo');
    cuerpoTabla.innerHTML += `
        <tr>
            <td>${producto.nombre_producto}</td>
            <td>${producto.categoria}</td>
            <td>${cantidad}</td>
        </tr>
    `;
}

// Cargar centros de acopio en el selector al iniciar
window.addEventListener('DOMContentLoaded', async () => {
    const { data: centros } = await window.supabaseClient.from('centros_acopio').select('id, nombre');
    const selector = document.getElementById('centro-receptor');
    centros.forEach(c => {
        selector.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });
});

document.getElementById('btn-guardar-donacion').addEventListener('click', async () => {
    const supabase = window.supabaseClient;
    const centroId = document.getElementById('centro-receptor').value;
    const nombreDonante = document.getElementById('donante-nombre').value || "Anónimo";
    
    if (productosDonados.length === 0) return alert("No hay productos escaneados.");

    // 1. Registrar o buscar al donante
    let donanteId = null;
    if (nombreDonante !== "Anónimo") {
        const { data: donante } = await supabase.from('donantes').insert([{
            nombre_o_razon_social: nombreDonante,
            tipo_donante: document.getElementById('donante-tipo').value,
            telefono: document.getElementById('donante-telefono').value
        }]).select().single();
        donanteId = donante?.id;
    }

    // 2. Crear la cabecera de la donación
    const { data: donacionCabecera } = await supabase.from('donaciones_ingresos').insert([{
        centro_receptor_id: centroId,
        donante_id: donanteId
    }]).select().single();

    // 3. Insertar detalles e incrementar el inventario físico
    for (const prod of productosDonados) {
        await supabase.from('detalle_donacion_ingreso').insert([{
            donacion_id: donacionCabecera.id,
            producto_id: prod.producto_id,
            cantidad: prod.cantidad
        }]);

        // Upsert en el inventario: Si el producto ya existe en el centro, suma; si no, lo crea.
        // Usamos RPC (Remote Procedure Call) para evitar condiciones de carrera en emergencias
        await supabase.rpc('ingresar_o_sumar_stock', {
            p_centro_id: centroId,
            p_producto_id: prod.producto_id,
            p_cantidad: prod.cantidad
        });
    }

    alert("Donación procesada con éxito. Inventario actualizado.");
    location.reload(); // Limpiar pantalla
});