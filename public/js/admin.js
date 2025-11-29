// ==================== VARIABLES GLOBALES ====================
let currentFilters = {
    employeeId: '',
    startDate: '',
    endDate: ''
};

let employeeToDeleteId = null;
let recordToDeleteId = null;
let charts = {}; // Almacenar instancias de gráficos

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', async () => {
    await verifyAuthentication();
    setupEventListeners();
    setDefaultDates();

    // Cargar pestaña inicial
    switchTab('dashboard');
});

// ==================== VERIFICAR AUTENTICACIÓN ====================
async function verifyAuthentication() {
    try {
        const response = await fetch('/api/admin/verify');
        const data = await response.json();

        if (!data.authenticated) {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Error verificando autenticación:', error);
        window.location.href = '/login.html';
    }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Navegación por Pestañas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Filtros (Registros)
    document.getElementById('applyFiltersBtn').addEventListener('click', applyFilters);
    document.querySelectorAll('.quick-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleQuickFilter(e.target.dataset.filter));
    });
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);

    // Gestión de Empleados
    document.getElementById('refreshEmployeesBtn').addEventListener('click', loadEmployeesTable);
    document.getElementById('addEmployeeBtn').addEventListener('click', openAddEmployeeModal);
    document.getElementById('closeModalBtn').addEventListener('click', closeAddEmployeeModal);
    document.getElementById('cancelAddBtn').addEventListener('click', closeAddEmployeeModal);
    document.getElementById('addEmployeeForm').addEventListener('submit', handleAddEmployee);

    // Configuración
    document.getElementById('settingsForm').addEventListener('submit', saveSettings);

    // Reportes
    document.getElementById('refreshReportsBtn').addEventListener('click', loadOvertimeReport);

    // Modales
    setupModalListeners();
}

function setupModalListeners() {
    // Modal Agregar Empleado
    document.getElementById('addEmployeeModal').addEventListener('click', (e) => {
        if (e.target.id === 'addEmployeeModal') closeAddEmployeeModal();
    });

    // Modal Eliminar Empleado
    document.getElementById('closeDeleteModalBtn').addEventListener('click', closeDeleteModal);
    document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDeleteEmployee);
    document.getElementById('deleteConfirmModal').addEventListener('click', (e) => {
        if (e.target.id === 'deleteConfirmModal') closeDeleteModal();
    });

    // Modal Eliminar Registro
    document.getElementById('closeDeleteRecordModalBtn').addEventListener('click', closeDeleteRecordModal);
    document.getElementById('cancelDeleteRecordBtn').addEventListener('click', closeDeleteRecordModal);
    document.getElementById('confirmDeleteRecordBtn').addEventListener('click', confirmDeleteRecord);
    document.getElementById('deleteRecordModal').addEventListener('click', (e) => {
        if (e.target.id === 'deleteRecordModal') closeDeleteRecordModal();
    });
}

