# Protocolo IDEAPRO Intelligence AI · Mapeo de las 15 etapas al código

Este documento traza cada etapa del protocolo del agente a la pieza de software que la implementa.
Sirve para dos cosas: auditar que ninguna etapa quedó sin implementar, y saber dónde tocar cuando se
quiera ajustar una regla de negocio.

## Principio de arquitectura: la IA redacta, las reglas deciden

El índice IDEAPRO, los puntajes por eje, el nivel de madurez, la elegibilidad, el riesgo financiero,
las brechas, las entidades objetivo, el plan de acción y el reporte son **100% deterministas**.
La IA generativa interviene únicamente en la capa de redacción del resumen ejecutivo y en la
interpretación conversacional de las respuestas del usuario.

Esto es una decisión de producto, no una limitación técnica:

- El diagnóstico es la base de una relación comercial. Debe ser **reproducible**: la misma
  organización, con las mismas respuestas, obtiene el mismo resultado hoy y en seis meses.
- Debe ser **explicable**: cuando una organización pregunta "¿por qué quedé en nivel 3 y no en 4?",
  el sistema responde con la regla exacta que aplicó el techo, no con una racionalización posterior.
- Debe ser **auditable**: cada cifra es trazable hasta la respuesta que la originó.

Si el LLM puntuara directamente, ninguna de las tres propiedades se sostiene. Por eso la identidad
del agente (`nexusPrompt.js`) incluye una regla inviolable: interpretar y explicar los datos ya
calculados, nunca recalcularlos ni inventar cifras. Eso incluye los tags (etapa 4) y las
organizaciones similares (etapa 11): el LLM puede explicarlos, nunca inventarlos.

Consecuencia operativa: **el sistema funciona sin ninguna API key de IA configurada**. Sin
`ANTHROPIC_API_KEY`, `GEMINI_API_KEY` ni webhook de n8n, el diagnóstico completo se genera igual y
el resumen ejecutivo cae a la plantilla determinista (`resumenPlantilla`).

## Mapeo etapa por etapa

| # | Etapa del protocolo | Implementación | Salida persistida |
|---|---|---|---|
| 1 | Identificación de la organización | `agent/questions.js` (etapa 1) + `agent/inference.js` | `empresas.nombre`, `tipo_organizacion`, `nombre_contacto`, `cargo_contacto`, `correo_contacto`, `ubicacion_ciudad`, `ubicacion_departamento`, `sitio_web`, `sector_texto` |
| 2 | Validación de elegibilidad | `agent/eligibility.js` | `diagnosticos.estado_elegibilidad`, `diagnosticos.elegibilidad` |
| 3 | Clasificador de enfoque | `agent/classification.js` → `clasificarOrganizacion` | `diagnosticos.clasificacion_sectorial` |
| 4 | Generación de tags | `agent/tags.js` | `diagnosticos.tags` |
| 5 | Selección inteligente de preguntas | `agent/sufficiency.js` → `planificarProfundizacion` + `agent/classification.js` → `detectarEnfoques` + `agent/questions.js` (etapa 7) | `sesiones.respuestas._profundizacion` |
| 6 | Perfilamiento de servicios | `agent/valueProposition.js` | `diagnosticos.perfilamiento_oferta` |
| 7 | Rúbrica maestra (técnica, jurídica, financiera, propuesta de valor, ecosistema) | `agent/scoring.js` → `calcularDimensiones` | `diagnosticos.dimensiones_ideapro`, `score_*` |
| 8 | Nivel de madurez 1-5 | `agent/scoring.js` → `calcularNivelMadurez` | `diagnosticos.nivel_madurez_numero`, `nivel_madurez_global` |
| 9 | Detector de brechas (6 familias) | `agent/scoring.js` → `identificarBrechasPorFamilia` | `diagnosticos.brechas_por_familia` |
| 10 | Mapa de oportunidades | `agent/entityMap.js` | `diagnosticos.entidades_objetivo` |
| 11 | Relaciones empresariales | `agent/similarity.js` + `services/agentService.js` → `cargarEcosistemaComparable` | `diagnosticos.organizaciones_similares` |
| 12 | Memoria inteligente | `services/agentService.js` → `heredarFichaPrevia` + `agent/questions.js` → `getVisibleQuestions` | `sesiones.respuestas._memoria` |
| 13 | Recomendador IDEAPRO | `agent/recommendation.js` + catálogo IDEAPRO | tabla `ruta_recomendada` |
| 14 | Plan de acción 30/60/90/180 | `agent/actionPlan.js` | `diagnosticos.plan_accion` |
| 15 | Reporte final (20 secciones) | `agent/report.js` | `diagnosticos.reporte_final` |

