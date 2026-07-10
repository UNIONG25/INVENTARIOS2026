// ============================================================
// 1. Configuración de Supabase
// ============================================================
const sbClient = supabase.createClient(
  'https://ajhubmxofzfdelxbgjjf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqaHVibXhvZnpmZGVseGJnampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MzEwOTIsImV4cCI6MjA5OTAwNzA5Mn0.19vQ77T-kjNIu3-VZYrBT8hOnhiJvYtv[...]
);

// ============================================================
// 2. Función para generar código de guía único
// ============================================================
function generarCodigoGuia() {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = 'GUIA-';
  for (let i = 0; i < 6; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return codigo;
}

// ============================================================
// 3. Función de Recepción (confirma una guía existente)
// ============================================================
async function ejecutarRecepcion() {
  const trackingCode = document.getElementById('in-tracking-code').value.trim().toUpperCase();
  const resultDiv = document.getElementById('recepcion-resultado');
  
  if (!trackingCode) {
    alert("Por favor, ingresa un código de guía válido.");
    return;
  }
  
  try {
    resultDiv.classList.remove('hidden');
    resultDiv.style.backgroundColor = "#854d0e"; // Amarillo
    resultDiv.textContent = "Procesando...";
  } catch (error) {
    resultDiv.style.backgroundColor = "#991b1b"; // Rojo
    resultDiv.textContent = "❌ Error: " + error.message;
  }
}

// ============================================================
// 4. Función para procesar un traslado y generar código de guía
// ============================================================
async function procesarTraslado() {
  const origen = document.getElementById('in-origen-traslado').value.trim();
  const destino = document.getElementById('in-destino-traslado').value.trim();
  const itemsContainer = document.getElementById('traslados-items');
  const rows = itemsContainer.querySelectorAll('.grid');
  const resultDiv = document.getElementById('resultado-guia');
  
  if (!origen || !destino) {
    alert("Debes ingresar el centro de origen y destino.");
    return;
  }
  
  // Recopilar items
  const items = [];
  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const nombre = inputs[0].value.trim();
    const qty = parseInt(inputs[1].value);
    if (nombre && qty > 0) {
      items.push({ nombre, qty });
    }
  });
  
  if (items.length === 0) {
    alert("Debes agregar al menos un producto con cantidad válida.");
    return;
  }
  
  try {
    resultDiv.classList.remove('hidden');
    resultDiv.style.backgroundColor = "#854d0e";
    resultDiv.textContent = "Generando guía de traslado...";
    
    // Generar código de guía
    const codigoGuia = generarCodigoGuia();
    
    // Preparar datos para enviar a Supabase
    const trasladoData = {
      guia_code: codigoGuia,
      origen: origen,
      destino: destino,
      items: items,
      fecha: new Date().toISOString().split('T')[0],
      estado: 'pendiente'
    };
    
    // Opcional: Enviar a Supabase si tienes una tabla para traslados
    // const { error } = await sbClient.from('traslados').insert([trasladoData]);
    // if (error) throw error;
    
    // Mostrar resultado exitoso
    resultDiv.style.backgroundColor = "#166534"; // Verde
    resultDiv.innerHTML = `
      ✅ <strong>Guía generada exitosamente</strong><br>
      Código: <strong>${codigoGuia}</strong><br>
      Origen: ${origen}<br>
      Destino: ${destino}<br>
      Productos: ${items.length}
    `;
    
    // Limpiar campos después de 3 segundos
    setTimeout(() => {
      document.getElementById('in-origen-traslado').value = '';
      document.getElementById('in-destino-traslado').value = '';
      itemsContainer.innerHTML = '';
      resultDiv.classList.add('hidden');
    }, 3000);
    
  } catch (error) {
    resultDiv.style.backgroundColor = "#991b1b";
    resultDiv.textContent = "❌ Error al generar la guía: " + error.message;
  }
}

// ============================================================
// 5. Autocompletado (búsqueda de productos y entidades)
// ============================================================
async function buscar(query, tabla, campo, containerId, inputId) {
  const container = document.getElementById(containerId);
  if (!query || query.length < 1) {
    container.style.display = 'none';
    return;
  }
  
  const { data } = await sbClient
    .from(tabla)
    .select(campo)
    .ilike(campo, `%${query}%`)
    .limit(5);
    
  if (!data || data.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  container.innerHTML = '';
  
  data.forEach(item => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = item[campo];
    div.addEventListener('click', () => {
      document.getElementById(inputId).value = item[campo];
      container.style.display = 'none';
    });
    container.appendChild(div);
  });
}

// ============================================================
// 6. Registro de movimiento (entrada/despacho simple)
// ============================================================
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
  if (error) {
    alert("Error: " + error.message);
  } else {
    alert("✅ Registrado exitosamente");
    document.getElementById('in-name').value = '';
    document.getElementById('in-barcode').value = '';
    document.getElementById('in-entity').value = '';
    document.getElementById('in-qty').value = '';
  }
}

// ============================================================
// 7. Listeners (se conectan cuando el DOM está listo)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Autocompletado de productos
  const inName = document.getElementById('in-name');
  if (inName) {
    inName.addEventListener('input', (e) =>
      buscar(e.target.value, 'items', 'name', 'suggestions-items', 'in-name')
    );
  }
  
  // Autocompletado de entidades
  const inEntity = document.getElementById('in-entity');
  if (inEntity) {
    inEntity.addEventListener('input', (e) =>
      buscar(e.target.value, 'entities', 'name', 'suggestions-entities', 'in-entity')
    );
  }
  
  // Botón guardar ingreso
  const btnSave = document.getElementById('btn-save');
  if (btnSave) {
    btnSave.addEventListener('click', registrarMovimiento);
  }
  
  // Botón confirmar recepción
  const btnRecepcion = document.getElementById('btn-confirmar-recepcion');
  if (btnRecepcion) {
    btnRecepcion.addEventListener('click', ejecutarRecepcion);
  }
  
  // Botón generar guía de traslado
  const btnGenerarGuia = document.getElementById('btn-generar-guia');
  if (btnGenerarGuia) {
    btnGenerarGuia.addEventListener('click', procesarTraslado);
  }
  
  // Cerrar sugerencias al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.relative')) {
      document.querySelectorAll('.suggestions-box').forEach(box => {
        box.style.display = 'none';
      });
    }
  });
});
