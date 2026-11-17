# 07 · Instrucciones de instalación y despliegue

## 0. Requisitos previos
- Node.js 20+
- Una cuenta y proyecto en [Supabase](https://supabase.com)
- (Opcional) una API key de Anthropic si quieres redacción con IA
  generativa en el resumen del diagnóstico

## 1. Base de datos (Supabase)

1. Crea un proyecto nuevo en Supabase.
2. En **SQL Editor**, ejecuta `database/ideapro_supabase_completa.sql`.
  Este es el esquema canónico: crea tablas, relaciones, catálogo inicial,
  oportunidades, postulaciones PRE/DURANTE/EXPOST, formación, RLS y el
  bucket privado `ideapro-documentos`.
3. Si el proyecto ya tenía una instalación anterior, ejecuta
  `database/migration_supabase_oportunidades_formacion.sql` para agregar las
  tablas de oportunidades y formación sin borrar datos. La migración
  `database/migration_ideapro_2026.sql` conserva los cambios históricos del
  proyecto y también puede ejecutarse en instalaciones que la necesiten.
  La fuente `secop_ii` queda preparada para una integración posterior; el
  sistema no presenta datos SECOP II como si ya estuvieran conectados.
4. En **Project Settings → Data API**, copia:
   - `Project URL` → será `SUPABASE_URL`
   - `service_role` key (⚠️ nunca la expongas en el frontend ni la
     subas a un repositorio público) → será `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ Si vienes de un proyecto donde esta clave ya quedó expuesta
> (subida a un repo, compartida en un zip, etc.), **rótala primero**
> desde el mismo panel antes de continuar.

## 2. Backend

```bash
cd backend
# edita .env con tus valores reales de Supabase y un JWT_SECRET fuerte:
#   openssl rand -base64 48
npm install
npm run create-admin -- "Tu Nombre" tucorreo@ideapro.com ClaveSegura123*
npm run dev        # http://localhost:3001
```

Prueba rápida:
```bash
curl http://localhost:3001/
curl http://localhost:3001/api/catalogo
```

## 3. Frontend

```bash
cd frontend
# VITE_API_URL=http://localhost:3001/api
npm install
npm run dev         # http://localhost:5173
```

Flujo de prueba manual:
1. Abre `http://localhost:5173` → landing IDEAPRO.
2. Clic en "Diagnostica tu empresa" → responde el onboarding completo.
3. Al terminar, verifica que aparezcan: índice, nivel, radar, ruta
   recomendada y encaje con oportunidades.
4. Ve a `http://localhost:5173/admin/login`, ingresa con el
   administrador creado en el paso 2, y confirma que la empresa recién
   diagnosticada aparece en la tabla.

## 4. Variables de entorno — referencia completa

**Backend (`backend/.env`)**
| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor Express (default 3001) |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo backend) |
| `JWT_SECRET` | Secreto para firmar tokens del panel admin |
| `JWT_EXPIRES_IN` | Vigencia del token (ej. `2h`) |
| `FRONTEND_URL` | Origen permitido por CORS |
| `ANTHROPIC_API_KEY` | Opcional, habilita redacción con IA generativa |
| `ANTHROPIC_MODEL` | Modelo a usar (ej. `claude-sonnet-4-6`) |

**Frontend (`frontend/.env`)**
| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base de la API backend |

## 5. Despliegue en producción (sugerido)

- **Backend**: cualquier PaaS que corra Node.js (Render, Railway,
  Fly.io, un VPS con PM2 + Nginx como proxy inverso). Configura las
  mismas variables de entorno del `.env` como *secrets* del proveedor.
- **Frontend**: `npm run build` genera `frontend/dist/`, servible como
  sitio estático (Vercel, Netlify, Cloudflare Pages, o el mismo Nginx
  del backend).
- **Base de datos**: Supabase administrado; activa backups
  automáticos y considera un plan con soporte de *point-in-time
  recovery* antes de ir a producción con clientes reales.
- **CORS/dominios**: actualiza `FRONTEND_URL` en el backend y
  `VITE_API_URL` en el frontend a las URLs reales de producción.
- **Monitoreo mínimo**: logs de errores del backend ya centralizados
  en `middlewares/errorHandler.js`; conéctalo a un servicio como
  Sentry o Better Stack antes del lanzamiento público.