// ==================== NAVEGACIÓN (TABS) ====================
async function switchTab(tabId) {
    // Actualizar botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Actualizar contenido
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabId}-section`);
    });

    // Cargar datos según la pestaña
    switch (tabId) {
        case 'dashboard':
            await loadDashboard();
            break;
        case 'records':
            await loadEmployees(); // Para el filtro
            await loadRecords();
            break;
        case 'reports':
            await loadOvertimeReport();
            break;
        case 'employees':
            await loadEmployeesTable();
            break;
        case 'settings':
            await loadSettings();
            break;
    }
}

// ==================== DASHBOARD ====================
async function loadDashboard() {
    await loadStatistics();
    await renderCharts();
}

async function renderCharts() {
    try {
        if (typeof Chart === 'undefined') {
            console.error('Chart.js no está cargado');
            showAlert('Error: Chart.js no se cargó correctamente', 'error');
            return;
        }

        // Obtener registros de la semana para gráficos
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);

        const params = new URLSearchParams({
            startDate: formatDateInput(lastWeek),
            endDate: formatDateInput(today)
        });

        const recordsRes = await fetch(`/api/records?${params}`);
        if (!recordsRes.ok) throw new Error('Error al obtener registros para gráficos');

        const records = await recordsRes.json();
        console.log('Registros para gráficos:', records.length);

        if (records.length === 0) {
            // Mostrar gráfico vacío o mensaje
            console.log('No hay registros para mostrar en gráficos');
        }

        renderWeeklyChart(records);
        renderPunctualityChart(records);
        renderEmployeeChart(records);

    } catch (error) {
        console.error('Error cargando gráficos:', error);
        showAlert('Error cargando gráficos: ' + error.message, 'error');
    }
}

function renderWeeklyChart(records) {
    const ctx = document.getElementById('weeklyChart').getContext('2d');

    // Agrupar por día
    const days = {};
    const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    records.forEach(r => {
        const date = new Date(r.date);
        const dayName = weekDays[date.getDay()];
        if (!days[dayName]) days[dayName] = 0;
        days[dayName]++;
    });

    const labels = Object.keys(days);
    const data = Object.values(days);

    if (charts.weekly) charts.weekly.destroy();

    charts.weekly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Asistencias',
                data: data,
                backgroundColor: 'rgba(99, 102, 241, 0.5)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
}

function renderPunctualityChart(records) {
    const ctx = document.getElementById('punctualityChart').getContext('2d');

    let onTime = 0;
    let late = 0;

    records.forEach(r => {
        if (r.is_late) late++;
        else onTime++;
    });

    if (charts.punctuality) charts.punctuality.destroy();

    charts.punctuality = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['A Tiempo', 'Tarde'],
            datasets: [{
                data: [onTime, late],
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function renderEmployeeChart(records) {
    const ctx = document.getElementById('employeeChart').getContext('2d');

    // Agrupar horas por empleado
    const employeeHours = {};

    records.forEach(r => {
        if (r.hours_worked) {
            if (!employeeHours[r.employee_name]) {
                employeeHours[r.employee_name] = 0;
            }
            employeeHours[r.employee_name] += r.hours_worked;
        }
    });

    const labels = Object.keys(employeeHours);
    const data = Object.values(employeeHours).map(h => h.toFixed(2));

    // Generar colores únicos para cada empleado
    const backgroundColors = labels.map(() => `hsla(${Math.random() * 360}, 70%, 50%, 0.6)`);
    const borderColors = backgroundColors.map(color => color.replace('0.6', '1'));

    if (charts.employee) charts.employee.destroy();

    charts.employee = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Horas Trabajadas',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y', // Gráfico horizontal para mejor lectura de nombres
            scales: {
                x: { beginAtZero: true, title: { display: true, text: 'Horas' } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.raw + ' horas';
                        }
                    }
                }
            }
        }
    });
}

// ==================== CONFIGURACIÓN ====================
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        if (!response.ok) throw new Error('Error cargando configuración');

        const settings = await response.json();

        document.getElementById('settingWorkStartTime').value = settings.work_start_time || '09:00';
        document.getElementById('settingDailyHours').value = settings.daily_work_hours || 8;
        document.getElementById('settingOvertimeRate').value = settings.overtime_rate || 0;

    } catch (error) {
        console.error('Error:', error);
        showAlert('Error al cargar configuración', 'error');
    }
}

async function saveSettings(e) {
    e.preventDefault();

    const settings = {
        work_start_time: document.getElementById('settingWorkStartTime').value,
        daily_work_hours: document.getElementById('settingDailyHours').value,
        overtime_rate: document.getElementById('settingOvertimeRate').value
    };

    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        if (!response.ok) throw new Error('Error guardando configuración');

        showAlert('✅ Configuración guardada exitosamente', 'success');

    } catch (error) {
        console.error('Error:', error);
        showAlert('❌ Error al guardar configuración', 'error');
    }
}

// ==================== REPORTES (HORAS EXTRAS) ====================
async function loadOvertimeReport() {
    const tbody = document.getElementById('overtimeTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><div class="spinner"></div></td></tr>';

    try {
        // Usar filtros actuales o por defecto (mes actual)
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

        const params = new URLSearchParams({
            startDate: formatDateInput(firstDay),
            endDate: formatDateInput(today)
        });

        const response = await fetch(`/api/reports/overtime?${params}`);
        if (!response.ok) throw new Error('Error cargando reporte');

        const report = await response.json();

        if (report.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay horas extras registradas en este período</td></tr>';
            return;
        }

        tbody.innerHTML = report.map(row => `
            <tr>
                <td>${formatDate(row.date)}</td>
                <td><strong>${row.employee_name}</strong></td>
                <td>${row.hours_worked.toFixed(2)} h</td>
                <td>${row.daily_limit} h</td>
                <td class="text-error font-bold">+${row.overtime_hours.toFixed(2)} h</td>
                <td class="text-success font-bold">$${row.overtime_pay.toFixed(2)}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-error">Error al cargar datos</td></tr>';
    }
}

