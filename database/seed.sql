-- =====================================================================
-- IDEAPRO · Datos iniciales (catálogo real entregado por IDEAPRO)
-- Ejecutar después de schema.sql
-- =====================================================================

insert into sectores (nombre, codigo_ciiu, descripcion, peso_ejes, requisitos_clave) values
(
  'Tecnología e Información', '6201',
  'Desarrollo de software, consultoría TI y servicios tecnológicos para entidades públicas.',
  '{"oferta":1.1,"experiencia":1.0,"operativa":0.9,"legal":1.0,"financiera":0.9,"comercial":1.1}',
  array['RUP vigente','Experiencia en proyectos similares','Propuesta técnica clara']
),
(
  'Construcción e Infraestructura', '4111',
  'Obras civiles, mantenimiento y construcción de edificaciones y vías públicas.',
  '{"oferta":0.9,"experiencia":1.2,"operativa":1.3,"legal":1.2,"financiera":1.2,"comercial":0.7}',
  array['RUP vigente','Pólizas de cumplimiento','Capacidad financiera certificada','Experiencia en obras similares']
),
(
  'Salud y Servicios Médicos', '8610',
  'Prestación de servicios de salud, suministro de dispositivos médicos y medicamentos.',
  '{"oferta":1.0,"experiencia":1.1,"operativa":1.0,"legal":1.3,"financiera":1.0,"comercial":0.8}',
  array['Habilitación sanitaria INVIMA','RUP vigente','Registro de productos si aplica']
),
(
  'Agroindustria', '0111',
  'Producción, procesamiento y comercialización agropecuaria para entidades públicas.',
  '{"oferta":1.0,"experiencia":1.0,"operativa":1.2,"legal":1.0,"financiera":1.1,"comercial":0.9}',
  array['RUP vigente','Registros ICA/INVIMA','Capacidad de producción certificada']
),
(
  'Consultoría y Capacitación', '7020',
  'Servicios profesionales, consultoría de gestión y formación empresarial.',
  '{"oferta":1.2,"experiencia":1.2,"operativa":0.8,"legal":0.9,"financiera":0.8,"comercial":1.2}',
  array['RUP vigente','Hojas de vida de consultores senior','Experiencia demostrable en proyectos']
),
(
  'Suministros y Bienes', '4610',
  'Comercio al por mayor de materiales, equipos y suministros para entidades públicas.',
  '{"oferta":1.0,"experiencia":0.9,"operativa":1.1,"legal":1.0,"financiera":1.1,"comercial":1.0}',
  array['RUP vigente','Pólizas de cumplimiento','Capacidad de almacenamiento y logística']
);

insert into catalogo_servicios (
  eje_relacionado, ejes_secundarios, nombre_servicio, descripcion, descripcion_corta,
  tipo_servicio, nivel_minimo_requerido, indice_minimo,
  precio_referencia_cop, duracion_semanas, modalidad,
  impulsa_eje, puntos_indice_esperados, orden_catalogo
) values
(
  'legal', '{financiera}',
  'Asesoría Jurídica Puntual',
  'Revisión rápida de requisitos legales: habilitación RUP, lectura de pliegos y alertas de incumplimiento normativo. Incluye checklist personalizado por sector.',
  'Revisión exprés de tus requisitos legales',
  'Consultoría', 'inicial', 0,
  800000, 2, 'virtual', 'legal', 150, 1
),
(
  'legal', null,
  'Estructuración RUP',
  'Acompañamiento completo en la inscripción o actualización del Registro Único de Proponentes (RUP) ante la Cámara de Comercio, con gestión de todos los documentos requeridos.',
  'Inscripción o actualización del RUP',
  'Trámite', 'inicial', 0,
  1200000, 3, 'presencial', 'legal', 200, 2
),
(
  'financiera', '{operativa}',
  'Estructuración de Propuestas',
  'Apoyo para calcular la capacidad financiera de la empresa, elaborar presupuestos competitivos y estructurar la oferta económica para cumplir los requisitos habilitantes.',
  'Calcula y estructura tu oferta económica',
  'Asesoría', 'en_desarrollo', 300,
  1500000, 4, 'virtual', 'financiera', 200, 3
),
(
  'financiera', null,
  'Gestión de Pólizas',
  'Asesoría especializada para obtención de garantías de cumplimiento, seriedad de oferta, buen manejo del anticipo y demás pólizas exigidas en los pliegos de condiciones.',
  'Obtén las garantías y pólizas que te piden',
  'Consultoría', 'en_desarrollo', 250,
  600000, 1, 'virtual', 'financiera', 100, 4
),
(
  'comercial', '{oferta}',
  'Mentoría Comercial',
  'Estrategia personalizada para identificar oportunidades en SECOP II, preparar propuestas ganadoras y posicionar la empresa en el mercado público colombiano.',
  'Estrategia para ganar tu primer contrato estatal',
  'Mentoría', 'intermedio', 500,
  2000000, 8, 'mixta', 'comercial', 250, 5
),
(
  'oferta', '{comercial}',
  'Ajuste de Portafolio',
  'Alineación de la oferta de valor de la empresa con el lenguaje y los criterios del mercado público: propuesta de valor, ficha de presentación y diferenciadores competitivos.',
  'Adecua tu oferta al lenguaje del Estado',
  'Taller', 'inicial', 150,
  900000, 2, 'virtual', 'oferta', 150, 6
),
(
  'experiencia', null,
  'Certificación de Calidad',
  'Ruta guiada para obtener ISO 9001 u otras certificaciones clave que aumentan el puntaje técnico en procesos de selección y generan diferenciación competitiva.',
  'Guía para obtener ISO 9001 y certificaciones clave',
  'Asesoría', 'intermedio', 450,
  3500000, 16, 'mixta', 'experiencia', 300, 7
),
(
  'operativa', '{financiera}',
  'Optimización de Procesos',
  'Auditoría de capacidad instalada: tiempos de entrega, recursos humanos, tecnología y logística. Incluye plan de mejora para escalar y cumplir contratos de mayor envergadura.',
  'Auditoría de tu capacidad para contratos grandes',
  'Consultoría', 'en_desarrollo', 350,
  2500000, 6, 'presencial', 'operativa', 200, 8
);

