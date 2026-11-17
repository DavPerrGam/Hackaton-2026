# 01 · Análisis de requisitos

## 1. Contexto
IDEAPRO requiere un agente inteligente que sea la puerta de entrada a su
ecosistema de servicios: diagnostica el nivel de madurez de una empresa
frente al mercado público, la perfila y le recomienda una ruta de
servicios personalizada (ver reto adjunto, "Objetivo del reto").

## 2. Requisitos funcionales (trazabilidad al reto)

| # | Funcionalidad del reto | Cómo se implementa |
|---|---|---|
| 1 | Onboarding conversacional | `backend/src/agent/questions.js` + `inference.js` + `sufficiency.js` + `ChatAgent.jsx`: entrevista de 13 turnos (15 en el peor caso) más hasta 3 profundizaciones adaptativas, con estado persistido en `sesiones` |
| 2 | Diagnóstico de madurez | `backend/src/agent/scoring.js`: 6 ejes (oferta, experiencia, operativa, legal, financiera, comercial) con rúbrica explicable, índice IDEAPRO 0-1000 |
| 3 | Perfilamiento inteligente | Tabla `empresas` + `sesiones.respuestas`, construidas incrementalmente durante la conversación |
| 4 | Recomendación personalizada | `backend/src/agent/recommendation.js`: filtra `catalogo_servicios` por elegibilidad (nivel/índice) y prioriza por eje crítico |
| 5 | Ruta de crecimiento | Tabla `ruta_recomendada`, ordenada por `orden_prioridad`, resolviendo prerrequisitos obligatorios automáticamente |
| 6 | Cross-selling inteligente | Motor de recomendación agrega servicios de ejes secundarios débiles (score < 60) distintos al eje crítico, evitando ofertas genéricas |
| 7 | Seguimiento | `sesiones` reanudable por `paso_actual`; `diagnosticos.numero_visita` permite comparar evolución en visitas futuras |

## 3. Requisitos no funcionales

- **Seguridad**: autenticación JWT + bcrypt para el panel interno; rate
  limiting en endpoints públicos y de login; RLS en Supabase como
  última barrera; validación de tipos en cada respuesta del onboarding
  (evita mass-assignment hacia `empresas`).
- **Escalabilidad**: el catálogo de servicios, las dependencias y los
  tipos de oportunidad viven en base de datos, no en código — IDEAPRO
  puede agregar servicios nuevos sin desplegar el backend.
- **Explicabilidad**: el índice y la ruta se calculan con reglas
  determinísticas y auditables (no un LLM "cajanegra"); la IA
  generativa se usa solo para la capa de redacción del resumen.
- **Accesibilidad/UX**: onboarding de una pregunta a la vez (reduce
  carga cognitiva), barra de progreso visible, opciones sí/no como
  botones grandes, formulario operable por teclado.
- **Mantenibilidad**: arquitectura por capas (config/agent/services/
  controllers/routes) igual a la usada en el Proyecto Integrador, para
  que el equipo actual no tenga que aprender un patrón nuevo.

## 4. Fuera de alcance (según "Alcance del proyecto" del reto)
Pasarela de pagos, CRM completo, automatización integral de ventas e
integraciones externas complejas (SECOP, DIAN, Cámara de Comercio) no
se implementan en esta fase; el modelo de datos sí las contempla como
extensión futura (ver `08-mejoras-futuras.md`).

## 5. Supuestos y hallazgos sobre los insumos recibidos

- El archivo `.env` del backend original contenía una **service_role
  key real de Supabase expuesta en texto plano**. Se excluyó de este
  proyecto y se recomienda **rotarla de inmediato** en el dashboard de
  Supabase.
- El ZIP del Proyecto Integrador entregado solo traía `package.json`,
  `.env` y configuración — no el código fuente (`src/`) de frontend ni
  backend. La arquitectura y convenciones de código se dedujeron del
  `readme.md` del proyecto y se replicaron fielmente (Express +
  Supabase + JWT + bcrypt en backend; React + Vite + Bootstrap en
  frontend).
- No fue posible descargar los activos de marca (logo, hoja de
  estilos) de `ideapro.com.co` desde este entorno de desarrollo, que
  solo permite tráfico saliente hacia dominios de gestores de paquetes.
  Se replicó la **estructura de navegación e información** del sitio
  (secciones Formación/Servicios/Nosotros/Novedades, redes sociales) y
  se propuso una paleta de marca institucional aproximada, documentada
  en `frontend/src/styles/variables.css` y en `08-mejoras-futuras.md`.