Las etapas 7, 8 y 9 no agregan preguntas: se deducen de la conversación ya sostenida. La numeración
de etapas de `questions.js` (1..7) es el hilo del diálogo, no la numeración del protocolo.

## La entrevista: 13 turnos fijos, 15 en el peor caso, 3 profundizaciones como máximo

El agente no llena un formulario: sostiene la reunión de cinco minutos que un consultor senior tiene
con un empresario. El orden es fijo porque es el orden en que se entiende una organización:

| Etapa | Pregunta de fondo | Turnos |
|---|---|---|
| 1 | ¿Quiénes son? | `nombre`, `tipo_organizacion`*, `identificacion`, `anios_operacion`, `contexto_operacion` |
| 2 | ¿Qué hacen? | `tipo_bien_servicio` |
| 3 | ¿Qué problema resuelven? | `propuesta_valor`, `sector_texto`* |
| 4 | ¿Tienen capacidad para ejecutarlo? | `capacidad_ejecucion`, `equipo_cobertura`, `alistamiento_juridico`, `perfil_financiero` |
| 5 | ¿Tienen experiencia con el sector público? | `experiencia_publica`, `ecosistema_publico` |
| 6 | ¿Qué les falta para crecer? | `cierre` |
| 7 | Profundización adaptativa | máximo 3, solo si hay señal |

\* Condicionales: solo se formulan cuando `inference.js` no logró deducir el dato.

### Cómo caben ~30 señales de rúbrica en 13 turnos

`scoring.js` necesita alrededor de treinta señales para calcular los seis ejes. Recortar la
conversación a trece turnos sin perder ninguna se logra con tres mecanismos, no eliminando datos:

- **`multi`** · un checklist que se responde en un turno y deriva N booleanos. Cinco preguntas de
  sí/no sobre alistamiento jurídico son una sola conversación real. `derivarRespuestas` las expande
  a las mismas llaves planas de siempre: `scoring.js` no se enteró del cambio.
- **`form`** · varios campos en una sola burbuja, como cuando un consultor pregunta "¿ciudad,
  departamento y web?".
- **Inferencia** (`inference.js`) · lo deducible no se pregunta. La naturaleza jurídica sale de la
  razón social, el sector de la descripción de la oferta y las entidades objetivo de lo que la
  organización ya mencionó. Todo lo deducido queda en `respuestas._inferidos` con su origen y su
  evidencia, se declara en el chat y se marca en el reporte: un dato inferido que nadie puede
  auditar es, en la práctica, un dato inventado.

### Cuándo el agente se detiene

`sufficiency.js` evalúa, una sola vez y sobre el núcleo ya respondido, si queda algo que valga una
pregunta más. Solo profundiza ante **inconsistencia**, **información faltante importante**,
**riesgo** u **oportunidad**, con tope duro de tres. Si no hay señales, el plan sale vacío y la
entrevista termina en el turno 13: esa es la regla de "si ya tienes suficiente información, detente".

El plan se **congela** en `respuestas._profundizacion` en el momento en que el núcleo se cierra, y no
se recalcula. Si se recalculara, responder una profundización podría apagar el detector que la
abrió (declarar las entidades objetivo apaga el detector que preguntó por ellas), la pregunta
desaparecería de la lista visible y el índice de paso retrocedería a mitad de la conversación.

Por la misma razón, el `showIf` de las dos preguntas condicionales del núcleo mira si el dato fue
**deducido** (`_inferidos`), no si está respondido: una condición del tipo `!r.sector_texto` haría
que responderla la sacara de la lista y la organización se saltara la pregunta siguiente en
silencio.

## Etapa 8: por qué el nivel NO es un promedio

El protocolo es explícito: *"No utilices simple promedio. Considera brechas críticas, riesgos,
experiencia y capacidad de ejecución."*

`calcularNivelMadurez` calcula un nivel base a partir del índice (0-1000) y luego aplica **techos**.
Un techo nunca sube el nivel, solo lo limita:

