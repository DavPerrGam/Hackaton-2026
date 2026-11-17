import { Router } from 'express';
import * as agentController from '../controllers/agentController.js';
import { requirePublicUser } from '../middlewares/authMiddleware.js';
import * as documentController from '../controllers/documentController.js';
import * as opportunityController from '../controllers/opportunityController.js';
import * as formationController from '../controllers/formationController.js';

const router = Router();

router.use(requirePublicUser);
router.post('/sesion', agentController.iniciarSesion);
router.get('/sesion/:sesionId', agentController.obtenerEstado);
router.post('/sesion/:sesionId/respuesta', agentController.responderPaso);
router.post('/sesion/:sesionId/chat', agentController.conversar);
router.post('/sesion/:sesionId/diagnostico', agentController.generarDiagnostico);
router.get('/diagnostico/:diagnosticoId', agentController.obtenerDiagnostico);
router.get('/diagnostico/:diagnosticoId/evolucion', agentController.obtenerEvolucion);
router.get('/alertas', agentController.listarAlertas);
router.patch('/alertas/:alertaId/leida', agentController.marcarAlertaLeida);
router.post('/diagnostico/:diagnosticoId/chat', agentController.conversarDiagnostico);
router.post('/diagnostico/:diagnosticoId/archivos', documentController.recibirArchivo);
router.get('/diagnostico/:diagnosticoId/archivos', documentController.listar);
router.get('/preguntas/:preguntaId/opciones', agentController.opcionesPregunta);
router.get('/oportunidades', opportunityController.listar);
router.post('/diagnostico/:diagnosticoId/oportunidades/:oportunidadId', opportunityController.crearPostulacion);
router.get('/postulaciones/:postulacionId', opportunityController.seguimiento);
router.patch('/postulaciones/:postulacionId', opportunityController.actualizarPostulacion);
router.patch('/tareas/:tareaId', opportunityController.actualizarTarea);
router.post('/postulaciones/:postulacionId/resultados', opportunityController.registrarResultado);
router.post('/postulaciones/:postulacionId/chat', opportunityController.conversar);
router.get('/formaciones', formationController.listar);
router.post('/formaciones/:formacionId/progreso', formationController.iniciar);
router.patch('/formaciones/progreso/:progresoId', formationController.actualizar);
router.post('/formaciones/progreso/:progresoId/reevaluacion', formationController.reevaluar);

export default router;
