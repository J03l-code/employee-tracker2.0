const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ruta de la base de datos
const DB_PATH = path.join(__dirname, '../database/timetracker.db');

// Crear conexión a la base de datos
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err.message);
    } else {
        console.log('✓ Conectado a la base de datos SQLite');
        initializeDatabase();
    }
});

// Inicializar tablas
function initializeDatabase() {
    db.serialize(() => {
        // Tabla de empleados
        db.run(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        id_card TEXT NOT NULL UNIQUE,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
            if (err) {
                console.error('Error creando tabla employees:', err.message);
            } else {
                console.log('✓ Tabla employees lista');
                // Insertar empleados de ejemplo si la tabla está vacía
                db.get('SELECT COUNT(*) as count FROM employees', (err, row) => {
                    if (!err && row.count === 0) {
                        const sampleEmployees = [
                            { name: 'Juan Pérez', id_card: '1234567890' },
                            { name: 'María García', id_card: '0987654321' },
                            { name: 'Carlos López', id_card: '1122334455' },
                            { name: 'Ana Martínez', id_card: '5544332211' },
                            { name: 'Luis Rodríguez', id_card: '9988776655' }
                        ];
                        const stmt = db.prepare('INSERT INTO employees (name, id_card) VALUES (?, ?)');
                        sampleEmployees.forEach(emp => stmt.run(emp.name, emp.id_card));
                        stmt.finalize();
                        console.log('✓ Empleados de ejemplo agregados');
                    }
                });
            }
        });

        // Tabla de registros de tiempo
        db.run(`
      CREATE TABLE IF NOT EXISTS time_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        clock_in DATETIME NOT NULL,
        clock_out DATETIME,
        lunch_start DATETIME,
        lunch_end DATETIME,
        date DATE NOT NULL,
        hours_worked REAL,
        latitude REAL,
        longitude REAL,
        is_late INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `, (err) => {
            if (err) {
                console.error('Error creando tabla time_records:', err.message);
            } else {
                console.log('✓ Tabla time_records lista');
                // Migraciones
                db.run("ALTER TABLE time_records ADD COLUMN lunch_start DATETIME", () => { });
                db.run("ALTER TABLE time_records ADD COLUMN lunch_end DATETIME", () => { });
                db.run("ALTER TABLE time_records ADD COLUMN latitude REAL", () => { });
                db.run("ALTER TABLE time_records ADD COLUMN longitude REAL", () => { });
                db.run("ALTER TABLE time_records ADD COLUMN is_late INTEGER DEFAULT 0", () => { });
            }
        });

        // Tabla de configuraciones
        db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL
      )
    `, (err) => {
            if (err) {
                console.error('Error creando tabla settings:', err.message);
            } else {
                console.log('✓ Tabla settings lista');
                // Insertar configuraciones por defecto
                const defaults = [
                    { key: 'work_start_time', value: '09:00' },
                    { key: 'daily_work_hours', value: '8' },
                    { key: 'overtime_rate', value: '5.00' }
                ];
                const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
                defaults.forEach(setting => stmt.run(setting.key, setting.value));
                stmt.finalize();
            }
        });

        // Crear índices para mejorar rendimiento
        db.run('CREATE INDEX IF NOT EXISTS idx_employee_id ON time_records(employee_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_date ON time_records(date)');
        db.run('CREATE INDEX IF NOT EXISTS idx_clock_in ON time_records(clock_in)');
    });
}

// ==================== FUNCIONES DE EMPLEADOS ====================

// Obtener todos los empleados activos
function getAllEmployees(callback) {
    db.all('SELECT * FROM employees WHERE active = 1 ORDER BY name', callback);
}

// Obtener empleado por ID
function getEmployeeById(id, callback) {
    db.get('SELECT * FROM employees WHERE id = ?', [id], callback);
}

// Agregar nuevo empleado o reactivar si existe inactivo
function addEmployee(name, idCard, callback) {
    // Primero verificar si existe un empleado con esa cédula
    db.get('SELECT * FROM employees WHERE id_card = ?', [idCard], (err, row) => {
        if (err) {
            callback(err);
        } else if (row) {
            // El empleado existe
            if (row.active === 0) {
                // Está inactivo, reactivarlo y actualizar nombre
                db.run('UPDATE employees SET active = 1, name = ? WHERE id = ?', [name, row.id], function (err) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, row.id, true); // true indica que fue reactivado
                    }
                });
            } else {
                // Ya está activo
                callback(new Error('Ya existe un empleado activo con esa cédula'));
            }
        } else {
            // No existe, crear nuevo
            db.run('INSERT INTO employees (name, id_card) VALUES (?, ?)', [name, idCard], function (err) {
                callback(err, this.lastID, false); // false indica que es nuevo
            });
        }
    });
}

// Obtener empleado por cédula
function getEmployeeByIdCard(idCard, callback) {
    db.get('SELECT * FROM employees WHERE id_card = ? AND active = 1', [idCard], callback);
}

// Desactivar empleado
function deactivateEmployee(id, callback) {
    db.run('UPDATE employees SET active = 0 WHERE id = ?', [id], callback);
}

// ==================== CONFIGURACIÓN ====================

function getSettings(callback) {
    db.all('SELECT key, value FROM settings', (err, rows) => {
        if (err) {
            callback(err, null);
            return;
        }
        const settings = {};
        rows.forEach(row => {
            settings[row.key] = row.value;
        });
        callback(null, settings);
    });
}

function updateSettings(settings, callback) {
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

        try {
            Object.keys(settings).forEach(key => {
                stmt.run(key, String(settings[key]));
            });
            stmt.finalize();
            db.run('COMMIT', (err) => {
                callback(err);
            });
        } catch (error) {
            db.run('ROLLBACK');
            callback(error);
        }
    });
}

// ==================== FUNCIONES DE REGISTROS ====================

// Registrar entrada (clock-in)
function clockIn(employeeId, latitude, longitude, callback) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Verificar si ya tiene entrada hoy
    db.get(
        'SELECT id FROM time_records WHERE employee_id = ? AND date = ? AND clock_out IS NULL',
        [employeeId, today],
        (err, row) => {
            if (err) return callback(err);
            if (row) return callback(new Error('Ya tienes un registro activo para hoy'));

            // Obtener configuración para verificar llegada tarde
            getSettings((err, settings) => {
                let isLate = 0;
                if (!err && settings && settings.work_start_time) {
                    const [workHour, workMinute] = settings.work_start_time.split(':').map(Number);
                    const workStartTime = new Date(now);
                    workStartTime.setHours(workHour, workMinute, 0, 0);

                    // Margen de tolerancia de 5 minutos
                    workStartTime.setMinutes(workStartTime.getMinutes() + 5);

                    if (now > workStartTime) {
                        isLate = 1;
                    }
                }

                const stmt = db.prepare(`
                    INSERT INTO time_records (employee_id, clock_in, date, latitude, longitude, is_late)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                stmt.run(employeeId, now.toISOString(), today, latitude, longitude, isLate, function (err) {
                    if (err) return callback(err);
                    callback(null, {
                        id: this.lastID,
                        message: isLate ? 'Entrada registrada (Llegada Tarde)' : 'Entrada registrada exitosamente',
                        isLate: !!isLate
                    });
                });
            });
        }
    );
}

