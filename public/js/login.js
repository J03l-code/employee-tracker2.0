// ==================== VERIFICAR SI YA ESTÁ AUTENTICADO ====================
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthentication();
    setupLoginForm();
});

async function checkAuthentication() {
    try {
        const response = await fetch('/api/admin/verify');
        const data = await response.json();

        if (data.authenticated) {
            // Ya está autenticado, redirigir al panel
            window.location.href = '/admin.html';
        }
    } catch (error) {
        console.error('Error verificando autenticación:', error);
    }
}

// ==================== CONFIGURAR FORMULARIO ====================
function setupLoginForm() {
    const form = document.getElementById('loginForm');
    form.addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const button = document.getElementById('loginButton');
    const buttonText = document.getElementById('loginButtonText');

    // Validación básica
    if (!username || !password) {
        showAlert('Por favor, completa todos los campos', 'error');
        return;
    }

    // Deshabilitar botón y mostrar loading
    button.disabled = true;
    buttonText.textContent = 'Verificando...';

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showAlert('✅ Login exitoso. Redirigiendo...', 'success');

            // Redirigir al panel después de un breve delay
            setTimeout(() => {
                window.location.href = '/admin.html';
            }, 1000);
        } else {
            throw new Error(data.error || 'Credenciales inválidas');
        }

    } catch (error) {
        console.error('Error:', error);
        showAlert(`❌ ${error.message}`, 'error');

        // Re-habilitar botón
        button.disabled = false;
        buttonText.textContent = 'Iniciar Sesión';

        // Limpiar contraseña
        document.getElementById('password').value = '';
        document.getElementById('password').focus();
    }
}

// ==================== UTILIDADES ====================
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
