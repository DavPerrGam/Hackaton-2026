import { asyncHandler } from '../utils/asyncHandler.js';
import * as empresaService from '../services/empresaService.js';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../utils/ApiError.js';
import * as opportunityService from '../services/opportunityService.js';
import * as secopService from '../services/secopService.js';

async function registrarAuditoria(req, accion, modulo, registroId, descripcion) {
  const { error } = await supabaseAdmin.from('bitacora_auditoria').insert({
    administrador_id: req.admin?.sub,
    accion,
    modulo,
    registro_id: registroId || null,
    descripcion,
    ip: req.ip,
  });
  if (error) console.warn('[auditoria] no se pudo registrar la acción:', error.message);
}

export const listarEmpresas = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const resultado = await empresaService.listarEmpresas({ limit, offset });
  res.json(resultado);
});

export const obtenerEmpresa = asyncHandler(async (req, res) => {
  const empresa = await empresaService.obtenerEmpresa(req.params.empresaId);
  res.json(empresa);
});

export const listarDiagnosticosPorEmpresa = asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('diagnosticos')
    .select('*')
    .eq('empresa_id', req.params.empresaId)
    .order('created_at', { ascending: false });
  if (error) throw new ApiError(500, 'No se pudieron cargar los diagnósticos', error.message);
  res.json(data);
});

export const listarUsuariosPublicos = asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('usuarios_publicos')
    .select('id, nombre, correo, estado, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new ApiError(500, 'No se pudieron cargar los registros públicos', error.message);
  res.json({ data });
});

export const listarOportunidades = asyncHandler(async (req, res) => {
  res.json({ data: await opportunityService.listarOportunidadesAdmin() });
});

export const crearOportunidad = asyncHandler(async (req, res) => {
  const oportunidad = await opportunityService.crearOportunidadAdmin(req.body || {});
  await registrarAuditoria(req, 'crear', 'oportunidades', oportunidad.id, `Creó ${oportunidad.nombre}`);
  res.status(201).json(oportunidad);
});

export const actualizarOportunidad = asyncHandler(async (req, res) => {
  const oportunidad = await opportunityService.actualizarOportunidadAdmin(req.params.oportunidadId, req.body || {});
  await registrarAuditoria(req, 'actualizar', 'oportunidades', oportunidad.id, `Actualizó ${oportunidad.nombre}`);
  res.json(oportunidad);
});

export const sincronizarSecop = asyncHandler(async (req, res) => {
  const resultado = await secopService.sincronizarOportunidadesSecop({ limite: req.body?.limite });
  await registrarAuditoria(req, 'sincronizar', 'secop_ii', null, JSON.stringify(resultado));
  res.json(resultado);
});
