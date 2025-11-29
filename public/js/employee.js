// ==================== VARIABLES GLOBALES ====================
let currentEmployeeId = null;
let clockInterval = null;
let statusCheckInterval = null;

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeClock();
    setupEventListeners();
});

// ==================== RELOJ EN TIEMPO REAL ====================
function initializeClock() {
    updateClock();
    clockInterval = setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();

    // Actualizar hora
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('clock').textContent = `${hours}:${minutes}:${seconds}`;

    // Actualizar fecha
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    document.getElementById('date').textContent = now.toLocaleDateString('es-ES', options);
}

// ==================== CARGAR EMPLEADOS ====================
// Ya no necesitamos cargar lista de empleados para dropdown

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Input de cédula con debounce
    const idCardInput = document.getElementById('employeeIdCard');
    let debounceTimer;

    idCardInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const idCard = e.target.value.trim();

        // Limpiar estado si el campo está vacío
        if (!idCard) {
            deselectEmployee();
            return;
        }

        // Validar que solo sean números
        if (!/^\d+$/.test(idCard)) {
            return;
        }

        // Esperar a que el usuario termine de escribir
        debounceTimer = setTimeout(async () => {
            if (idCard.length >= 10) {
                await verifyEmployee(idCard);
            }
        }, 500);
    });

    // Botón de registro
    document.getElementById('clockButton').addEventListener('click', handleClockAction);

    // Botón de almuerzo
    document.getElementById('lunchButton').addEventListener('click', handleLunchAction);
}

// ==================== VERIFICAR EMPLEADO POR CÉDULA ====================
async function verifyEmployee(idCard) {
    try {
        const response = await fetch(`/api/employees/by-idcard/${idCard}`);

        if (!response.ok) {
            if (response.status === 404) {
                showAlert('❌ Cédula no encontrada. Contacta al administrador.', 'error');
                deselectEmployee();
            } else {
                throw new Error('Error al verificar cédula');
            }
            return;
        }

        const employee = await response.json();
        selectEmployee(employee);

    } catch (error) {
        console.error('Error:', error);
        showAlert('Error al verificar la cédula', 'error');
        deselectEmployee();
    }
}

// ==================== SELECCIÓN DE EMPLEADO ====================
async function selectEmployee(employee) {
    currentEmployeeId = employee.id;

    // Mostrar nombre del empleado
    document.getElementById('employeeName').textContent = employee.name;
    document.getElementById('employeeNameDisplay').style.display = 'block';

    // Mostrar contenido principal
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('welcomeMessage').style.display = 'none';

    // Cargar estado y datos
    await updateEmployeeStatus();
    await loadTodayHistory();

    // Iniciar verificación periódica del estado
    if (statusCheckInterval) clearInterval(statusCheckInterval);
    statusCheckInterval = setInterval(updateEmployeeStatus, 30000); // Cada 30 segundos
}

function deselectEmployee() {
    currentEmployeeId = null;

    // Ocultar nombre del empleado
    document.getElementById('employeeNameDisplay').style.display = 'none';

    // Ocultar contenido principal
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('welcomeMessage').style.display = 'block';

    // Detener verificación periódica
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
}

// ==================== ACTUALIZAR ESTADO ====================
async function updateEmployeeStatus() {
    if (!currentEmployeeId) return;

    try {
        const response = await fetch(`/api/employees/${currentEmployeeId}/status`);
        if (!response.ok) throw new Error('Error al obtener estado');

        const status = await response.json();
        updateStatusUI(status);

    } catch (error) {
        console.error('Error:', error);
    }
}

function updateStatusUI(status) {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const clockButton = document.getElementById('clockButton');
    const buttonText = document.getElementById('buttonText');
    const lunchButton = document.getElementById('lunchButton');
    const lunchButtonText = document.getElementById('lunchButtonText');

    if (status.isClockedIn) {
        if (status.isOnLunch) {
            // En almuerzo
            statusIndicator.className = 'status-indicator clocked-out'; // Visualmente como pausa
            statusText.textContent = 'En Almuerzo 🍽️';

            // Botón principal deshabilitado o oculto
            clockButton.style.display = 'none';

            // Botón de almuerzo para terminar
            lunchButton.style.display = 'block';
            lunchButton.className = 'btn btn-warning btn-lg clock-button';
            lunchButtonText.textContent = '⏹️ Terminar Almuerzo';
        } else {
            // Trabajando
            statusIndicator.className = 'status-indicator clocked-in';
            statusText.textContent = 'En servicio';

            // Botón principal para salir
            clockButton.style.display = 'block';
            clockButton.className = 'btn btn-error btn-lg clock-button';
            buttonText.textContent = '🚪 Registrar Salida';
            clockButton.disabled = false;

            // Botón de almuerzo disponible si no ha salido
            // Verificar si ya tomó almuerzo hoy (opcional, por ahora permitimos múltiples o asumimos uno)
            // Si lastRecord tiene lunch_start y lunch_end, ya tomó. 
            // Si lastRecord tiene lunch_start null, puede tomar.
            const lastRecord = status.lastRecord;
            if (lastRecord && !lastRecord.lunch_start) {
                lunchButton.style.display = 'block';
                lunchButton.className = 'btn btn-secondary btn-lg clock-button';
                lunchButtonText.textContent = '🍽️ Iniciar Almuerzo';
            } else {
                lunchButton.style.display = 'none'; // Ya tomó almuerzo
            }
        }
    } else {
        // Fuera de servicio
        statusIndicator.className = 'status-indicator clocked-out';
        statusText.textContent = 'Fuera de servicio';

        // Botón principal para entrar
        clockButton.style.display = 'block';
        clockButton.className = 'btn btn-success btn-lg clock-button';
        buttonText.textContent = '🚀 Registrar Entrada';
        clockButton.disabled = false;

        // Botón de almuerzo oculto
        lunchButton.style.display = 'none';
    }
}

