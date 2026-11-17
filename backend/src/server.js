import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';
import { agentPublicLimiter, authLimiter } from './middlewares/rateLimiter.js';

import agentRoutes from './routes/agentRoutes.js';
import catalogoRoutes from './routes/catalogoRoutes.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { despacharAlertasPendientes } from './services/alertService.js';

const app = express();

app.use(cors({
  origin(origin, callback) {
    const esOrigenLocal = !origin || /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
    callback(null, esOrigenLocal || origin === env.frontendUrl);
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.json({ message: 'API del Agente Inteligente IDEAPRO funcionando correctamente' });
});

app.use('/api/agente', agentPublicLimiter, agentRoutes);
app.use('/api/catalogo', catalogoRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const alertasCadaMs = Number(process.env.ALERTAS_INTERVAL_MS || 300000);
const alertasTimer = setInterval(() => {
  despacharAlertasPendientes().catch((error) => console.warn('[alertas] despacho fallido:', error.message));
}, alertasCadaMs);
alertasTimer.unref?.();

app.listen(env.port, () => {
  console.log(`[server] Agente IDEAPRO escuchando en http://localhost:${env.port}`);
});