insert into tipos_oportunidad (
  nombre, descripcion, modalidad_contratacion,
  sectores_aplicables, requisitos_por_eje, valor_referencia_cop
) values
(
  'Mínima Cuantía — TI y Software',
  'Contratación directa de software, mantenimiento de sistemas o servicios tecnológicos. Proceso ágil y cuantías bajas, ideal para dar el primer paso.',
  'Mínima cuantía',
  array['Tecnología e Información'],
  '{"legal":35,"financiera":25,"oferta":45,"experiencia":20,"operativa":25,"comercial":20}',
  28000000
),
(
  'Licitación Pública — Infraestructura',
  'Obras civiles o mantenimiento de infraestructura de gran escala. Alta exigencia en capacidad financiera, operativa y experiencia demostrable.',
  'Licitación pública',
  array['Construcción e Infraestructura'],
  '{"legal":75,"financiera":70,"oferta":55,"experiencia":70,"operativa":80,"comercial":45}',
  500000000
),
(
  'Concurso de Méritos — Consultoría',
  'Selección de firma consultora para asesoría técnica, estudios o interventoría. Prioriza la experiencia del equipo y la calidad de la propuesta técnica.',
  'Concurso de méritos',
  array['Consultoría y Capacitación','Tecnología e Información'],
  '{"legal":55,"financiera":35,"oferta":70,"experiencia":65,"operativa":35,"comercial":55}',
  120000000
),
(
  'Selección Abreviada — Suministros',
  'Adquisición de bienes, materiales o equipos para entidades públicas. Proceso más rápido que licitación pero con requisitos financieros y operativos claros.',
  'Selección abreviada',
  array['Suministros y Bienes','Agroindustria'],
  '{"legal":55,"financiera":50,"oferta":45,"experiencia":35,"operativa":55,"comercial":30}',
  80000000
),
(
  'Mínima Cuantía — Servicios Profesionales',
  'Contratos menores para capacitación, asesoría puntual o servicios especializados de corta duración. La puerta de entrada más accesible al mercado público.',
  'Mínima cuantía',
  array['Consultoría y Capacitación','Salud y Servicios Médicos'],
  '{"legal":30,"financiera":20,"oferta":50,"experiencia":40,"operativa":20,"comercial":35}',
  18000000
);

-- Dependencia funcional real del catálogo: para acceder a la Mentoría
-- Comercial conviene ya tener resuelto el frente legal básico (RUP).
insert into dependencias_servicios (servicio_id, prerequisito_id, es_obligatorio)
select m.id, rup.id, false
from catalogo_servicios m, catalogo_servicios rup
where m.nombre_servicio = 'Mentoría Comercial'
  and rup.nombre_servicio = 'Estructuración RUP';

-- Administrador inicial: la contraseña se genera con el script
-- backend/src/scripts/createAdmin.js (nunca se hardcodea el hash aquí).
