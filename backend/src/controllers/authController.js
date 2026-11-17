import { asyncHandler } from '../utils/asyncHandler.js';
import * as authService from '../services/authService.js';

export const login = asyncHandler(async (req, res) => {
  const { correo, password } = req.body;
  if (!correo || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  }
  const resultado = await authService.login(correo, password);
  res.json(resultado);
});

export const registrar = asyncHandler(async (req, res) => {
  const { nombre, correo, password } = req.body || {};
  const resultado = await authService.registrarUsuarioPublico({ nombre, correo, password });
  res.status(201).json({ ...resultado, mensaje: 'Registro público creado correctamente' });
});

export const loginPublico = asyncHandler(async (req, res) => {
  const { correo, password } = req.body || {};
  if (!correo || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  }
  res.json(await authService.loginUsuarioPublico(correo, password));
});

export const me = asyncHandler(async (req, res) => {
  res.json({ admin: req.admin });
});
