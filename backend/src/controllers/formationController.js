import { asyncHandler } from '../utils/asyncHandler.js';
import * as formationService from '../services/formationService.js';

export const listar = asyncHandler(async (req, res) => {
  res.json(await formationService.listar({ diagnosticoId: req.query.diagnosticoId, publicUserId: req.publicUser.sub }));
});

export const iniciar = asyncHandler(async (req, res) => {
  res.status(201).json(await formationService.iniciarProgreso({
    formacionId: req.params.formacionId,
    diagnosticoId: req.body?.diagnosticoId,
    publicUserId: req.publicUser.sub,
  }));
});

export const actualizar = asyncHandler(async (req, res) => {
  res.json(await formationService.actualizarProgreso({
    progresoId: req.params.progresoId,
    publicUserId: req.publicUser.sub,
    estado: req.body?.estado,
    resultado: req.body?.resultado,
  }));
});

export const reevaluar = asyncHandler(async (req, res) => {
  res.json(await formationService.vincularReevaluacion({
    progresoId: req.params.progresoId,
    diagnosticoId: req.body?.diagnosticoId,
    publicUserId: req.publicUser.sub,
  }));
});
