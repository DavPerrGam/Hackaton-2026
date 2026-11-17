# 02 · Arquitectura de la solución

## 1. Vista general

```
┌─────────────────────┐        HTTPS/JSON        ┌──────────────────────────┐
│   Frontend (SPA)     │ ────────────────────────▶│   Backend (API REST)     │
│ React + Vite + Boot. │◀──────────────────────── │ Express + JWT + bcrypt   │
└─────────────────────┘                            └────────────┬─────────────┘
                                                                  │ service_role
                                                                  ▼
                                                     ┌──────────────────────────┐
                                                     │ Supabase (PostgreSQL)    │
                                                     │ + Row Level Security     │
                                                     └────────────┬─────────────┘
                                                                  │ (opcional)
                                                                  ▼
                                                     ┌──────────────────────────┐
                                                     │ Anthropic API (Claude)   │
                                                     │ solo capa de redacción   │
                                                     └──────────────────────────┘
```

## 2. Por qué esta arquitectura

- **Mismo stack del Proyecto Integrador** (React+Vite+Bootstrap /
  Express / Supabase / JWT+bcrypt): reduce curva de aprendizaje del
  equipo y reutiliza convenciones ya validadas (capas
  config → middlewares → services → controllers → routes).
- **Backend como único cliente de Supabase** (service_role key nunca
  sale del servidor): el frontend jamás toca la base de datos
  directamente, así que RLS + JWT del backend son las dos barreras
  reales de seguridad, no la confianza en el navegador del usuario.
- **Motor de decisión determinístico, IA como capa opcional**: el
  índice, el nivel de madurez, el eje crítico y la ruta recomendada se
  calculan con reglas explícitas en código (`backend/src/agent/*.js`).
  Esto es clave para un producto comercial: se puede auditar por qué
  se recomendó cada servicio, y el sistema sigue funcionando al 100%
  sin depender de una API externa de terceros. La IA generativa
  (Claude) solo redacta el resumen en lenguaje natural sobre datos ya
  calculados — nunca decide el diagnóstico.
- **Configuración dirigida por datos, no por código**: preguntas del
  onboarding en `questions.js`, catálogo/dependencias/tipos de
  oportunidad en tablas de base de datos. Agregar un servicio nuevo,
  cambiar su precio o ajustar sus prerrequisitos es una operación de
  base de datos, no un despliegue.

## 3. Módulos del backend

```
backend/src/
├── config/        → env.js, supabase.js
├── middlewares/    → authMiddleware.js, errorHandler.js, rateLimiter.js
├── agent/          → questions.js, inference.js, sufficiency.js,
│                     scoring.js, recommendation.js,
│                     opportunityMatch.js, llmClient.js   (el "cerebro")
├── services/        → capa de acceso a datos + orquestación
├── controllers/     → adaptan HTTP ↔ services
├── routes/           → agentRoutes, catalogoRoutes, authRoutes, adminRoutes
└── server.js         → composición final de Express
```

`agentService.js` es el orquestador central: recibe cada respuesta del
onboarding, la valida contra `questions.js`, actualiza `sesiones` y —
cuando el onboarding termina— invoca en secuencia `scoring.js` →
`recommendation.js` → `opportunityMatch.js` → `llmClient.js`, y persiste
los resultados en `diagnosticos`, `ruta_recomendada` y
`encaje_oportunidad`.

## 4. Módulos del frontend

```
frontend/src/
├── api/axiosClient.js         → cliente HTTP único, inyecta JWT si existe
├── context/AuthContext.jsx    → sesión del panel admin
├── hooks/useAgent.js          → máquina de estados de la conversación
├── components/layout/         → Navbar, TopBar, Footer (identidad IDEAPRO)
├── components/home/           → secciones de la landing
├── components/agent/          → chat, radar, ruta recomendada, encaje
├── pages/                     → HomePage, AgentePage, admin/*
└── routes/ProtectedRoute.jsx  → guarda de rutas del panel admin
```

## 5. Seguridad

| Capa | Mecanismo |
|---|---|
| Transporte | HTTPS en producción (terminado por el proveedor de hosting) |
| Autenticación admin | JWT firmado (`JWT_SECRET`), expiración configurable |
| Contraseñas | bcrypt (10 rounds) |
| Fuerza bruta | Bloqueo de cuenta tras 3 intentos fallidos + rate limit por IP en `/api/auth/login` |
| Datos | Backend usa `service_role`; RLS activo en todas las tablas; solo catálogo/sectores/oportunidades tienen lectura pública |
| Validación de entrada | Cada respuesta del onboarding se valida contra el tipo declarado en `questions.js` antes de persistir |
| CORS | Restringido a `FRONTEND_URL` |

## 6. Escalabilidad prevista

- El motor de recomendación ya soporta un grafo de dependencias entre
  servicios (`dependencias_servicios`), por lo que agregar servicios
  más complejos con múltiples prerrequisitos no requiere cambios de
  código.
- La conversación es *reanudable* (`sesiones.paso_actual`), lo que
  habilita a futuro canales adicionales (WhatsApp, API) reutilizando
  exactamente el mismo `agentService.js`, cambiando solo el adaptador
  de entrada.
- El esquema separa claramente "catálogo" (lo que IDEAPRO ofrece) de
  "diagnóstico" (lo que la empresa necesita), lo que permite en el
  futuro un segundo motor de recomendación (p. ej. basado en embeddings)
  sin migrar datos.
