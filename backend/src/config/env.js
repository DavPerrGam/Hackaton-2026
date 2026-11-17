import 'dotenv/config';

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    // No lanzamos el proceso en caliente para no tumbar el server en dev
    // sin .env, pero sí dejamos rastro claro en consola.
    console.warn(`[env] Variable ${name} no está definida.`);
  }
  return value;
}

export const env = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',

  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  iaTimeoutMs: Number(process.env.IA_TIMEOUT_MS || 30000),

  // Webhook de n8n (opcional). Vacío = se omite el filtro.
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || '',
  n8nAlertasWebhookUrl: process.env.N8N_ALERTAS_WEBHOOK_URL || '',
  n8nChatWebhookUrl: process.env.N8N_CHAT_WEBHOOK_URL || '',
  n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET || '',
  n8nTimeoutMs: Number(process.env.N8N_TIMEOUT_MS || 45000),

  secopApiUrl: process.env.SECOP_API_URL || '',
  secopApiToken: process.env.SECOP_API_TOKEN || '',
  secopTimeoutMs: Number(process.env.SECOP_TIMEOUT_MS || 30000),
};

const faltantes = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET']
  .filter((nombre) => !process.env[nombre]);
if (faltantes.length && env.nodeEnv !== 'test') {
  throw new Error(`Faltan variables obligatorias: ${faltantes.join(', ')}`);
}
