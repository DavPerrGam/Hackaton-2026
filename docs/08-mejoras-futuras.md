# 08 · Recomendaciones de mejora futuras

## Corto plazo
- **Fidelidad de marca**: reemplazar la paleta aproximada de
  `frontend/src/styles/variables.css` por los tokens reales de IDEAPRO
  (logo SVG, hex exactos, tipografía con licencia), y montar el logo
  real en `Navbar.jsx` y `Footer.jsx`.
- **Pruebas automatizadas**: unit tests para `scoring.js` y
  `recommendation.js` (son funciones puras, ideales para testear
  casos borde: empresa con todas las respuestas en "no", empresa que ya
  cumple todos los requisitos, ciclos de dependencias).
- **Panel admin ampliado**: filtros por nivel de madurez/sector,
  exportar a CSV, y un CRUD real de `catalogo_servicios` y
  `tipos_oportunidad` (hoy solo se editan por SQL/Supabase Studio).
- **Notificación por correo**: al completar el diagnóstico, enviar el
  resumen y la ruta recomendada al `correo_contacto` (SendGrid/Resend).

## Mediano plazo
- **Seguimiento multi-visita real**: usar `diagnosticos.numero_visita`
  para mostrarle a la empresa su evolución entre diagnósticos ("tu
  índice subió 120 puntos desde tu última visita"), y a IDEAPRO qué
  servicios efectivamente movieron el indicador.
- **Hitos y gamificación**: activar `hitos_empresa` (ya modelada en el
  esquema) para dar una sensación de progreso tipo "checklist" mientras
  la empresa avanza en su ruta.
- **Integración con SECOP II**: cruzar `tipos_oportunidad` con procesos
  reales publicados en SECOP II filtrados por sector, para mostrar
  oportunidades vigentes y no solo categorías genéricas.
- **CRM ligero**: exportar leads calificados (empresas con índice alto
  y ruta corta) hacia el CRM que use el equipo comercial de IDEAPRO.

## Largo plazo
- **Motor de recomendación híbrido**: complementar las reglas
  determinísticas actuales con un modelo de recomendación basado en
  historial real (qué servicios efectivamente llevaron a una empresa a
  ganar un contrato), sin perder la explicabilidad de la capa de
  reglas.
- **Multicanal**: reutilizar `agentService.js` para exponer el mismo
  onboarding vía WhatsApp Business API, ya que el modelo de datos
  contempla `canal_entrada` desde el día uno.
- **Analítica de abandono**: usar `sesiones.paso_actual` para detectar
  en qué pregunta concreta la mayoría de empresas abandona el
  onboarding y rediseñar esa pregunta específica.
