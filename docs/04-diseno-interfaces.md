# 04 · Diseño de interfaces

## 1. Principios de diseño aplicados

- **Identidad institucional**: paleta azul profundo + dorado (autoridad
  / sector público), tipografía sans-serif limpia, tarjetas con sombra
  suave — coherente con una consultora que trabaja con el Estado.
- **Una pregunta a la vez**: el onboarding nunca muestra un formulario
  largo; reduce abandono y funciona igual de bien en móvil.
- **Progreso visible**: barra de progreso + contador "Paso X de Y" en
  el encabezado del chat, para que la empresa sepa cuánto falta.
- **Accesibilidad**: contraste AA en textos sobre fondo oscuro del
  hero, botones grandes (mínimo 44px de alto) para las respuestas
  sí/no, `aria-label` en íconos de redes sociales, foco automático en
  el campo de texto activo.

## 2. Mapa de pantallas

```
/                → HomePage: TopBar, Navbar, Hero, EcosistemaCards (6 ejes),
                   ServiciosGrid (catálogo en vivo), CTAAgente, Footer

/agente          → AgentePage: ChatAgent (conversación paso a paso)
                     └─ al completar → DiagnosticoResumen
                          ├─ EjesRadar (barras 0-100 por eje)
                          ├─ RutaRecomendada (servicios ordenados)
                          └─ EncajeOportunidades (% de encaje + brechas)

/admin/login     → LoginPage: acceso interno (correo + contraseña)
/admin           → DashboardPage: tabla de empresas diagnosticadas
                   (protegida por JWT vía ProtectedRoute)
```

## 3. Componente central: `ChatAgent`

Estados visuales:
1. **Cargando inicial**: se crea la sesión y llega la primera pregunta.
2. **Conversación activa**: burbuja del agente (izquierda, fondo
   blanco) + burbuja del usuario (derecha, fondo azul); el control de
   respuesta (`StepInput`) se adapta al tipo de pregunta:
   - `boolean` → dos botones grandes (Sí / No)
   - `select` → `<select>` con opciones cargadas desde la API (p. ej.
     sectores) o embebidas (p. ej. rangos de ventas)
   - `text` / `number` → input con envío por Enter o botón
3. **Generando diagnóstico**: mensaje de transición mientras el
   backend calcula scoring + ruta + encaje + resumen IA.
4. **Resultado**: reemplaza el chat por `DiagnosticoResumen`.

## 4. Resultado del diagnóstico

- **Encabezado**: nombre de la empresa, índice IDEAPRO en grande,
  badge de nivel de madurez con color semántico (verde), resumen en
  lenguaje natural.
- **Columna izquierda**: radar de 6 ejes (barras horizontales con
  porcentaje) + tarjetas de encaje con oportunidades de mercado
  público y sus brechas específicas.
- **Columna derecha**: ruta de servicios recomendada, cada tarjeta con
  badge de tipo (Prioridad #1 / Prerrequisito / Complementario),
  justificación en lenguaje natural, precio, duración y modalidad.

## 5. Panel administrativo (mínimo viable)

Una tabla con una fila por empresa (vista `vista_empresa_resumen`):
nombre, sector, canal de entrada, índice, nivel, eje crítico y fecha
del último diagnóstico. Pensado para que un consultor de IDEAPRO
priorice a quién contactar primero (menor índice = mayor urgencia de
acompañamiento, mayor índice = más cerca de cerrar una oportunidad).

## 6. Fidelidad visual con ideapro.com.co

No fue posible acceder a los archivos de marca (logo vectorial, hoja de
estilos, tipografías con licencia) desde este entorno. La estructura de
navegación (Formación / Servicios / Nosotros / Novedades, redes
sociales en el footer) sí se replicó a partir del contenido público del
sitio. La paleta de color es una aproximación profesional razonada, no
una extracción exacta — ver recomendación en `08-mejoras-futuras.md`.
