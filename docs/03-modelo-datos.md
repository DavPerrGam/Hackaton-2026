# 03 · Modelo de base de datos optimizado

Ver el archivo ejecutable en `database/schema.sql` (con `database/seed.sql`
para los datos iniciales reales entregados por IDEAPRO). Este documento
explica el *por qué* de cada cambio frente al esquema original.

## 1. Problemas detectados en el esquema entregado

1. **Extensión no declarada**: usaba `uuid_generate_v4()` sin
   `create extension "uuid-ossp"`. En una base nueva, la creación de
   tablas falla en la primera columna `id`.
2. **Sin módulo de autenticación**: el reto pide "gestión de usuarios"
   para quien opera el agente puertas adentro, pero el esquema no
   tenía tabla de administradores ni bitácora de auditoría.
3. **Sin estado de conversación**: `sesiones` no tenía dónde guardar
   "en qué pregunta va" ni las respuestas parciales, lo que hace
   imposible reanudar un onboarding interrumpido (requisito de
   "Seguimiento" del reto).
4. **RLS decorativo**: todas las políticas eran `using (true)`, es
   decir, RLS estaba activado pero no protegía nada realmente.
5. **Faltaban índices para los patrones de consulta reales** del
   agente: última sesión de una empresa, catálogo activo por eje,
   ruta ordenada por prioridad.
6. **Sin restricciones de unicidad** que evitaran, por ejemplo, dos
   filas de `ruta_recomendada` para el mismo servicio en el mismo
   diagnóstico, o dos servicios con el mismo `orden_catalogo`.

## 2. Cambios aplicados

| Cambio | Tabla(s) | Beneficio |
|---|---|---|
| `create extension "uuid-ossp"` / `pgcrypto` | — | El script corre en cualquier proyecto Supabase nuevo sin pasos manuales |
| `administradores`, `bitacora_auditoria` | nuevas | Gestión de usuarios internos + trazabilidad de acciones administrativas |
| `paso_actual int`, `respuestas jsonb`, `estado estado_sesion_enum` | `sesiones` | Onboarding reanudable; base para reportes de abandono ("¿en qué pregunta se van la mayoría?") |
| `idx_empresas_correo`, `idx_diagnosticos_empresa_fecha`, `idx_catalogo_activo_eje`, `idx_sesiones_empresa_estado` | varias | Las consultas más frecuentes del agente (buscar por correo, último diagnóstico, catálogo activo) usan índice en vez de *seq scan* |
| `uq_ruta_diagnostico_servicio`, `uq_encaje_diagnostico_oportunidad`, `uq_catalogo_orden` | `ruta_recomendada`, `encaje_oportunidad`, `catalogo_servicios` | Evitan duplicados silenciosos que romperían el orden mostrado al usuario |
| `check` de formato de correo, rangos numéricos (`>= 0`) | `empresas`, `catalogo_servicios`, `tipos_oportunidad` | Menos validación duplicada en el backend; la base rechaza estados imposibles |
| Vista `vista_empresa_resumen` | — | El panel admin hace una sola consulta en vez de 3 joins repetidos en cada request |
| Políticas RLS reales (solo catálogo/sectores/oportunidades de lectura pública) | todas | Si algún día se filtra la `anon key`, no se puede leer ni una fila de `empresas` o `diagnosticos` |

## 3. Diagrama entidad-relación (simplificado)

```
sectores 1───* empresas 1───* sesiones 1───1 diagnosticos 1───* ruta_recomendada *───1 catalogo_servicios
                                                        │                                        │
                                                        └──* encaje_oportunidad *───1 tipos_oportunidad
                                                                                          
catalogo_servicios *───* catalogo_servicios   (vía dependencias_servicios, autorreferencial)
empresas 1───* hitos_empresa
administradores 1───* bitacora_auditoria
```

## 4. Campo calculado clave: `indice_ideapro`

```sql
indice_ideapro int generated always as (
  (score_oferta + score_experiencia + score_operativa +
   score_legal  + score_financiera  + score_comercial) * 10 / 6
) stored
```

Se mantiene como columna generada (no calculada en la aplicación) para
que **cualquier consulta SQL directa** (reportes, BI, un futuro
dashboard en Metabase/Looker) tenga el índice correcto sin depender de
que el backend lo haya escrito bien. Rango resultante: 0–1000.

## 5. Umbrales de nivel de madurez

| Índice IDEAPRO | Nivel |
|---|---|
| 0 – 250 | `inicial` |
| 251 – 500 | `en_desarrollo` |
| 501 – 750 | `intermedio` |
| 751 – 1000 | `avanzado` |

Definidos en `backend/src/agent/scoring.js` (función `clasificarNivel`),
documentados aquí para que cualquier ajuste futuro se haga en un único
lugar y quede reflejado en ambos documentos.
