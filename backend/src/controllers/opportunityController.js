import { asyncHandler } from '../utils/asyncHandler.js';
import * as opportunityService from '../services/opportunityService.js';

export const listar = asyncHandler(async (req, res) => {
  const data = await opportunityService.listarOportunidades({
    diagnosticoId: req.query.diagnosticoId,
    publicUserId: req.publicUser.sub,
  });
  res.json({ data });
});

export const crearPostulacion = asyncHandler(async (req, res) => {
  const data = await opportunityService.crearPostulacion({
    diagnosticoId: req.params.diagnosticoId,
    oportunidadId: req.params.oportunidadId,
    publicUserId: req.publicUser.sub,
    perfilamiento: req.body?.perfilamiento,
  });
  res.status(201).json(data);
});

export const seguimiento = asyncHandler(async (req, res) => {
  res.json(await opportunityService.obtenerSeguimiento(req.params.postulacionId, req.publicUser.sub));
});

export const actualizarPostulacion = asyncHandler(async (req, res) => {
  res.json(await opportunityService.actualizarPostulacion(req.params.postulacionId, req.publicUser.sub, req.body || {}));
});

export const actualizarTarea = asyncHandler(async (req, res) => {
  res.json(await opportunityService.actualizarTarea(req.params.tareaId, req.publicUser.sub, req.body || {}));
});

export const registrarResultado = asyncHandler(async (req, res) => {
  res.status(201).json(await opportunityService.registrarResultado(req.params.postulacionId, req.publicUser.sub, req.body || {}));
});

export const conversar = asyncHandler(async (req, res) => {
  res.json(await opportunityService.conversarSeguimiento(req.params.postulacionId, req.publicUser.sub, req.body?.mensaje));
});
