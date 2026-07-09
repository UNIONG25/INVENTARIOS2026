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

    const { error } = await sbClient.rpc('register_movement', data);
    if (error) alert("Error: " + error.message);
    else alert("Registrado exitosamente");
}