// ==================== FUNCIONES EXISTENTES (ADAPTADAS) ====================

// ... (Mantener funciones de Logout, Cargar Empleados, Estadísticas, Registros, Filtros, Exportar, Modales)
// Solo mostraré las modificaciones clave en displayRecords y loadStatistics

async function loadStatistics() {
    try {
        const params = new URLSearchParams();
        if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
        if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);

        const response = await fetch(`/api/statistics?${params}`);
        if (!response.ok) throw new Error('Error al cargar estadísticas');

        const stats = await response.json();

        // Actualizar UI
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setVal('statEmployees', stats.total_employees || 0);
        setVal('statRecords', stats.total_records || 0);
        setVal('statHours', (stats.total_hours || 0).toFixed(1));
        setVal('statAverage', (stats.avg_hours || 0).toFixed(1));

    } catch (error) {
        console.error('Error:', error);
    }
}

async function loadRecords() {
    try {
        const params = new URLSearchParams();
        if (currentFilters.employeeId) params.append('employeeId', currentFilters.employeeId);
        if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
        if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);

        const response = await fetch(`/api/records?${params}`);
        if (!response.ok) throw new Error('Error al cargar registros');

        const records = await response.json();
        displayRecords(records);

    } catch (error) {
        console.error('Error:', error);
        showAlert('Error al cargar registros', 'error');
    }
}

