const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const { Parser } = require('json2csv');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Credenciales de administrador (en producción, usar variables de entorno y hash)
const ADMIN_CREDENTIALS = {
    username: 'Empresa',
    password: 'Empresa123'
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar sesiones
app.use(session({
    secret: 'employee-tracker-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Middleware para verificar autenticación de admin
function requireAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ error: 'No autorizado' });
    }
}

// ==================== RUTAS DE AUTENTICACIÓN ====================

// Login de administrador
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        req.session.isAdmin = true;
        req.session.username = username;
        res.json({
            success: true,
            message: 'Login exitoso',
            username: username
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Credenciales inválidas'
        });
    }
});

// Logout
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.status(500).json({ error: 'Error al cerrar sesión' });
        } else {
            res.json({ success: true, message: 'Sesión cerrada' });
        }
    });
});

// Verificar sesión
app.get('/api/admin/verify', (req, res) => {
    if (req.session && req.session.isAdmin) {
        res.json({
            authenticated: true,
            username: req.session.username
        });
    } else {
        res.json({ authenticated: false });
    }
});

// ==================== RUTAS DE EMPLEADOS ====================

// Obtener todos los empleados
app.get('/api/employees', (req, res) => {
    db.getAllEmployees((err, employees) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(employees);
        }
    });
});

// Obtener empleado por ID
app.get('/api/employees/:id', (req, res) => {
    db.getEmployeeById(req.params.id, (err, employee) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!employee) {
            res.status(404).json({ error: 'Empleado no encontrado' });
        } else {
            res.json(employee);
        }
    });
});

// Obtener empleado por Cédula (para login)
app.get('/api/employees/by-idcard/:idCard', (req, res) => {
    db.getEmployeeByIdCard(req.params.idCard, (err, employee) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!employee) {
            res.status(404).json({ error: 'Empleado no encontrado' });
        } else {
            res.json(employee);
        }
    });
});

// Agregar nuevo empleado (requiere autenticación)
app.post('/api/employees', requireAuth, (req, res) => {
    const { name, idCard } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }

    if (!idCard || idCard.trim() === '') {
        return res.status(400).json({ error: 'La cédula es requerida' });
    }

    db.addEmployee(name.trim(), idCard.trim(), (err, employeeId, wasReactivated) => {
        if (err) {
            res.status(400).json({ error: err.message });
        } else {
            const message = wasReactivated
                ? 'Empleado reactivado exitosamente'
                : 'Empleado agregado exitosamente';
            res.status(201).json({
                success: true,
                employeeId,
                wasReactivated: wasReactivated || false,
                message: message
            });
        }
    });
});

// Desactivar empleado (requiere autenticación)
app.delete('/api/employees/:id', requireAuth, (req, res) => {
    db.deactivateEmployee(req.params.id, (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({
                success: true,
                message: 'Empleado desactivado exitosamente'
            });
        }
    });
});

// Obtener estado del empleado
app.get('/api/employees/:id/status', (req, res) => {
    db.getEmployeeStatus(req.params.id, (err, status) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(status);
        }
    });
});

// ==================== RUTAS DE REGISTROS DE TIEMPO ====================

// Registrar entrada (clock-in)
app.post('/api/clock-in', (req, res) => {
    const { employeeId, latitude, longitude } = req.body;

    if (!employeeId) {
        return res.status(400).json({ error: 'ID de empleado requerido' });
    }

    db.clockIn(employeeId, latitude || null, longitude || null, (err, result) => {
        if (err) {
            res.status(400).json({ error: err.message });
        } else {
            res.status(201).json({
                success: true,
                recordId: result.id,
                message: result.message,
                isLate: result.isLate,
                timestamp: new Date().toISOString()
            });
        }
    });
});

// Registrar salida (clock-out)
app.post('/api/clock-out', (req, res) => {
    const { employeeId } = req.body;

    if (!employeeId) {
        return res.status(400).json({ error: 'ID de empleado requerido' });
    }

    db.clockOut(employeeId, (err, recordId) => {
        if (err) {
            res.status(400).json({ error: err.message });
        } else {
            res.status(200).json({
                success: true,
                recordId,
                message: 'Salida registrada exitosamente',
                timestamp: new Date().toISOString()
            });
        }
    });
});

// Iniciar almuerzo
app.post('/api/lunch-start', (req, res) => {
    const { employeeId } = req.body;

    if (!employeeId) {
        return res.status(400).json({ error: 'ID de empleado requerido' });
    }

    db.startLunch(employeeId, (err, recordId) => {
        if (err) {
            res.status(400).json({ error: err.message });
        } else {
            res.status(200).json({
                success: true,
                recordId,
                message: 'Almuerzo iniciado',
                timestamp: new Date().toISOString()
            });
        }
    });
});

