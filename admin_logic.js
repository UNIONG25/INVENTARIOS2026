// ============================================================
// 1. Configuración de Supabase
// ============================================================
const sbClient = supabase.createClient(
  'https://ajhubmxofzfdelxbgjjf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqaHVibXhvZnpmZGVseGJnampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MzEwOTIsImV4cCI6MjA5OTAwNzA5Mn0.19vQ77T-kjNIu3-VZYrBT8hOnhiJv...'
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
// Helpers para render seguro (evita XSS al no usar innerHTML con datos no confiables)
// ============================================================
function clearAndHide(element) {
  element.classList.add('hidden');
  element.innerHTML = '';
}

function renderRecepcionResultado(resultDiv, { success, message, codigo, origen, destino, productos }) {
  resultDiv.innerHTML = '';
  resultDiv.classList.remove('hidden');
  resultDiv.style.backgroundColor = success ? '#166534' : '#991b1b';

  const container = document.createElement('div');
  container.style.textAlign = 'center';

  const title = document.createElement('div');
  title.style.fontWeight = '700';
  title.style.marginBottom = '6px';
  title.textContent = success ? '✅ Guía recibida exitosamente' : '❌ Error';
  container.appendChild(title);

  const msg = document.createElement('div');
  msg.textContent = message || '';
  container.appendChild(msg);

  if (success) {
    const info = document.createElement('div');
    info.style.marginTop = '8px';
    info.textContent = `Código: ${codigo || 'N/A'} | Origen: ${origen || 'N/A'} | Destino: ${destino || 'N/A'} | Productos: ${productos ?? '0'}`;
    container.appendChild(info);
  }

  resultDiv.appendChild(container);
}

function renderResultadoGuia(resultDiv, { codigoGuia, origen, destino, productos }) {
  resultDiv.innerHTML = '';
  resultDiv.classList.remove('hidden');
  resultDiv.style.backgroundColor = '#166534'; // Verde

  const container = document.createElement('div');
  container.style.textAlign = 'left';

  const title = document.createElement('div');
  title.style.fontWeight = '700';
  title.style.marginBottom = '6px';
  title.textContent = '✅ Guía generada exitosamente';
  container.appendChild(title);

  const codeLine = document.createElement('div');
  codeLine.innerHTML = ''; // keep element for layout
  const strong = document.createElement('strong');
  strong.textContent = codigoGuia;
  codeLine.appendChild(document.createTextNode('Código: '));
  codeLine.appendChild(strong);
  container.appendChild(codeLine);

  const origenLine = document.createElement('div');
  origenLine.textContent = `Origen: ${origen || 'N/A'}`;
  container.appendChild(origenLine);

  const destinoLine = document.createElement('div');
  destinoLine.textContent = `Destino: ${destino || 'N/A'}`;
  container.appendChild(destinoLine);

  const productosLine = document.createElement('div');
  productosLine.textContent = `Productos: ${productos}`;
  container.appendChild(productosLine);

  resultDiv.appendChild(container);
}

// ============================================================
// 3. Función de Recepción (confirma una guía existente)
// ============================================================
async function ejecutarRecepcion() {
  const trackingCode = document.getElementById('in-tracking-code').value.trim().toUpperCase();
  const resultDiv = document.getElementById('recepcion-resultado');
  const btn = document.getElementById('btn-confirmar-recepcion');

  if (!trackingCode) {
    alert("Por favor, ingresa un código de guía válido.");
    return;
  }

  try {
    // UI: mostrar procesando y deshabilitar boton
    resultDiv.classList.remove('hidden');
    resultDiv.style.backgroundColor = "#854d0e"; // Amarillo
    resultDiv.textContent = "Procesando...";
    if (btn) btn.disabled = true;

    // Buscar el traslado por código de guía
    const { data, error } = await sbClient
      .from('traslados')
      .select('*')
      .eq('guia_code', trackingCode)
      .single();

    if (error || !data) {
      renderRecepcionResultado(resultDiv, { success: false, message: 'Guía no encontrada: ' + (error?.message || 'No existe este código') });
      if (btn) btn.disabled = false;
      return;
    }

    // Actualizar estado a 'recibido' y retornar la fila actualizada
    const { data: updated, error: updateError } = await sbClient
      .from('traslados')
      .update({ estado: 'recibido', fecha_recepcion: new Date().toISOString().split('T')[0] })
      .eq('guia_code', trackingCode)
      .select()
      .single();

    if (updateError) {
      renderRecepcionResultado(resultDiv, { success: false, message: 'Error al actualizar: ' + updateError.message });
      if (btn) btn.disabled = false;
      return;
    }

    // Contar items de forma segura
    const itemCount = Array.isArray(updated.items) ? updated.items.length : (Array.isArray(data.items) ? data.items.length : 0);

    // Mostrar resultado exitoso (render seguro)
    renderRecepcionResultado(resultDiv, {
      success: true,
      message: '',
      codigo: trackingCode,
      origen: updated.origen || data.origen,
      destino: updated.destino || data.destino,
      productos: itemCount
    });

    // Limpiar campo después de 3 segundos
    setTimeout(() => {
      document.getElementById('in-tracking-code').value = '';
      clearAndHide(resultDiv);
    }, 3000);

  } catch (error) {
    renderRecepcionResultado(resultDiv, { success: false, message: error.message || 'Error inesperado' });
  } finally {
    const btn = document.getElementById('btn-confirmar-recepcion');
    if (btn) btn.disabled = false;
  }
}

// ============================================================
// Función de ayuda: intenta insertar traslado con reintentos si hay conflicto de clave única
// ============================================================
async function insertarTrasladoConRetry(trasladoData, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    trasladoData.guia_code = generarCodigoGuia();
    const { data, error } = await sbClient.from('traslados').insert([trasladoData]).select();
    if (!error) return { data };
    // Detectar conflicto por clave única (puede variar según Postgres/Supabase)
    const msg = (error?.message || '').toLowerCase();
    const code = error?.code || '';
    if (!(/unique|duplicate|23505/.test(msg) || code === '23505')) {
      return { error };
    }
    // si fue conflicto, reintenta, continua loop
    console.warn('Conflicto en guia_code, reintentando... intento', i + 1);
  }
  return { error: new Error('No se pudo generar un código de guía único después de varios intentos.') };
}

