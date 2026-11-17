import { useState } from 'react';
import EjesRadar from './EjesRadar.jsx';
import RutaRecomendada from './RutaRecomendada.jsx';
import EncajeOportunidades from './EncajeOportunidades.jsx';
import DiagnosticoChat from './DiagnosticoChat.jsx';
import SeguimientoOportunidad from './SeguimientoOportunidad.jsx';
import FormacionPanel from './FormacionPanel.jsx';
import EvolucionDiagnostico from './EvolucionDiagnostico.jsx';
import AlertasOportunidad from './AlertasOportunidad.jsx';
import EstadoElegibilidad from './EstadoElegibilidad.jsx';
import ClasificacionSectorial from './ClasificacionSectorial.jsx';
import PerfilamientoOferta from './PerfilamientoOferta.jsx';
import EntidadesObjetivo from './EntidadesObjetivo.jsx';
import PlanAccion from './PlanAccion.jsx';
import BrechasPorFamilia from './BrechasPorFamilia.jsx';
import NivelMadurez from './NivelMadurez.jsx';
import TagsOrganizacion from './TagsOrganizacion.jsx';
import OrganizacionesSimilares from './OrganizacionesSimilares.jsx';

const NIVEL_LABEL = {
  inicial: 'Exploración',
  exploracion: 'Exploración',
  en_desarrollo: 'Preparación',
  preparacion: 'Preparación',
  intermedio: 'Lista para explorar',
  lista_para_explorar: 'Lista para explorar',
  avanzado: 'Preparada',
  preparada: 'Preparada',
  consolidada: 'Consolidada',
};

const BADGE_ELEGIBILIDAD = {
  elegible: { clase: 'success', texto: 'Elegible' },
  riesgo: { clase: 'warning', texto: 'Riesgo de elegibilidad' },
  no_elegible: { clase: 'danger', texto: 'No elegible' },
};

// El reporte tiene 20 secciones: mostrarlas en una sola columna
// convierte un diagnóstico consultivo en un muro de texto. Se agrupan
// en cuatro vistas que siguen la lógica con la que un consultor
// presenta el resultado.
const VISTAS = [
  { id: 'diagnostico', titulo: 'Diagnóstico', icono: 'bi-clipboard-data' },
  { id: 'perfil', titulo: 'Perfil y oportunidades', icono: 'bi-diagram-3' },
  { id: 'ruta', titulo: 'Ruta y plan de acción', icono: 'bi-signpost-split' },
  { id: 'seguimiento', titulo: 'Seguimiento', icono: 'bi-graph-up-arrow' },
];