// Iniciar almuerzo
function startLunch(employeeId, callback) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const lunchTime = now.toISOString();

    // Buscar registro activo sin almuerzo iniciado
    db.get(
        'SELECT * FROM time_records WHERE employee_id = ? AND date = ? AND clock_out IS NULL AND lunch_start IS NULL',
        [employeeId, dateStr],
        (err, row) => {
            if (err) {
                callback(err);
            } else if (!row) {
                callback(new Error('No se puede iniciar almuerzo: No hay turno activo o ya se tomó el almuerzo'));
            } else {
                db.run(
                    'UPDATE time_records SET lunch_start = ? WHERE id = ?',
                    [lunchTime, row.id],
                    function (err) {
                        callback(err, row.id);
                    }
                );
            }
        }
    );
}

// Terminar almuerzo
function endLunch(employeeId, callback) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const lunchTime = now.toISOString();

    // Buscar registro activo con almuerzo iniciado pero no terminado
    db.get(
        'SELECT * FROM time_records WHERE employee_id = ? AND date = ? AND clock_out IS NULL AND lunch_start IS NOT NULL AND lunch_end IS NULL',
        [employeeId, dateStr],
        (err, row) => {
            if (err) {
                callback(err);
            } else if (!row) {
                callback(new Error('No se puede terminar almuerzo: No hay almuerzo en curso'));
            } else {
                db.run(
                    'UPDATE time_records SET lunch_end = ? WHERE id = ?',
                    [lunchTime, row.id],
                    function (err) {
                        callback(err, row.id);
                    }
                );
            }
        }
    );
}

