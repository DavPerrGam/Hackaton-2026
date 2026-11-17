// Uso: npm run create-admin -- "Nombre Apellido" correo@ideapro.com ClaveSegura123*
import 'dotenv/config';
import { crearAdministrador } from '../services/authService.js';

const [, , nombre, correo, password] = process.argv;

if (!nombre || !correo || !password) {
  console.error('Uso: npm run create-admin -- "Nombre" correo@ideapro.com ClaveSegura123*');
  process.exit(1);
}

try {
  const admin = await crearAdministrador({ nombre, correo, password, rol: 'superadmin' });
  console.log('Administrador creado:', admin);
} catch (err) {
  console.error('No se pudo crear el administrador:', err.message);
  process.exit(1);
}
