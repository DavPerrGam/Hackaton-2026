import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { requireAuth, requireAdminRole } from '../middlewares/authMiddleware.js';

const router = Router();

// Todo el panel administrativo (seguimiento de empresas y
// diagnósticos) exige un token válido de administrador.
router.use(requireAuth);

router.get('/empresas', adminController.listarEmpresas);
router.get('/empresas/:empresaId', adminController.obtenerEmpresa);
router.get('/empresas/:empresaId/diagnosticos', adminController.listarDiagnosticosPorEmpresa);
router.get('/usuarios-publicos', adminController.listarUsuariosPublicos);
router.get('/oportunidades', adminController.listarOportunidades);
router.post('/oportunidades', adminController.crearOportunidad);
router.patch('/oportunidades/:oportunidadId', adminController.actualizarOportunidad);
router.post('/oportunidades/sincronizar-secop', requireAdminRole('superadmin'), adminController.sincronizarSecop);

export default router;
