import { ApiError } from '../utils/ApiError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    console.error(`[error] ${req.method} ${req.originalUrl} ->`, err.message, err.details || '');
    const respuesta = { error: err.message };
    if (err.details && process.env.NODE_ENV !== 'production') respuesta.details = err.details;
    return res.status(err.statusCode).json(respuesta);
  }

  console.error('[error]', err);
  const status = err.statusCode || 500;
  res.status(status).json({
    error: status === 500 ? 'Error interno del servidor' : err.message,
  });
}