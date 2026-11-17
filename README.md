# IDEAPRO · Agente Inteligente de Diagnóstico y Recomendación

Prototipo funcional del reto propuesto por IDEAPRO S.A.S.: un agente
conversacional que diagnostica el nivel de madurez de una empresa
frente al mercado público colombiano y le recomienda una ruta
personalizada de servicios del ecosistema IDEAPRO.

## Estructura del repositorio

```
ideapro-agente/
├── docs/            → los 8 entregables solicitados (análisis, arquitectura,
│                      modelo de datos, interfaces, instalación, mejoras)
├── database/        → ideapro_supabase_completa.sql (instalación desde cero)
├── backend/         → API REST (Express + Supabase + JWT)
└── frontend/        → SPA (React + Vite + Bootstrap)
```

## Inicio rápido

Ver `docs/07-instalacion-despliegue.md` para la guía completa.
En resumen:

```bash
# 1) Base de datos nueva: ejecutar database/ideapro_supabase_completa.sql.
#    Para una base Supabase existente, ejecutar en orden las migraciones de
#    database/ (ver docs/09-protocolo-nexus.md); la última es
#    migration_nexus_relaciones.sql, que agrega tags y relaciones empresariales.

# 2) Backend
cd backend   # completar backend/.env con credenciales reales
npm install
npm run create-admin -- "Tu Nombre" correo@ideapro.com ClaveSegura123*
npm run dev

# 3) Frontend
cd frontend   # comprobar que frontend/.env tenga VITE_API_URL
npm install
npm run dev
```

## Documentación de referencia

| Entregable | Archivo |
|---|---|
| 1. Análisis de requisitos | `docs/01-analisis-requisitos.md` |
| 2. Arquitectura de la solución | `docs/02-arquitectura.md` |
| 3. Modelo de base de datos optimizado | `docs/03-modelo-datos.md` |
| 4. Diseño de interfaces | `docs/04-diseno-interfaces.md` |
| 5-6. Código fuente + agente inteligente | `backend/`, `frontend/` |
| 7. Instalación y despliegue | `docs/07-instalacion-despliegue.md` |
| 8. Mejoras futuras | `docs/08-mejoras-futuras.md` |
| 9. Protocolo del agente (15 etapas → código) | `docs/09-protocolo-nexus.md` |

## Aviso de seguridad

El `.env` del Proyecto Integrador original entregado contenía una
`service_role key` real de Supabase expuesta. No se reutilizó en este
proyecto. **Rótala en el panel de Supabase antes de continuar.**
