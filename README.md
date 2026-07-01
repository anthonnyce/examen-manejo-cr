# RutaCR — Examen teórico de manejo Costa Rica

Estructura del proyecto:

```
examen-manejo-cr/
├── frontend/          -> HTML/CSS/JS estático (página principal, registro, login)
└── backend/           -> API Node.js + Express + PostgreSQL
```

## 1. Base de datos PostgreSQL

Necesitás una base de datos PostgreSQL. Recomendación rápida y gratis: **Neon**
(https://neon.tech) o **Supabase** (https://supabase.com) — creás un proyecto,
copiás el "Connection string" y ya tenés `DATABASE_URL`.

Con esa URL a mano, corré el contenido de `backend/schema.sql` una vez, ya sea
desde el editor SQL de Neon/Supabase (pegás y ejecutás el archivo), o desde
`psql` si lo tenés instalado.

## 2. Backend (Windows / CMD)

```cmd
cd examen-manejo-cr\backend
copy .env.example .env
```

Abrí `.env` con Notepad y poné tu `DATABASE_URL` real y un `JWT_SECRET` largo.

Instalá dependencias y arrancá el servidor:

```cmd
npm install
npm start
```

Deberías ver: `RutaCR backend corriendo en http://localhost:3000`

Probalo abriendo en el navegador: http://localhost:3000/api/health

## 3. Frontend

El frontend es HTML puro, no necesita build. Para probarlo localmente lo más
fácil es abrir `frontend/index.html` directamente en el navegador, o servirlo
con la extensión "Live Server" de VS Code.

Si el backend corre en otra URL (por ejemplo cuando lo despliegues), actualizá
`frontend/js/config.js`:

```js
const API_URL = "https://tu-backend-desplegado.com";
```

## 4. Despliegue

- **Backend**: Postgres no corre en Cloudflare Workers de forma nativa. La
  opción más simple es desplegar este backend Node/Express en **Railway** o
  **Render** (ambos tienen plan gratuito, se conectan directo a tu repo de
  GitHub y detectan `npm start` automáticamente).
- **Frontend**: podés seguir usando Cloudflare Pages tal como con tus otros
  proyectos, subiendo la carpeta `frontend`.

## Rutas de la API

| Método | Ruta                        | Descripción                        |
|--------|-----------------------------|-------------------------------------|
| POST   | /api/auth/register          | Crea un usuario nuevo (incluye provincia) |
| POST   | /api/auth/login              | Inicia sesión, devuelve token       |
| POST   | /api/auth/forgot-password    | Genera un enlace de recuperación    |
| POST   | /api/auth/reset-password     | Guarda la nueva contraseña con el token |
| GET    | /api/health                  | Verifica que el servidor esté vivo  |

`register` y `login` devuelven `{ token, usuario }`. El frontend guarda el
`token` en `localStorage` bajo la llave `rutacr_token`.

## Recuperar contraseña

El flujo es: `recuperar.html` (pide el correo) → el backend genera un token
válido por 30 minutos en la tabla `reset_tokens` → `restablecer.html?token=...`
(pide la nueva contraseña).

Para que el correo realmente llegue necesitás una cuenta en
**Resend** (https://resend.com, igual que usás en VíaMaster CR) y agregar en
`.env`:

```
RESEND_API_KEY=tu_api_key
RESEND_FROM=RutaCR <no-reply@tudominio.com>
FRONTEND_URL=https://tu-frontend-desplegado.com
```

Si dejás `RESEND_API_KEY` vacío, el enlace de recuperación simplemente se
imprime en la consola del backend — útil para probar el flujo completo antes
de conectar el correo real.