export default function DiagnosticoResumen({ resultado }) {
  const [vista, setVista] = useState('diagnostico');
  const { diagnostico, ruta, encaje } = resultado;

  const scores = {
    oferta: diagnostico.score_oferta,
    experiencia: diagnostico.score_experiencia,
    operativa: diagnostico.score_operativa,
    legal: diagnostico.score_legal,
    financiera: diagnostico.score_financiera,
    comercial: diagnostico.score_comercial,
  };
  const dimensiones = diagnostico.dimensiones_ideapro || {
    tecnica: Math.round((scores.experiencia + scores.operativa) / 2),
    juridica_documental: scores.legal,
    financiera: scores.financiera,
    oferta_propuesta_valor: scores.oferta,
    ecosistema_publico: scores.comercial,
  };

  const brechasPorFamilia = diagnostico.brechas_por_familia || [];
  const brechasPorEje = diagnostico.brechas || [];
  const elegibilidad = diagnostico.elegibilidad;
  const reporte = diagnostico.reporte_final;

  // El nivel numérico se reconstruye desde el reporte cuando la base de
  // datos aún no tiene la migración Nexus aplicada.
  const seccionMadurez = reporte?.secciones?.find((s) => s.id === 'nivel_madurez')?.contenido;
  const seccionPerfilamiento = reporte?.secciones?.find((s) => s.id === 'perfilamiento_oferta')?.contenido;
  const nivel = seccionMadurez || (diagnostico.nivel_madurez_numero
    ? { nivel: diagnostico.nivel_madurez_numero, nombre: NIVEL_LABEL[diagnostico.nivel_madurez_global] }
    : null);

  const badge = BADGE_ELEGIBILIDAD[elegibilidad?.estado || diagnostico.estado_elegibilidad];

  return (
    <div className="py-4">
      {/* Encabezado ejecutivo */}
      <div className="ip-card p-4 mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <div>
            <span className="ip-section-title">Resultado del diagnóstico</span>
            <h3 className="mb-0">{diagnostico.empresas?.nombre}</h3>
            {badge && <span className={`badge bg-${badge.clase} mt-2`}>{badge.texto}</span>}
          </div>
          <div className="text-end">
            <div className="fs-2 fw-bold" style={{ color: 'var(--ip-azul-900)' }}>
              {diagnostico.indice_ideapro}<span className="fs-6 text-secondary">/1000</span>
            </div>
            <span className="ip-badge-nivel">
              {nivel?.nivel ? `Nivel ${nivel.nivel} · ` : 'Nivel '}
              {NIVEL_LABEL[diagnostico.nivel_madurez_global]}
            </span>
          </div>
        </div>
        <p className="mb-0">{diagnostico.resumen_ia}</p>
      </div>

      {/* Navegación entre vistas del reporte */}
      <ul className="nav nav-pills gap-2 mb-4 flex-nowrap overflow-auto pb-1">
        {VISTAS.map((item) => (
          <li className="nav-item" key={item.id}>
            <button
              type="button"
              className={`nav-link ${vista === item.id ? 'active' : ''}`}
              onClick={() => setVista(item.id)}
            >
              <i className={`bi ${item.icono} me-1`} />
              {item.titulo}
            </button>
          </li>
        ))}
      </ul>

      {vista === 'diagnostico' && (
        <>
          <EstadoElegibilidad elegibilidad={elegibilidad} />

          <div className="row g-4">
            <div className="col-lg-5">
              <NivelMadurez nivel={nivel} riesgoFinanciero={diagnostico.riesgo_financiero_detalle} />

              <h6 className="mt-4 mb-3">Dimensiones IDEAPRO</h6>
              <div className="ip-card p-4">
                {Object.entries(dimensiones).map(([dimension, valor]) => (
                  <div className="d-flex justify-content-between border-bottom py-2" key={dimension}>
                    <span className="text-capitalize">{dimension.replaceAll('_', ' ')}</span>
                    <strong>{valor}/100</strong>
                  </div>
                ))}
              </div>

              <h6 className="mt-4 mb-3">Tu radar de madurez</h6>
              <div className="ip-card p-4">
                <EjesRadar scores={scores} />
              </div>
            </div>

            <div className="col-lg-7">
              <h6 className="mb-3">Brechas por familia</h6>
              {brechasPorFamilia.length > 0 ? (
                <BrechasPorFamilia brechas={brechasPorFamilia} />
              ) : (
                <div className="ip-card p-4">
                  {brechasPorEje.slice(0, 4).map((brecha) => (
                    <div className="d-flex justify-content-between align-items-start gap-3 py-2 border-bottom" key={brecha.eje}>
                      <div>
                        <strong>{brecha.nombre}</strong>
                        <div className="small text-secondary">
                          {brecha.severidad} · déficit de {brecha.deficit} puntos
                          {brecha.faltantes?.length ? ` · Falta: ${brecha.faltantes.join(', ')}` : ''}
                        </div>
                      </div>
                      <span className="ip-badge-nivel">{brecha.score}/100</span>
                    </div>
                  ))}
                  {!brechasPorEje.length && <p className="mb-0 text-secondary">No se identificaron brechas críticas.</p>}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {vista === 'perfil' && (
        <div className="row g-4">
          <div className="col-lg-6">
            <ClasificacionSectorial clasificacion={diagnostico.clasificacion_sectorial} />
            <div className="mt-4">
              <TagsOrganizacion tags={diagnostico.tags} />
            </div>
            <div className="mt-4">
              <EntidadesObjetivo entidadesObjetivo={diagnostico.entidades_objetivo} />
            </div>
          </div>
          <div className="col-lg-6">
            <PerfilamientoOferta
              perfilamiento={diagnostico.perfilamiento_oferta}
              profundizacion={seccionPerfilamiento?.profundizacion || []}
            />
            <div className="mt-4">
              <OrganizacionesSimilares relaciones={diagnostico.organizaciones_similares} />
            </div>
            <h6 className="mt-4 mb-3">Oportunidades priorizadas</h6>
            <EncajeOportunidades encaje={encaje} />
          </div>
        </div>
      )}

      {vista === 'ruta' && (
        <>
          <h6 className="mb-3">Tu ruta de crecimiento recomendada</h6>
          <RutaRecomendada ruta={ruta} />
          <PlanAccion planAccion={diagnostico.plan_accion} />
        </>
      )}

      {vista === 'seguimiento' && (
        <>
          <SeguimientoOportunidad diagnosticoId={diagnostico.id} />
          <FormacionPanel diagnosticoId={diagnostico.id} />
          <EvolucionDiagnostico diagnosticoId={diagnostico.id} />
          <AlertasOportunidad diagnosticoId={diagnostico.id} />
        </>
      )}

      <div className="ip-result-chat">
        <DiagnosticoChat diagnosticoId={diagnostico.id} />
      </div>
    </div>
  );
}
