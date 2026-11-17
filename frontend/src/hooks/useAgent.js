import { useCallback, useState } from 'react';
import axiosClient from '../api/axiosClient.js';

function textoChat(valor, fallback = 'No pude generar una respuesta en este momento.') {
  if (typeof valor === 'string' && valor.trim() && valor !== '[object Object]') return valor.trim();
  if (valor && typeof valor === 'object') {
    const anidado = valor.reply || valor.output || valor.text || valor.message;
    if (typeof anidado === 'string' && anidado.trim() && anidado !== '[object Object]') return anidado.trim();
  }
  return fallback;
}

export function useAgent() {
  const [sesionId, setSesionId] = useState(null);
  const [pregunta, setPregunta] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [totalPasos, setTotalPasos] = useState(0);
  const [pasoActual, setPasoActual] = useState(0);
  const [completada, setCompletada] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [bloqueada, setBloqueada] = useState(false);
  // Bloque = etapa del protocolo Nexus en curso. El chat lo anuncia
  // para que la conversación se lea como una consultoría por fases y
  // no como un formulario con un contador de pasos.
  const [bloque, setBloque] = useState(null);

  const iniciar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { data } = await axiosClient.post('/agente/sesion', { canal: 'web' });
      setSesionId(data.sesionId);
      setPregunta(data.pregunta);
      setTotalPasos(data.pregunta?.totalPasos || 0);
      setPasoActual(1);
      setHistorial([{ role: 'agent', content: textoChat(data.pregunta?.prompt) }]);
      setBloque(data.pregunta?.bloque || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  const responder = useCallback(
    // `etiqueta` es la versión legible de una respuesta estructurada
    // (checklist o formulario): en el hilo se lee la frase, no el objeto.
    async (valor, etiqueta) => {
      if (!sesionId) return;
      setCargando(true);
      setError(null);
      setHistorial((h) => [...h, { role: 'user', content: etiqueta ?? String(valor) }]);
      try {
        // Solo el texto libre pasa por interpretación en lenguaje
        // natural. Lo estructurado (sí/no, selects, checklists y
        // formularios) viaja tal cual: no hay nada que interpretar.
        const estructurada = ['boolean', 'select', 'multi', 'form'].includes(pregunta?.type);
        const endpoint = estructurada
          ? `/agente/sesion/${sesionId}/respuesta`
          : `/agente/sesion/${sesionId}/chat`;
        const body = estructurada ? { valor } : { mensaje: valor };
        const { data } = await axiosClient.post(endpoint, body);
        if (data.reply && data.saved === false) {
          setHistorial((h) => [...h, { role: 'agent', content: textoChat(data.reply) }]);
        }

        if (data.saved === false) {
          return;
        }

        setPasoActual(data.paso_actual);
        setTotalPasos(data.totalPasos);
        setCompletada(data.completada);

        // Etapa 12 · memoria inteligente: cuando el agente reconoce a la
        // organización y hereda su ficha, lo dice. Si no lo dijera, el
        // salto de preguntas se leería como un error del sistema.
        if (data.memoria?.mensaje) {
          setHistorial((h) => [...h, { role: 'agent', content: data.memoria.mensaje }]);
        }

        // Lo mismo con lo deducido: si el agente se saltó una pregunta
        // porque dedujo la respuesta, lo declara y deja la puerta
        // abierta a corregirlo. Una deducción silenciosa se lee como un
        // error, y una equivocada que nadie ve es peor que preguntar.
        if (data.inferencias?.length > 0) {
          const deducciones = data.inferencias
            .map((inf) => `${inf.etiqueta} (${inf.valor})`)
            .join(' y ');
          setHistorial((h) => [...h, {
            role: 'agent',
            content: `Con eso ya deduje ${deducciones}, así que no te lo pregunto. Si algo de eso no encaja, dímelo y lo ajustamos.`,
          }]);
        }

        if (data.completada) {
          setHistorial((h) => [
            ...h,
            {
              role: 'agent',
              content: 'Con esto tengo el panorama completo. Estoy consolidando tu diagnóstico: elegibilidad, clasificación sectorial, capacidades, brechas, entidades objetivo y plan de acción…',
            },
          ]);
          const diag = await axiosClient.post(`/agente/sesion/${sesionId}/diagnostico`);
          setResultado(diag.data);
        } else {
          setPregunta(data.pregunta);
          setBloque(data.pregunta?.bloque || null);
          setHistorial((h) => {
            const nuevos = [];
            if (data.pregunta?.inicioDeBloque && data.pregunta?.bloque) {
              nuevos.push({ role: 'bloque', content: data.pregunta.bloque });
            }
            if (data.pregunta?.prompt) {
              nuevos.push({ role: 'agent', content: textoChat(data.pregunta.prompt) });
            }
            return [...h, ...nuevos];
          });
        }
      } catch (err) {
        if (err.status === 403) {
          setBloqueada(true);
          setPregunta(null);
        }
        setError(err.message);
      } finally {
        setCargando(false);
      }
    },
    [sesionId, pregunta]
  );

  return {
    sesionId, pregunta, historial, totalPasos, pasoActual, bloque,
    completada, resultado, cargando, error, bloqueada, iniciar, responder,
  };
}
