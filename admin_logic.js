// admin_logic.js

// 1. Crear usuario y asignarlo a un centro
async function adminCrearUsuario(username, password, centerId) {
    // Usamos la misma lógica de cifrado que ya existe en index.html
    const hashedPass = await sha256(password); 
    
    const { data, error } = await sbClient
        .from('users')
        .insert([{ 
            username: username, 
            password_hash: hashedPass, 
            role: 'operator', 
            center_id: centerId 
        }]);
    
    if (error) alert("Error al crear usuario: " + error.message);
    else alert("Usuario creado exitosamente");
}

// 2. Obtener reporte de stock (Llamada al RPC que crearemos)
async function adminObtenerStock() {
    const { data, error } = await sbClient.rpc('get_inventory_stock');
    if (error) {
        console.error("Error al obtener stock:", error);
        return;
    }
    return data; // Devuelve el array con [item_name, total_stock]
}

// admin_logic.js

// Función para obtener la fecha seleccionada o la actual
function obtenerFechaRegistro() {
    const fechaInput = document.getElementById('in-date').value;
    // Si el input está vacío, devuelve la fecha de hoy en formato YYYY-MM-DD
    return fechaInput || new Date().toISOString().split('T')[0];
}

// Nota: Ahora necesitamos actualizar tu función de registro en el archivo principal (index.html)
// para que tome esta fecha.
