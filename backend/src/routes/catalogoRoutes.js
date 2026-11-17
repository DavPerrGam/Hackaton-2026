import { Router } from 'express';
import * as catalogoController from '../controllers/catalogoController.js';

const router = Router();

router.get('/', catalogoController.listarCatalogo);
router.get('/sectores', catalogoController.listarSectores);
router.get('/oportunidades', catalogoController.listarOportunidades);
router.get('/oportunidades/reales', catalogoController.listarOportunidadesReales);

export default router;
