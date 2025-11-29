# GUÍA DE DESPLIEGUE EN RAILWAY 🚂

Railway es una excelente opción porque detecta automáticamente que es una aplicación Node.js.

## PASO 1: Preparar tu código en GitHub
Railway funciona mejor cuando conectas tu repositorio de GitHub.

1.  Asegúrate de que tu carpeta `employee-tracker` esté subida a un repositorio en GitHub.
    *   Si aún no lo has hecho, crea un repositorio nuevo y sube los archivos.

## PASO 2: Crear el proyecto en Railway
1.  Ve a [railway.app](https://railway.app/) y regístrate (puedes usar tu cuenta de GitHub).
2.  Haz clic en **"New Project"** (Nuevo Proyecto).
3.  Selecciona **"Deploy from GitHub repo"**.
4.  Elige tu repositorio de la lista.

## PASO 3: Configuración Automática (¡NUEVO!) ✨
He añadido un archivo llamado `railway.json` a tu proyecto. Este archivo le dice a Railway automáticamente dónde está tu código.

1.  **Sube los cambios a GitHub:**
    *   Asegúrate de subir el nuevo archivo `railway.json` que acabo de crear.
2.  **Railway detectará el cambio:**
    *   Al subir este archivo, Railway debería detectar automáticamente que debe buscar en la carpeta `/server`.
    *   Si el despliegue falla la primera vez, ve a "Settings" y busca si ya se puso `/server` en "Root Directory". Si no, espera unos minutos a que lea el archivo.

## PASO 4: Variables de Entorno (Opcional)
Tu aplicación usa un puerto por defecto, pero Railway asignará uno automáticamente en la variable `PORT`. Tu código ya está listo para esto:
`const PORT = process.env.PORT || 3000;`
Así que **no necesitas configurar nada extra** para el puerto.

## PASO 5: Verificar
1.  Ve a la pestaña **"Deployments"** y espera a que diga "Active" (en verde).
2.  Railway te generará una URL pública (dominio). Haz clic en ella para ver tu app funcionando.
    *   Si no ves una URL, ve a la pestaña **"Settings"** -> **"Networking"** y haz clic en "Generate Domain".

---

### Nota sobre la Base de Datos
Tu proyecto usa **SQLite** (`database.sqlite`).
*   **Importante:** En Railway (y la mayoría de nubes), el sistema de archivos es "efímero". Esto significa que si Railway reinicia tu servidor (algo que pasa a menudo), **los datos guardados en el archivo SQLite se podrían perder o resetear**.
*   **Solución recomendada para producción:** Para un proyecto serio, deberías usar una base de datos real como PostgreSQL o MySQL (Railway ofrece ambas gratis en el plan trial).
*   **Para pruebas:** SQLite funcionará, pero ten en cuenta la advertencia anterior.
