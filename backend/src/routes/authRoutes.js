import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/login', authController.login);
router.post('/login-publico', authController.loginPublico);
router.post('/registro', authController.registrar);
router.get('/me', requireAuth, authController.me);

export default router;