| Condición | Techo | Razón |
|---|---|---|
| Menos de 1 año de operación | 1 | No puede acreditar experiencia ni financieros comparables |
| Riesgo de elegibilidad abierto | 3 | Hay condiciones habilitantes sin cumplir |
| Algún eje por debajo de 30/100 | 2 | Brecha crítica que bloquea el avance |
| Capacidad jurídica bajo 50/100 | 3 | No supera los requisitos habilitantes |
| Sin registro mercantil renovado | 2 | No acredita existencia y representación legal |
| Sin RUP vigente | 3 | No puede ser proponente en la mayoría de procesos |
| Sin expediente documental | 3 | No alcanza a acreditar dentro de los plazos del proceso |
| Riesgo financiero alto | 2 | No puede asumir compromisos contractuales |
| Sin contratos públicos ejecutados | 4 | No hay trayectoria de organización consolidada |
| Sin capacidad de ejecución simultánea | 4 | No puede sostener más de un contrato |

Cada techo aplicado se guarda con su motivo en `nivel_madurez.penalizaciones` y el frontend lo
muestra explícitamente ("Por qué no es un nivel superior"). Una organización con índice 870 pero sin
RUP queda en nivel 3, no en 5, y sabe exactamente por qué.

## Etapa 2: riesgo de elegibilidad ≠ descalificación

De las seis condiciones habilitantes, **solo la antigüedad menor a un año descalifica**. Las otras
cinco (ventas registradas, capital de trabajo, experiencia en proyectos, experiencia pública y
capacidad operativa) se marcan como `RIESGO DE ELEGIBILIDAD`: se explican, actúan como techo del
nivel de madurez y se convierten en acciones concretas del plan 30/60/90/180.

El criterio de diseño: cortar la conversación ante cada incumplimiento destruye el valor consultivo.
Una organización que no cumple hoy es exactamente la que más necesita la ruta.

## Etapa 3: cómo se calcula la afinidad

Léxico ponderado por categoría sobre el texto agregado del perfil (sector, producto, problema,
diferenciador, objetivo, entidades objetivo). La afinidad combina:

- **Evidencia léxica** (hasta 70 puntos): términos del léxico encontrados, saturando en 12 puntos brutos.
- **Señales estructurales** (hasta 30 puntos): sector declarado (15), naturaleza jurídica (10),
  madurez tecnológica (5).

Las raíces del léxico coinciden solo al **inicio de palabra**, y las de tres letras o menos exigen
palabra completa. Sin esa regla, "ti" activaría Tecnología dentro de "administrativo" y "red" dentro
de "reduce", inflando la clasificación con evidencia falsa. Cada categoría devuelve los términos que
la dispararon, para poder explicárselo a la organización.

## Etapa 6: la cadena de valor público

```
SERVICIO → CAPACIDAD → PROBLEMA QUE RESUELVE → NECESIDAD PÚBLICA → IMPACTO ESPERADO → COMPRADOR PÚBLICO
```

La traducción opera sobre la **clasificación ya calculada**, no sobre el texto crudo: así la cadena
es coherente con el resto del diagnóstico. Cuando la organización pertenece a varias categorías se
construye una cadena por cada una de las tres principales, porque una misma capacidad atiende
necesidades públicas distintas y por tanto compradores distintos.

Si la organización no logró formular el problema que resuelve, el módulo emite una alerta explícita:
sin esa formulación no hay traducción posible a lenguaje de compra pública, por buena que sea la
capacidad técnica.

## Etapa 10: por qué el mapa castiga la ambición mal calibrada

`entityMap.js` prioriza cada tipo de entidad cruzando tres factores: afinidad temática (viene del
perfilamiento), alcance territorial de la organización y su nivel de madurez. Sugerirle un
ministerio a una organización de cobertura municipal y nivel 2 no es una oportunidad, es una pérdida
de tiempo. Las entidades no accesibles no se ocultan: se listan aparte, con la barrera concreta que
habría que cerrar primero.

## Etapa 4: por qué los tags son vocabulario cerrado

Los tags no salen de un LLM ni del texto libre: se derivan de la clasificación, de un **léxico
controlado** de capacidades y temas de política pública, del mapa de entidades y de la ficha
(naturaleza jurídica, cobertura, acreditaciones). Cada tag guarda de dónde salió.

La razón es funcional: los tags son la llave de **agrupación** del ecosistema. Si dos organizaciones
idénticas quedaran etiquetadas una como "Gestión documental" y otra como "gestión de documentos",
la agrupación se rompe y con ella la etapa 11 y las convocatorias dirigidas. Un vocabulario abierto
produce sinónimos; un vocabulario cerrado produce grupos.

## Etapa 5: preguntas distintas para organizaciones distintas

`detectarEnfoques` traduce la clasificación y la naturaleza jurídica a cinco bloques de
profundización: tecnología, formación, consultoría, fundación y universidad. Dos reglas de diseño:

