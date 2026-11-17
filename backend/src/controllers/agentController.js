import { asyncHandler } from '../utils/asyncHandler.js';
import * as agentService from '../services/agentService.js';
import * as catalogoService from '../services/catalogoService.js';
import { QUESTIONS } from '../agent/questions.js';
import * as alertService from '../services/alertService.js';

export const iniciarSesion = asyncHandler(async (req, res) => {
  const { canal } = req.body || {};
  const resultado = await agentService.iniciarSesion({
    canal,
    publicUserId: req.publicUser.sub,
    publicUserEmail: req.publicUser.correo,
  });
  res.status(201).json(resultado);
});

export const obtenerEstado = asyncHandler(async (req, res) => {
  const estado = await agentService.obtenerEstadoSesion(req.params.sesionId, req.publicUser.sub);
  res.json(estado);
});

export const responderPaso = asyncHandler(async (req, res) => {
  const { valor } = req.body;
  const resultado = await agentService.responderPaso(req.params.sesionId, valor, { publicUserId: req.publicUser.sub });
  res.json(resultado);
});

export const conversar = asyncHandler(async (req, res) => {
  const resultado = await agentService.conversar(req.params.sesionId, req.body?.mensaje, req.publicUser.sub);
  res.json(resultado);
});

export const generarDiagnostico = asyncHandler(async (req, res) => {
  const resultado = await agentService.generarDiagnostico(req.params.sesionId, req.publicUser.sub);
  res.status(201).json(resultado);
});

export const obtenerDiagnostico = asyncHandler(async (req, res) => {
  const resultado = await agentService.obtenerDiagnosticoCompleto(req.params.diagnosticoId, req.publicUser.sub);
  res.json(resultado);
});

export const conversarDiagnostico = asyncHandler(async (req, res) => {
  const resultado = await agentService.conversarDiagnostico(
    req.params.diagnosticoId,
    req.body?.mensaje,
    req.publicUser.sub
  );
  res.json(resultado);
});

export const obtenerEvolucion = asyncHandler(async (req, res) => {
  const evolucion = await agentService.obtenerEvolucionDiagnostico(req.params.diagnosticoId, req.publicUser.sub);
  res.json(evolucion);
});

export const listarAlertas = asyncHandler(async (req, res) => {
  const alertas = await alertService.listarAlertas({ diagnosticoId: req.query.diagnosticoId, publicUserId: req.publicUser.sub });
  res.json(alertas);
});

export const marcarAlertaLeida = asyncHandler(async (req, res) => {
  const alerta = await alertService.marcarLeida({
    alertaId: req.params.alertaId,
    diagnosticoId: req.body?.diagnosticoId,
    publicUserId: req.publicUser.sub,
  });
  res.json(alerta);
});

// Expone las opciones (p. ej. sectores) que el frontend necesita para
// renderizar preguntas tipo "select" sin hardcodear nada.
export const opcionesPregunta = asyncHandler(async (req, res) => {
  const pregunta = QUESTIONS.find((q) => q.id === req.params.preguntaId);
  if (!pregunta) return res.status(404).json({ error: 'Pregunta no encontrada' });

  if (pregunta.options) return res.json({ options: pregunta.options });

  if (pregunta.optionsSource === 'sectores') {
    const sectores = await catalogoService.listarSectores();
    return res.json({ options: sectores.map((s) => ({ value: s.nombre, label: s.nombre })) });
  }

  res.json({ options: [] });
});