function displayRecords(records) {
    const tbody = document.getElementById('recordsTableBody');

    if (records.length === 0) {
        tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <h3>No hay registros</h3>
            <p>No se encontraron registros con los filtros seleccionados</p>
          </div>
        </td>
      </tr>
    `;
        return;
    }

    tbody.innerHTML = records.map(record => {
        const clockIn = new Date(record.clock_in);
        const clockOut = record.clock_out ? new Date(record.clock_out) : null;
        const isActive = !clockOut;
        const location = formatLocation(record.latitude, record.longitude);

        // Calcular tiempo de almuerzo
        let lunchDisplay = '-';
        if (record.lunch_start) {
            const lunchStart = new Date(record.lunch_start);
            const lunchEnd = record.lunch_end ? new Date(record.lunch_end) : null;

            if (lunchEnd) {
                const durationMs = lunchEnd - lunchStart;
                const minutes = Math.floor(durationMs / 60000);
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                lunchDisplay = `${hours}h ${mins}m`;
            } else {
                lunchDisplay = '<span class="badge badge-warning">En curso</span>';
            }
        }

        // Indicador de tarde
        const lateBadge = record.is_late
            ? '<span class="badge badge-error" title="Llegada Tarde">⏰ Tarde</span>'
            : '';

        return `
      <tr>
        <td>${record.id}</td>
        <td><strong>${record.employee_name}</strong></td>
        <td>${formatDate(record.date)}</td>
        <td>
            ${formatDateTime(clockIn)}
            ${lateBadge}
        </td>
        <td>${clockOut ? formatDateTime(clockOut) : '<span class="badge badge-warning">En curso</span>'}</td>
        <td>${lunchDisplay}</td>
        <td>${record.hours_worked ? record.hours_worked.toFixed(2) + ' h' : '-'}</td>
        <td>${location}</td>
        <td>
          ${isActive
                ? '<span class="badge badge-success">Activo</span>'
                : '<span class="badge badge-info">Completado</span>'
            }
        </td>
        <td>
            <button class="delete-btn" onclick="openDeleteRecordModal(${record.id})">🗑️</button>
        </td>
      </tr>
    `;
    }).join('');
}

// ... (Resto de funciones auxiliares: loadEmployees, handleLogout, exportToCSV, modales, utilidades)
// Copiaré las funciones auxiliares necesarias para que el archivo esté completo y funcional.

async function handleLogout() {
    try {
        const response = await fetch('/api/admin/logout', { method: 'POST' });
        if (response.ok) {
            showAlert('Sesión cerrada exitosamente', 'success');
            setTimeout(() => window.location.href = '/login.html', 1000);
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error al cerrar sesión', 'error');
    }
}

async function loadEmployees() {
    try {
        const response = await fetch('/api/employees');
        if (!response.ok) throw new Error('Error al cargar empleados');
        const employees = await response.json();
        const select = document.getElementById('filterEmployee');
        if (select) {
            select.innerHTML = '<option value="">Todos los empleados</option>';
            employees.forEach(employee => {
                const option = document.createElement('option');
                option.value = employee.id;
                option.textContent = employee.name;
                select.appendChild(option);
            });
        }
        return employees;
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

function setDefaultDates() {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startInput = document.getElementById('filterStartDate');
    const endInput = document.getElementById('filterEndDate');

    if (startInput) startInput.value = formatDateInput(firstDayOfMonth);
    if (endInput) endInput.value = formatDateInput(today);

    currentFilters.startDate = formatDateInput(firstDayOfMonth);
    currentFilters.endDate = formatDateInput(today);
}

function applyFilters() {
    currentFilters.employeeId = document.getElementById('filterEmployee').value;
    currentFilters.startDate = document.getElementById('filterStartDate').value;
    currentFilters.endDate = document.getElementById('filterEndDate').value;

    document.querySelectorAll('.quick-filter-btn').forEach(btn => btn.classList.remove('active'));
    loadRecords();
}

function handleQuickFilter(filter) {
    const today = new Date();
    let startDate, endDate;

    document.querySelectorAll('.quick-filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) btn.classList.add('active');
    });

    switch (filter) {
        case 'today':
            startDate = today;
            endDate = today;
            break;
        case 'week':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - today.getDay());
            endDate = today;
            break;
        case 'month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = today;
            break;
        case 'all':
        default:
            startDate = null;
            endDate = null;
            break;
    }

    const startInput = document.getElementById('filterStartDate');
    const endInput = document.getElementById('filterEndDate');
    const empInput = document.getElementById('filterEmployee');

    if (startInput) startInput.value = startDate ? formatDateInput(startDate) : '';
    if (endInput) endInput.value = endDate ? formatDateInput(endDate) : '';
    if (empInput) empInput.value = '';

    currentFilters.employeeId = '';
    currentFilters.startDate = startDate ? formatDateInput(startDate) : '';
    currentFilters.endDate = endDate ? formatDateInput(endDate) : '';

    loadRecords();
}

async function exportToCSV() {
    try {
        const params = new URLSearchParams();
        if (currentFilters.employeeId) params.append('employeeId', currentFilters.employeeId);
        if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
        if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);

        const response = await fetch(`/api/records/export?${params}`);
        if (!response.ok) throw new Error('Error al exportar');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `registros_${currentFilters.startDate || 'inicio'}_${currentFilters.endDate || 'fin'}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showAlert('✅ Archivo CSV descargado exitosamente', 'success');
    } catch (error) {
        console.error('Error:', error);
        showAlert('❌ Error al exportar registros', 'error');
    }
}

// ==================== GESTIÓN DE EMPLEADOS ====================
async function loadEmployeesTable() {
    try {
        const response = await fetch('/api/employees');
        if (!response.ok) throw new Error('Error al cargar empleados');
        const employees = await response.json();
        displayEmployeesTable(employees);
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error al cargar tabla de empleados', 'error');
    }
}

