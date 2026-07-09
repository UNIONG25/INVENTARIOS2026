// admin_logic.js

async function buscar(query, tabla, campo, containerId) {
    const container = document.getElementById(containerId);
    if (!query || query.length < 1) { 
        container.style.display = 'none'; 
        return; 
    }
    
    const { data, error } = await sbClient
        .from(tabla)
        .select(campo)
        .ilike(campo, `%${query}%`)
        .limit(5);

    if (error || !data || data.length === 0) { 
        container.style.display = 'none'; 
        return; 
    }
    
    container.style.display = 'block';
    container.innerHTML = ''; // Limpiar
    
    data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = item[campo];
        div.onclick = () => seleccionar(item[campo], containerId);
        container.appendChild(div);
    });
}

function seleccionar(valor, containerId) {
    if (containerId === 'suggestions-items') {
        document.getElementById('in-name').value = valor;
    } else if (containerId === 'suggestions-entities') {
        document.getElementById('in-entity').value = valor;
        // Si tienes la función de contacto, se llama aquí
    }
    document.getElementById(containerId).style.display = 'none';
}