// ==================== ACCIÓN DE ALMUERZO ====================
async function handleLunchAction() {
    if (!currentEmployeeId) return;

    const button = document.getElementById('lunchButton');
    button.disabled = true;

    try {
        // Obtener estado actual
        const statusResponse = await fetch(`/api/employees/${currentEmployeeId}/status`);
        const status = await statusResponse.json();

        // Determinar acción
        const endpoint = status.isOnLunch ? '/api/lunch-end' : '/api/lunch-start';

        // Obtener ubicación
        const location = await getGeolocation();

        // Realizar registro
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                employeeId: currentEmployeeId,
                latitude: location ? location.latitude : null,
                longitude: location ? location.longitude : null
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al registrar almuerzo');
        }

        const result = await response.json();
        showAlert(`✅ ${result.message}`, 'success');

        // Actualizar UI
        await updateEmployeeStatus();
        await loadTodayHistory();

    } catch (error) {
        console.error('Error:', error);
        showAlert(`❌ ${error.message}`, 'error');
    } finally {
        button.disabled = false;
    }
}

// ==================== ACCIÓN DE REGISTRO ====================
async function handleClockAction() {
    if (!currentEmployeeId) return;

    const button = document.getElementById('clockButton');
    button.disabled = true;

    try {
        // Obtener estado actual
        const statusResponse = await fetch(`/api/employees/${currentEmployeeId}/status`);
        const status = await statusResponse.json();

        // Determinar acción
        const endpoint = status.isClockedIn ? '/api/clock-out' : '/api/clock-in';
        const action = status.isClockedIn ? 'salida' : 'entrada';

        // Obtener ubicación
        const location = await getGeolocation();

        // Realizar registro
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                employeeId: currentEmployeeId,
                latitude: location ? location.latitude : null,
                longitude: location ? location.longitude : null
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al registrar');
        }

        const result = await response.json();

        // Mostrar mensaje de éxito
        showAlert(`✅ ${result.message}`, 'success');

        // Actualizar UI
        await updateEmployeeStatus();
        await loadTodayHistory();

    } catch (error) {
        console.error('Error:', error);
        showAlert(`❌ ${error.message}`, 'error');
        button.disabled = false;
    }
}

// ==================== CARGAR HISTORIAL DEL DÍA ====================
async function loadTodayHistory() {
    if (!currentEmployeeId) return;

    try {
        const response = await fetch(`/api/employees/${currentEmployeeId}/today`);
        if (!response.ok) throw new Error('Error al cargar historial');

        const records = await response.json();
        displayHistory(records);
        updateStats(records);

    } catch (error) {
        console.error('Error:', error);
    }
}

function displayHistory(records) {
    const container = document.getElementById('historyContainer');

    if (records.length === 0) {
        container.innerHTML = `
      <div class="welcome-message">
        <p class="text-muted">No hay registros para hoy</p>
      </div>
    `;
        return;
    }

    container.innerHTML = records.map(record => {
        const clockIn = new Date(record.clock_in);
        const clockOut = record.clock_out ? new Date(record.clock_out) : null;

        return `
      <div class="history-item">
        <div>
          <div class="history-time">
            🚀 ${formatTime(clockIn)}
          </div>
          <div class="history-label">Entrada</div>
        </div>
        <div style="text-align: right;">
          <div class="history-time">
            ${clockOut ? '🚪 ' + formatTime(clockOut) : '⏳ En curso'}
          </div>
          <div class="history-label">
            ${record.hours_worked ? `${record.hours_worked.toFixed(2)} horas` : 'Salida'}
          </div>
        </div>
      </div>
    `;
    }).join('');
}

function updateStats(records) {
    const totalEntries = records.length;
    const totalHours = records.reduce((sum, record) => {
        return sum + (record.hours_worked || 0);
    }, 0);

    document.getElementById('todayEntries').textContent = totalEntries;
    document.getElementById('todayHours').textContent = totalHours.toFixed(2);
}

// ==================== UTILIDADES ====================
function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function showAlert(message, type = 'info') {
    const container = document.getElementById('alertContainer');

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    container.appendChild(alert);

    // Auto-remover después de 5 segundos
    setTimeout(() => {
        alert.style.opacity = '0';
        alert.style.transform = 'translateX(400px)';
        setTimeout(() => alert.remove(), 300);
    }, 5000);
}

// Obtener geolocalización
function getGeolocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            resolve(null); // Geolocalización no soportada
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            (error) => {
                console.warn('Error obteniendo ubicación:', error.message);
                resolve(null); // Continuar sin ubicación si hay error o rechazo
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    });
}

// ==================== LIMPIEZA ====================
window.addEventListener('beforeunload', () => {
    if (clockInterval) clearInterval(clockInterval);
    if (statusCheckInterval) clearInterval(statusCheckInterval);
});
