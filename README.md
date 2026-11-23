# ESTUDIANTINA 2027 – Despliegue (GitHub + Netlify + Supabase)

## 1. Base de datos (Supabase, gratis)
1. Crea un proyecto en https://supabase.com
2. SQL Editor → pega y ejecuta `database/schema.sql`
3. Project Settings → API: copia **Project URL** y la clave **service_role** (secreta, nunca en el código).

## 2. GitHub
Crea un repositorio y sube TODO el contenido de esta carpeta (index.html, netlify.toml, netlify/, database/).

## 3. Netlify
1. Add new site → Import from Git → elige el repositorio (sin build command; publish directory `.`).
2. Site configuration → Environment variables:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_SERVICE_KEY` = clave service_role
   - `AUTH_SECRET` = texto largo aleatorio (40+ caracteres)
   - `SETUP_KEY` = una clave que solo conozcas (protege la configuración inicial)
3. Deploys → Trigger deploy.

## 4. Primer uso
Abre el sitio: aparece la Configuración inicial (colegio, cursos, 10 coordinadores, contraseña de Sexto + tu SETUP_KEY).
Luego todo se edita desde el panel de coordinadores (pestaña Config).

Seguridad: las contraseñas se guardan con scrypt, la verificación y los permisos se hacen en el servidor (Netlify Function), y las tablas tienen RLS sin políticas públicas. Los datos se actualizan solos cada 6 segundos.
