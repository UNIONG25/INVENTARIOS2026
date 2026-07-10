const sbClient = supabase.createClient('TU_URL', 'TU_KEY');

document.addEventListener('DOMContentLoaded', () => {
    // Configuración de listeners seguros
    document.getElementById('in-name').addEventListener('input', (e) => buscar(e.target.value, 'items', 'name', 'suggestions-items'));
    document.getElementById('in-entity').addEventListener('input', (e) => buscar(e.target.value, 'entities', 'name', 'suggestions-entities'));
    document.getElementById('btn-save').addEventListener('click', registrarMovimiento);
});

async function buscar(query, tabla, campo, containerId) {
    const container = document.getElementById(containerId);
    if (!query || query.length < 1) { container.style.display = 'none'; return; }
    
    const { data } = await sbClient.from(tabla).select(campo).ilike(campo, `%${query}%`).limit(5);
    
    if (!data || data.length === 0) { container.style.display = 'none'; return; }
    
    container.style.display = 'block';
    container.innerHTML = '';
    
    data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = item[campo];
        // Asignación segura del evento
        div.addEventListener('click', () => {
            const inputId = containerId === 'suggestions-items' ? 'in-name' : 'in-entity';
            document.getElementById(inputId).value = item[campo];
            container.style.display = 'none';
        });
        container.appendChild(div);
    });
}

async function registrarMovimiento() {
    const data = {
        p_item_name: document.getElementById('in-name').value,
        p_item_barcode: document.getElementById('in-barcode').value,
        p_entity_name: document.getElementById('in-entity').value,
        p_entity_type: 'donante', 
        p_quantity: parseInt(document.getElementById('in-qty').value),
        p_type: document.getElementById('in-type').value,
        p_center_id: '00000000-0000-0000-0000-000000000000', 
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_created_at: new Date().toISOString().split('T')[0]
    };

    // Lógica central para traslados con stock flotante
async function procesarTraslado(origenId, destinoId, items) {
    // 1. Iniciar el movimiento tipo despacho
    const { data: movement, error } = await sbClient
        .from('movements')
        .insert([{
            movement_type: 'despacho',
            source_center_id: origenId,
            destination_center_id: destinoId,
            status: 'en_transito'
        }])
        .select();

    if (error) throw error;

    // 2. Generar el tracking code y registrar la guía
    const trackingCode = "GUIA-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    await sbClient.from('shipments').insert([{
        tracking_code: trackingCode,
        movement_id: movement[0].id
    }]);

    // 3. Registrar los detalles (items)
    const details = items.map(item => ({
        movement_id: movement[0].id,
        item_id: item.id,
        quantity: item.qty
    }));
    await sbClient.from('movement_details').insert(details);

    return trackingCode;
}

// Lógica para confirmar recepción
async function confirmarRecepcion(trackingCode) {
    // 1. Buscar la guía y obtener el movement_id
    const { data: shipment } = await sbClient
        .from('shipments')
        .select('*, movements(*)')
        .eq('tracking_code', trackingCode)
        .single();

    if (!shipment || shipment.status === 'recibido') throw new Error("Guía inválida o ya recibida");

    // 2. Actualizar estado de movimiento a 'recibido'
    await sbClient.from('movements')
        .update({ status: 'recibido' })
        .eq('id', shipment.movement_id);

    // 3. Actualizar la guía
    await sbClient.from('shipments')
        .update({ status: 'recibido', arrival_date: new Date().toISOString() })
        .eq('tracking_code', trackingCode);

    return true; // Aquí dispararíamos la suma al stock del destino
}

    const { error } = await sbClient.rpc('register_movement', data);
    if (error) alert("Error: " + error.message);
    else alert("Registrado exitosamente");
}
