import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../utils/ApiError.js';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';

const BUCKET = 'ideapro-documentos';
const MAX_TEXT = 100_000;
const ALLOWED = new Map([
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function firmaValida(buffer, tipo) {
  if (!buffer || buffer.length < 4) return false;
  if (tipo === 'pdf') return buffer.subarray(0, 4).toString() === '%PDF';
  if (tipo === 'docx' || tipo === 'xlsx') return buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (tipo === 'jpg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (tipo === 'png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (tipo === 'webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  return false;
}

function clasificarDocumento(nombre) {
  const texto = String(nombre || '').toLowerCase();
  if (/rup|proponente/.test(texto)) return 'rup';
  if (/camara|comercio|existencia|representacion/.test(texto)) return 'registro_legal';
  if (/financ|balance|declaracion|renta|impuesto/.test(texto)) return 'financiero';
  if (/poliza|garantia|seguro/.test(texto)) return 'garantia';
  if (/experiencia|contrato|certificacion/.test(texto)) return 'experiencia';
  if (/portafolio|propuesta|catalogo/.test(texto)) return 'oferta';
  return 'sin_clasificar';
}

async function extraerTexto(file, tipo) {
  if (tipo === 'pdf') {
    const parser = new PDFParse({ data: file.buffer });
    const resultado = await parser.getText();
    await parser.destroy();
    return resultado.text;
  }
  if (tipo === 'docx') {
    const resultado = await mammoth.extractRawText({ buffer: file.buffer });
    return resultado.value;
  }
  if (tipo === 'xlsx' || tipo === 'xls') {
    if (tipo === 'xls') throw new Error('Los archivos XLS antiguos no son compatibles; conviértelos a XLSX.');
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(file.buffer, { worksheets: 'emit' });
    const hojas = libro.worksheets.slice(0, 20);
    return hojas.map((hoja) => {
      const filas = [];
      hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
        if (numero <= 10_000) filas.push(fila.values.slice(1).join(','));
      });
      return `Hoja: ${hoja.name}\n${filas.join('\n')}`;
    }).join('\n\n');
  }
  return '';
}

async function verificarAcceso(diagnosticoId, publicUserId) {
  const { data, error } = await supabaseAdmin
    .from('diagnosticos')
    .select('id, sesiones!inner(usuario_publico_id)')
    .eq('id', diagnosticoId)
    .eq('sesiones.usuario_publico_id', publicUserId)
    .maybeSingle();
  if (error) throw new ApiError(500, 'No se pudo verificar el acceso al diagnóstico', error.message);
  if (!data) throw new ApiError(404, 'Diagnóstico no encontrado para esta sesión');
}

export async function guardarDocumento({ diagnosticoId, publicUserId, file }) {
  await verificarAcceso(diagnosticoId, publicUserId);
  const tipo = ALLOWED.get(file.mimetype);
  if (!tipo) throw new ApiError(400, 'Tipo de archivo no permitido. Usa PDF, DOCX, XLSX, JPG, PNG o WEBP.');
  if (file.size > 10 * 1024 * 1024) throw new ApiError(413, 'El archivo no puede superar 10 MB.');
  if (!firmaValida(file.buffer, tipo)) throw new ApiError(400, 'El contenido del archivo no coincide con su tipo declarado.');

  let texto;
  try {
    texto = (await extraerTexto(file, tipo)).slice(0, MAX_TEXT);
  } catch (error) {
    throw new ApiError(400, 'No se pudo leer el contenido del archivo', error.message);
  }

  const nombreSeguro = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const categoria = clasificarDocumento(file.originalname);
  const ruta = `${publicUserId}/${diagnosticoId}/${crypto.randomUUID()}-${nombreSeguro}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(ruta, file.buffer, { contentType: file.mimetype, upsert: false });
  if (uploadError) throw new ApiError(500, 'No se pudo guardar el archivo. Verifica el bucket de Supabase.', uploadError.message);

  const { data, error } = await supabaseAdmin
    .from('documentos_chat')
    .insert({
      diagnostico_id: diagnosticoId,
      usuario_publico_id: publicUserId,
      nombre_original: file.originalname,
      mime_type: file.mimetype,
      tamano_bytes: file.size,
      storage_path: ruta,
      texto_extraido: texto || null,
      categoria,
      estado_vigencia: 'sin_verificar',
    })
    .select('id, nombre_original, mime_type, tamano_bytes, texto_extraido, created_at')
    .single();

  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([ruta]);
    throw new ApiError(500, 'No se pudo registrar el documento', error.message);
  }
  return {
    ...data,
    tieneTexto: Boolean(texto),
    categoria,
    aviso: 'Este documento es evidencia de alistamiento; IDEAPRO no emite conceptos jurídicos definitivos. Verifica los requisitos con un profesional competente.'
      + (texto ? '' : ' La imagen quedó adjunta; se procesará visualmente cuando el flujo de IA lo permita.'),
  };
}

export async function listarDocumentos(diagnosticoId, publicUserId) {
  await verificarAcceso(diagnosticoId, publicUserId);
  const { data, error } = await supabaseAdmin
    .from('documentos_chat')
    .select('id, nombre_original, mime_type, tamano_bytes, texto_extraido, categoria, fecha_vigencia, estado_vigencia, created_at')
    .eq('diagnostico_id', diagnosticoId)
    .order('created_at', { ascending: true });
  if (error) throw new ApiError(500, 'No se pudieron cargar los documentos', error.message);
  return data;
}