// Registrar salida (clock-out)
function clockOut(employeeId, callback) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const clockOutTime = now.toISOString();

    // Buscar el registro abierto más reciente
    db.get(
        'SELECT * FROM time_records WHERE employee_id = ? AND date = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
        [employeeId, dateStr],
        (err, row) => {
            if (err) {
                callback(err);
            } else if (!row) {
                callback(new Error('No hay registro de entrada abierto para este empleado'));
            } else {
                // Calcular horas trabajadas
                const clockInDate = new Date(row.clock_in);
                const clockOutDate = new Date(clockOutTime);
                const hoursWorked = (clockOutDate - clockInDate) / (1000 * 60 * 60); // Convertir a horas

                // Actualizar registro
                db.run(
                    'UPDATE time_records SET clock_out = ?, hours_worked = ? WHERE id = ?',
                    [clockOutTime, hoursWorked, row.id],
                    function (err) {
                        callback(err, row.id);
                    }
                );
            }
        }
    );
}

// Obtener estado actual del empleado
function getEmployeeStatus(employeeId, callback) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    db.get(
        'SELECT * FROM time_records WHERE employee_id = ? AND date = ? ORDER BY clock_in DESC LIMIT 1',
        [employeeId, dateStr],
        (err, row) => {
            if (err) {
                callback(err);
            } else {
                const isClockedIn = row && !row.clock_out;
                const isOnLunch = row && row.lunch_start && !row.lunch_end;

                callback(null, {
                    isClockedIn: !!isClockedIn,
                    isOnLunch: !!isOnLunch,
                    lastRecord: row
                });
            }
        }
    );
}

// Obtener registros con filtros
function getRecords(filters, callback) {
    let query = `
    SELECT 
      tr.*,
      e.name as employee_name,
      e.id_card as employee_id_card
    FROM time_records tr
    JOIN employees e ON tr.employee_id = e.id
    WHERE 1=1
  `;
    const params = [];

    // Filtro por empleado
    if (filters.employeeId) {
        query += ' AND tr.employee_id = ?';
        params.push(filters.employeeId);
    }

    // Filtro por fecha de inicio
    if (filters.startDate) {
        query += ' AND tr.date >= ?';
        params.push(filters.startDate);
    }

    // Filtro por fecha de fin
    if (filters.endDate) {
        query += ' AND tr.date <= ?';
        params.push(filters.endDate);
    }

    query += ' ORDER BY tr.clock_in DESC';

    // Límite de resultados
    if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
    }

    db.all(query, params, callback);
}

// Obtener registros del día actual de un empleado
function getTodayRecords(employeeId, callback) {
    const dateStr = new Date().toISOString().split('T')[0];

    db.all(
        `SELECT * FROM time_records 
     WHERE employee_id = ? AND date = ? 
     ORDER BY clock_in DESC`,
        [employeeId, dateStr],
        callback
    );
}

// Obtener estadísticas
function getStatistics(filters, callback) {
    let query = `
    SELECT 
      COUNT(DISTINCT employee_id) as total_employees,
      COUNT(*) as total_records,
      SUM(hours_worked) as total_hours,
      AVG(hours_worked) as avg_hours
    FROM time_records
    WHERE 1=1
  `;
    const params = [];

    if (filters.startDate) {
        query += ' AND date >= ?';
        params.push(filters.startDate);
    }

    if (filters.endDate) {
        query += ' AND date <= ?';
        params.push(filters.endDate);
    }

    db.get(query, params, callback);
}

// Eliminar registro individual
function deleteRecord(recordId, callback) {
    db.run('DELETE FROM time_records WHERE id = ?', [recordId], function (err) {
        if (err) {
            callback(err);
        } else if (this.changes === 0) {
            callback(new Error('Registro no encontrado'));
        } else {
            callback(null);
        }
    });
}

// Cerrar conexión (para cuando se apague el servidor)
function closeDatabase() {
    db.close((err) => {
        if (err) {
            console.error('Error cerrando la base de datos:', err.message);
        } else {
            console.log('✓ Conexión a la base de datos cerrada');
        }
    });
}

// Exportar funciones
module.exports = {
    db,
    getAllEmployees,
    getEmployeeById,
    getEmployeeByIdCard,
    addEmployee,
    deactivateEmployee,
    clockIn,
    clockOut,
    startLunch,
    endLunch,
    getEmployeeStatus,
    getRecords,
    getTodayRecords,
    getStatistics,
    deleteRecord,
    closeDatabase
};
