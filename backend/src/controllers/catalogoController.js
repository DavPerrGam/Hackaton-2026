import { asyncHandler } from '../utils/asyncHandler.js';
import * as catalogoService from '../services/catalogoService.js';

export const listarCatalogo = asyncHandler(async (req, res) => {
  const catalogo = await catalogoService.listarCatalogoActivo();
  res.json(catalogo);
});

export const listarSectores = asyncHandler(async (req, res) => {
  const sectores = await catalogoService.listarSectores();
  res.json(sectores);
});

export const listarOportunidades = asyncHandler(async (req, res) => {
  const oportunidades = await catalogoService.listarTiposOportunidad();
  res.json(oportunidades);
});

export const listarOportunidadesReales = asyncHandler(async (req, res) => {
  const oportunidades = await catalogoService.listarOportunidadesReales();
  res.json(oportunidades);
});
