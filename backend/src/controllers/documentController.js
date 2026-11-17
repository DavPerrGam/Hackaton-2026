import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as documentService from '../services/documentService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

export const recibirArchivo = [
  upload.single('archivo'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Selecciona un archivo' });
    const documento = await documentService.guardarDocumento({
      diagnosticoId: req.params.diagnosticoId,
      publicUserId: req.publicUser.sub,
      file: req.file,
    });
    res.status(201).json({ documento });
  }),
];

export const listar = asyncHandler(async (req, res) => {
  const documentos = await documentService.listarDocumentos(req.params.diagnosticoId, req.publicUser.sub);
  res.json({ documentos });
});