// ============================================================
// 4. Función para procesar un traslado y generar código de guía
// ============================================================
async function procesarTraslado() {
  const origen = document.getElementById('in-origen-traslado').value.trim();
  const destino = document.getElementById('in-destino-traslado').value.trim();
  const itemsContainer = document.getElementById('traslados-items');
  const resultDiv = document.getElementById('resultado-guia');
  const btn = document.getElementById('btn-generar-guia');

  if (!origen || !destino) {
    alert("Debes ingresar el centro de origen y destino.");
    return;
  }

  // Recopilar items buscando filas estandarizadas .traslado-item-row
  const items = [];
  const rows = itemsContainer ? itemsContainer.querySelectorAll('.traslado-item-row') : [];

  rows.forEach(row => {
    try {
      const inputs = row.querySelectorAll('input');
      if (inputs.length < 2) return;

      const nombre = inputs[0].value.trim();
      const qtyStr = inputs[1].value.trim();
      const qty = parseInt(qtyStr, 10);

      // Validar que qty sea un número válido y positivo
      if (nombre && !isNaN(qty) && qty > 0) {
        items.push({ nombre, qty });
        console.log(`✓ Item agregado: ${nombre} (${qty} unidades)`);
      }
    } catch (e) {
      console.warn('Error procesando fila:', e);
    }
  });

  if (items.length === 0) {
    alert("Debes agregar al menos un producto con cantidad válida.");
    console.log("Estructura HTML detectada:", {
      trasladoItemRows: itemsContainer ? itemsContainer.querySelectorAll('.traslado-item-row').length : 0
    });
    return;
  }

  try {
    // UI: estado procesando
    resultDiv.classList.remove('hidden');
    resultDiv.style.backgroundColor = "#854d0e"; // Amarillo
    resultDiv.textContent = "Generando guía de traslado...";
    if (btn) btn.disabled = true;

    // Preparar datos para enviar a Supabase
    const trasladoData = {
      guia_code: '', // será asignado por insertarTrasladoConRetry
      origen: origen,
      destino: destino,
      items: items,
      fecha: new Date().toISOString().split('T')[0],
      estado: 'pendiente'
    };

    console.log("Datos a guardar:", trasladoData);

    // Intentar insertar con reintentos para evitar colisiones de guia_code
    const { data, error } = await insertarTrasladoConRetry(trasladoData, 5);
    if (error) {
      console.error("Error Supabase al insertar traslado:", error);
      throw error;
    }

    console.log("Traslado guardado en Supabase:", data);

    // data es un array con la fila insertada
    const saved = Array.isArray(data) ? data[0] : (data || {});
    const codigoGuia = saved.guia_code || trasladoData.guia_code;

    // Mostrar resultado exitoso (render seguro)
    renderResultadoGuia(resultDiv, { codigoGuia, origen, destino, productos: items.length });

    // Limpiar campos después de 3 segundos
    setTimeout(() => {
      document.getElementById('in-origen-traslado').value = '';
      document.getElementById('in-destino-traslado').value = '';
      if (itemsContainer) itemsContainer.innerHTML = '';
      clearAndHide(resultDiv);
    }, 3000);

  } catch (error) {
    console.error("Error al generar guía:", error);
    resultDiv.style.backgroundColor = "#991b1b";
    renderResultadoGuia(resultDiv, { codigoGuia: '', origen, destino, productos: items.length });
    resultDiv.textContent = "❌ Error al generar la guía: " + (error.message || String(error));
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ============================================================
// 5. Autocompletado (búsqueda de productos y entidades)
// ============================================================
async function buscar(query, tabla, campo, containerId, inputId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!query || query.length < 1) {
    container.style.display = 'none';
    return;
  }

  try {
    const { data, error } = await sbClient
      .from(tabla)
      .select(campo)
      .ilike(campo, `%${query}%`)
      .limit(5);

    if (error) {
      console.error("Error en búsqueda:", error);
      container.style.display = 'none';
      return;
    }

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
        const input = document.getElementById(inputId);
        if (input) input.value = item[campo];
        container.style.display = 'none';
      });
      container.appendChild(div);
    });
  } catch (e) {
    console.error("Error en función buscar:", e);
    container.style.display = 'none';
  }
}

// ============================================================
// 6. Registro de movimiento (entrada/despacho simple)
// ============================================================
async function registrarMovimiento() {
  const btn = document.getElementById('btn-save');
  try {
    const qtyRaw = document.getElementById('in-qty').value;
    const qty = parseInt(qtyRaw, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      alert('Ingrese una cantidad válida (> 0).');
      return;
    }

    const data = {
      p_item_name: document.getElementById('in-name').value.trim(),
      p_item_barcode: document.getElementById('in-barcode').value.trim(),
      p_entity_name: document.getElementById('in-entity').value.trim(),
      p_entity_type: 'donante',
      p_quantity: qty,
      p_type: document.getElementById('in-type').value,
      p_center_id: '00000000-0000-0000-0000-000000000000',
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_created_at: new Date().toISOString().split('T')[0]
    };

    if (btn) btn.disabled = true;

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
  } catch (e) {
    console.error('Error al registrar movimiento:', e);
    alert('Error inesperado al registrar movimiento.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ============================================================
// 7. Listeners (se conectan cuando el DOM está listo)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM Loaded - Inicializando listeners...");

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
    console.log("✓ Botón 'Generar guía' conectado");
  } else {
    console.warn("⚠ No se encontró el botón 'btn-generar-guia'");
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