function displayEmployeesTable(employees) {
    const tbody = document.getElementById('employeesTableBody');
    if (!tbody) return;

    if (employees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><h3>No hay empleados</h3></div></td></tr>`;
        return;
    }

    tbody.innerHTML = employees.map(employee => `
        <tr class="employee-row">
            <td>${employee.id}</td>
            <td><strong>${employee.name}</strong></td>
            <td><code>${employee.id_card || 'N/A'}</code></td>
            <td>${formatDateTime(new Date(employee.created_at))}</td>
            <td>${employee.active ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-error">Inactivo</span>'}</td>
            <td>${employee.active ? `<button class="delete-btn" onclick="openDeleteModal(${employee.id}, '${employee.name.replace(/'/g, "\\'")}')">🗑️ Eliminar</button>` : '<span class="text-muted">Eliminado</span>'}</td>
        </tr>
    `).join('');
}

function openAddEmployeeModal() {
    document.getElementById('addEmployeeModal').classList.add('active');
    document.getElementById('employeeName').focus();
}

function closeAddEmployeeModal() {
    document.getElementById('addEmployeeModal').classList.remove('active');
    document.getElementById('addEmployeeForm').reset();
}

async function handleAddEmployee(e) {
    e.preventDefault();
    const name = document.getElementById('employeeName').value.trim();
    const idCard = document.getElementById('employeeIdCard').value.trim();

    if (!name || !idCard) {
        showAlert('Por favor, completa todos los campos', 'error');
        return;
    }

    try {
        const response = await fetch('/api/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, idCard })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al agregar empleado');
        }

        const result = await response.json();
        showAlert(`✅ ${result.message}`, 'success');
        await loadEmployeesTable();
        closeAddEmployeeModal();
    } catch (error) {
        console.error('Error:', error);
        showAlert(`❌ ${error.message}`, 'error');
    }
}

// ==================== ELIMINACIÓN ====================
function openDeleteModal(employeeId, employeeName) {
    employeeToDeleteId = employeeId;
    const el = document.getElementById('employeeToDelete');
    if (el) el.textContent = employeeName;
    document.getElementById('deleteConfirmModal').classList.add('active');
}

function closeDeleteModal() {
    employeeToDeleteId = null;
    document.getElementById('deleteConfirmModal').classList.remove('active');
}

async function confirmDeleteEmployee() {
    if (!employeeToDeleteId) return;
    try {
        const response = await fetch(`/api/employees/${employeeToDeleteId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Error al eliminar empleado');
        showAlert('✅ Empleado eliminado', 'success');
        await loadEmployeesTable();
        closeDeleteModal();
    } catch (error) {
        console.error('Error:', error);
        showAlert('❌ Error al eliminar empleado', 'error');
    }
}

function openDeleteRecordModal(recordId) {
    recordToDeleteId = recordId;
    document.getElementById('deleteRecordModal').classList.add('active');
}

function closeDeleteRecordModal() {
    recordToDeleteId = null;
    document.getElementById('deleteRecordModal').classList.remove('active');
}

async function confirmDeleteRecord() {
    if (!recordToDeleteId) return;
    try {
        const response = await fetch(`/api/records/${recordToDeleteId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Error al eliminar registro');
        showAlert('✅ Registro eliminado', 'success');
        await loadRecords();
        closeDeleteRecordModal();
    } catch (error) {
        console.error('Error:', error);
        showAlert('❌ Error al eliminar registro', 'error');
    }
}

// ==================== UTILIDADES ====================
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(date) {
    return date.toLocaleString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatLocation(lat, lon) {
    if (!lat || !lon) return '<span class="text-muted">-</span>';
    return `<a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" title="Ver en mapa">📍 Ver</a>`;
}

function showAlert(message, type = 'info') {
    const container = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    container.appendChild(alert);
    setTimeout(() => {
        alert.style.opacity = '0';
        alert.style.transform = 'translateX(400px)';
        setTimeout(() => alert.remove(), 300);
    }, 5000);
}