1. **Máximo dos enfoques, y el segundo solo aporta sus preguntas clave.** Una conversación
   consultiva profundiza; un formulario interroga. Una organización que toca dos mundos responde
   su bloque dominante completo y solo lo esencial del segundo.
2. **El detector ignora las respuestas de la propia etapa 5.** Si mirara sus propias respuestas, el
   conjunto de preguntas visibles podría cambiar a mitad del bloque y el índice de paso —que es
   posicional— haría saltar o repetir preguntas. Por eso solo mira lo respondido antes.

## Etapa 11: similitud que termina en una recomendación, no en un número

La comparación contra el ecosistema pondera cinco señales: categorías (40, Jaccard ponderado por
afinidad), tags (25), compradores públicos en común (15), sector declarado (10) y problema que
resuelven (10).

El porcentaje por sí solo no sirve. La lectura sale de las **capacidades habilitantes**:

| Situación | Lectura | Recomendación |
|---|---|---|
| La otra organización acredita lo que a usted le falta (RUP, experiencia pública, respaldo financiero, cobertura) | Alianza complementaria | Unión temporal o consorcio para acreditar en conjunto |
| Muy parecida y con las mismas carencias (similitud ≥ 70) | Competencia directa | Diferenciar la propuesta o repartir territorios |
| Mismo comprador público, oferta distinta | Oferta integrada | Resolver el problema público de extremo a extremo |

Solo viaja información de perfil (nombre, tipo, territorio, nivel de madurez). Ningún dato de
contacto ni financiero de las otras organizaciones sale del ecosistema.

## Etapa 12: qué se hereda y qué no

Cuando la misma persona vuelve y nombra la **misma** organización, el agente hereda su ficha de
identificación (tipo, contacto, cargo, correo, ciudad, departamento, sitio web, sector) y esas
preguntas desaparecen de la conversación: quedan marcadas en `sesiones.respuestas._memoria` y
`getVisibleQuestions` las omite, aunque el valor sigue disponible para todos los motores.

Las **capacidades nunca se heredan**. Volver a medir el RUP, el flujo de caja, los casos de éxito o
el conocimiento de SECOP es exactamente el objeto de un segundo diagnóstico: si se heredaran, la
evolución del índice sería una ilusión. El agente anuncia la herencia en el chat, porque un salto
de preguntas sin explicación se lee como un error del sistema.

## Degradación controlada de esquema

`agentService.generarDiagnostico` intenta el insert completo y, si la base no tiene las columnas
nuevas, reintenta en dos escalones (sin columnas Nexus, luego sin columnas 2026). El diagnóstico se
guarda igual y **el reporte completo viaja al frontend en la respuesta**, aunque no se haya podido
persistir. La experiencia del usuario nunca se degrada; solo la persistencia.

Esto permite desplegar el backend antes de correr la migración, y que una base de demo desactualizada
no rompa la presentación.

## Orden de ejecución de las migraciones

```
database/schema.sql                                    (instalación nueva: ya incluye todo)
database/seed.sql

-- o, sobre una base existente:
database/migration_ideapro_2026.sql
database/migration_supabase_oportunidades_formacion.sql
database/migration_documents.sql
database/migration_public_users.sql
database/migration_nexus_ai.sql                        (etapas 1-3, 6-10, 13-15)
database/migration_nexus_relaciones.sql                (etapas 4 y 11)
```

Ambas migraciones son idempotentes: `migration_nexus_ai.sql` usa `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`
e inserta los servicios del catálogo solo si no existen. Se puede correr más de una vez sin efectos
secundarios.

## Pruebas

`backend/src/agent/nexus.test.js` cubre las reglas que no pueden romperse:

```bash
cd backend && npm test
```

Verifica, entre otras: que el nivel no sea un promedio (sin RUP hay techo aunque el índice sea alto),
que la clasificación no invente afinidades por coincidencia parcial, que la cadena de valor siempre
llegue a un comprador, que los habilitantes duros caigan en los primeros 30 días del plan y que el
reporte entregue exactamente las 20 secciones del protocolo en su orden.

Sobre las etapas nuevas verifica además: que las preguntas de profundización se seleccionen por
enfoque (una fundación no recibe el bloque tecnológico), que el enfoque detectado no cambie al
responder ese mismo bloque, que los tags salgan del vocabulario controlado y declaren su origen, que
la similitud distinga alianza complementaria de competencia directa, y que la memoria inteligente
omita la ficha ya conocida sin heredar jamás una capacidad.