// Terminar almuerzo
app.post('/api/lunch-end', (req, res) => {
    const { employeeId } = req.body;

    if (!employeeId) {
        return res.status(400).json({ error: 'ID de empleado requerido' });
    }

    db.endLunch(employeeId, (err, recordId) => {
        if (err) {
            res.status(400).json({ error: err.message });
        } else {
            res.status(200).json({
                success: true,
                recordId,
                message: 'Almuerzo terminado',
                timestamp: new Date().toISOString()
            });
        }
    });
});

// Obtener registros del día de un empleado
app.get('/api/employees/:id/today', (req, res) => {
    db.getTodayRecords(req.params.id, (err, records) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(records);
        }
    });
});

// Obtener registros con filtros (requiere autenticación)
app.get('/api/records', requireAuth, (req, res) => {
    const filters = {
        employeeId: req.query.employeeId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: req.query.limit ? parseInt(req.query.limit) : null
    };

    db.getRecords(filters, (err, records) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(records);
        }
    });
});

// Obtener estadísticas (requiere autenticación)
app.get('/api/statistics', requireAuth, (req, res) => {
    const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate
    };

    db.getStatistics(filters, (err, stats) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(stats);
        }
    });
});

// Eliminar registro individual (requiere autenticación)
app.delete('/api/records/:id', requireAuth, (req, res) => {
    const recordId = req.params.id;

    if (!recordId) {
        return res.status(400).json({ error: 'ID de registro requerido' });
    }

    db.deleteRecord(recordId, (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({
                success: true,
                message: 'Registro eliminado exitosamente'
            });
        }
    });
});

// Exportar registros a CSV (requiere autenticación)
app.get('/api/records/export', requireAuth, (req, res) => {
    const filters = {
        employeeId: req.query.employeeId,
        startDate: req.query.startDate,
        endDate: req.query.endDate
    };

    db.getRecords(filters, (err, records) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            try {
                // Formatear datos para CSV
                const formattedRecords = records.map(record => ({
                    'ID': record.id,
                    'Empleado': record.employee_name,
                    'Cédula': record.employee_id_card || 'N/A',
                    'Fecha': record.date,
                    'Entrada': record.clock_in ? new Date(record.clock_in).toLocaleString('es-ES') : '',
                    'Inicio Almuerzo': record.lunch_start ? new Date(record.lunch_start).toLocaleString('es-ES') : '',
                    'Fin Almuerzo': record.lunch_end ? new Date(record.lunch_end).toLocaleString('es-ES') : '',
                    'Salida': record.clock_out ? new Date(record.clock_out).toLocaleString('es-ES') : 'En curso',
                    'Horas Trabajadas': record.hours_worked ? record.hours_worked.toFixed(2) : 'N/A'
                }));

                const parser = new Parser();
                const csv = parser.parse(formattedRecords);

                // Configurar headers para descarga
                const filename = `registros_${filters.startDate || 'inicio'}_${filters.endDate || 'fin'}.csv`;
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

                // Agregar BOM para UTF-8 (para que Excel lo abra correctamente)
                const csvWithBOM = '\uFEFF' + csv;
                res.send(csvWithBOM);
            } catch (error) {
                console.error('CSV Export Error:', error);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Error generando CSV: ' + error.message });
                }
            }
        }
    });
});

// ==================== RUTAS DE PÁGINAS ====================

// Página principal (empleados)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Página de login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Página de admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// ==================== MANEJO DE ERRORES ====================

// Ruta no encontrada
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// ==================== INICIAR SERVIDOR ====================

const server = app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════');
    console.log('  🚀 Servidor de Registro de Empleados');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  ➜ Local:   http://localhost:${PORT}`);
    console.log(`  ➜ Admin:   http://localhost:${PORT}/login.html`);
    console.log('═══════════════════════════════════════════════════');
    console.log('  Credenciales de Admin:');
    console.log('  Usuario: admin');
    console.log('  Contraseña: admin123');
    console.log('═══════════════════════════════════════════════════');
});

// Manejo de cierre graceful
process.on('SIGINT', () => {
    console.log('\n\n🛑 Cerrando servidor...');
    server.close(() => {
        console.log('✓ Servidor cerrado');
        db.closeDatabase();
        process.exit(0);
    });
});

module.exports = app;
