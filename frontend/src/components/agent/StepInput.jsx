import { useEffect, useMemo, useState } from 'react';
import axiosClient from '../../api/axiosClient.js';

// Un campo de un formulario compuesto solo se muestra si su condición
// declarativa se cumple contra lo que la persona lleva diligenciado.
// Así "¿cuántos contratos?" aparece en el momento en que marca que sí
// ha contratado, y no antes.
function campoVisible(campo, valores) {
  if (!campo.mostrarSi) return true;
  return valores[campo.mostrarSi.campo] === campo.mostrarSi.igual;
}

function CampoFormulario({ campo, valor, onChange, disabled }) {
  if (campo.type === 'boolean') {
    return (
      <div className="d-flex gap-2">
        <button
          type="button"
          className={`btn flex-fill ${valor === true ? 'ip-btn-primary' : 'btn-outline-secondary'}`}
          disabled={disabled}
          onClick={() => onChange(true)}
        >
          Sí
        </button>
        <button
          type="button"
          className={`btn flex-fill ${valor === false ? 'ip-btn-primary' : 'btn-outline-secondary'}`}
          disabled={disabled}
          onClick={() => onChange(false)}
        >
          No
        </button>
      </div>
    );
  }

  if (campo.type === 'select') {
    return (
      <select
        className="form-select"
        value={valor ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecciona una opción…</option>
        {(campo.options || []).map((op) => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>
    );
  }

  if (campo.type === 'textarea') {
    return (
      <textarea
        className="form-control"
        rows={2}
        placeholder={campo.placeholder || ''}
        value={valor ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <input
      type={campo.type === 'number' ? 'number' : 'text'}
      min={campo.type === 'number' ? 0 : undefined}
      className="form-control"
      placeholder={campo.placeholder || ''}
      value={valor ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(campo.type === 'number' ? e.target.value : e.target.value)}
    />
  );
}

export default function StepInput({ pregunta, onSubmit, disabled }) {
  const [valor, setValor] = useState('');
  const [seleccion, setSeleccion] = useState([]);
  const [formulario, setFormulario] = useState({});
  const [opciones, setOpciones] = useState((pregunta?.options || pregunta?.campos || []).filter(Boolean));
  const [validacion, setValidacion] = useState('');

  useEffect(() => {
    setValor('');
    setSeleccion([]);
    setFormulario({});
    setValidacion('');
    const opcionesBase = pregunta?.options || pregunta?.campos || [];
    if (pregunta.optionsSource && !pregunta.options) {
      axiosClient
        .get(`/agente/preguntas/${pregunta.id}/opciones`)
        .then((res) => setOpciones(Array.isArray(res.data.options) ? res.data.options : []))
        .catch(() => setOpciones([]));
    } else {
      setOpciones(opcionesBase.filter(Boolean));
    }
  }, [pregunta]);

  const camposVisibles = useMemo(
    () => (pregunta.campos || []).filter((campo) => campoVisible(campo, formulario)),
    [pregunta.campos, formulario]
  );

  const opcionesPregunta = useMemo(
    () => (pregunta.type === 'multi' ? (pregunta.campos || opciones || []) : (opciones || [])),
    [pregunta.type, pregunta.campos, opciones]
  );

  const enviar = (v, etiqueta) => {
    if (pregunta.required && (v === '' || v === undefined)) return;
    if (pregunta.id === 'anios_operacion' && Number(v) < 1) {
      setValidacion('Para continuar, la empresa debe llevar al menos 1 año operando.');
      return;
    }
    setValidacion('');
    onSubmit(v, etiqueta);
  };

  // ------------------------------------------------- checklist (multi)
  // Un checklist es UNA conversación, no seis preguntas de sí/no. No
  // marcar nada es una respuesta legítima y también dice algo, así que
  // el botón nunca se bloquea.
  if (pregunta.type === 'multi') {
    const alternar = (value) => {
      setSeleccion((actual) => (
        actual.includes(value) ? actual.filter((v) => v !== value) : [...actual, value]
      ));
    };
    const etiquetaDe = (value) => (pregunta.campos || opcionesPregunta || []).find((c) => (c.id ?? c.value) === value)?.label || value;

    return (
      <div>
        <div className="small text-secondary mb-2">Marca todas las que apliquen.</div>
        <div className="d-flex flex-column gap-2 mb-3">
          {(pregunta.campos || opcionesPregunta || []).map((campo) => {
            const valorCampo = campo.id ?? campo.value;
            return (
              <label key={valorCampo} className="d-flex gap-2 align-items-start" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  className="form-check-input mt-1 flex-shrink-0"
                  checked={seleccion.includes(valorCampo)}
                  disabled={disabled}
                  onChange={() => alternar(valorCampo)}
                />
                <span className="small">{campo.label}</span>
              </label>
            );
          })}
        </div>
        <button
          type="button"
          className="btn ip-btn-primary w-100"
          disabled={disabled}
          onClick={() => enviar(
            seleccion,
            seleccion.length > 0 ? seleccion.map(etiquetaDe).join(' · ') : 'Ninguna de las anteriores'
          )}
        >
          Continuar
        </button>
      </div>
    );
  }

  // ------------------------------------------------ formulario (form)
  // Varios campos en una sola burbuja: es como pregunta un consultor
  // ("¿ciudad, departamento y web?"), no como pregunta un formulario.
  if (pregunta.type === 'form') {
    const faltantes = camposVisibles.filter((campo) => {
      if (!campo.required) return false;
      const dato = formulario[campo.id];
      return dato === undefined || dato === '';
    });

    const actualizar = (id, dato) => setFormulario((actual) => ({ ...actual, [id]: dato }));

    return (
      <form
        className="d-flex flex-column gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (faltantes.length > 0) {
            setValidacion(`Falta responder: ${faltantes.map((c) => c.label).join(', ')}.`);
            return;
          }
          const limpio = {};
          for (const campo of camposVisibles) {
            const dato = formulario[campo.id];
            if (dato !== undefined && dato !== '') limpio[campo.id] = dato;
          }
          const etiqueta = camposVisibles
            .filter((campo) => limpio[campo.id] !== undefined)
            .map((campo) => {
              const dato = limpio[campo.id];
              if (campo.type === 'boolean') return `${campo.label}: ${dato ? 'Sí' : 'No'}`;
              if (campo.type === 'select') {
                const op = (campo.options || []).find((o) => o.value === dato);
                return `${campo.label}: ${op?.label || dato}`;
              }
              return `${campo.label}: ${dato}`;
            })
            .join(' · ');
          enviar(limpio, etiqueta);
        }}
      >
        {camposVisibles.map((campo) => (
          <div key={campo.id}>
            <label className="form-label small fw-semibold mb-1">
              {campo.label}
              {!campo.required && <span className="text-secondary fw-normal"> · opcional</span>}
            </label>
            <CampoFormulario
              campo={campo}
              valor={formulario[campo.id]}
              onChange={(dato) => actualizar(campo.id, dato)}
              disabled={disabled}
            />
          </div>
        ))}
        {validacion && <div className="text-danger small">{validacion}</div>}
        <button type="submit" className="btn ip-btn-primary" disabled={disabled}>
          Continuar
        </button>
      </form>
    );
  }

  if (pregunta.type === 'boolean') {
    return (
      <div className="d-flex gap-2">
        <button className="btn ip-btn-primary flex-fill" disabled={disabled} onClick={() => enviar(true, 'Sí')}>
          Sí
        </button>
        <button className="btn btn-outline-secondary flex-fill" disabled={disabled} onClick={() => enviar(false, 'No')}>
          No
        </button>
      </div>
    );
  }

  if (pregunta.type === 'select') {
    return (
      <div className="ip-step-form d-flex align-items-center gap-3">
        <select
          className="form-select ip-step-select"
          value={valor}
          disabled={disabled}
          onChange={(e) => setValor(e.target.value)}
        >
          <option value="">Selecciona una opción…</option>
          {opciones.map((op) => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>
        <button
          className="btn ip-btn-primary ip-step-submit"
          disabled={disabled || !valor}
          onClick={() => enviar(valor, opciones.find((o) => o.value === valor)?.label || valor)}
        >
          Enviar
        </button>
      </div>
    );
  }

  const esNumeroLibre = pregunta.type === 'number' && !['anios_operacion', 'tamanio_equipo'].includes(pregunta.id);

  return (
    <form
      className="ip-step-form d-flex align-items-end gap-3 flex-wrap"
      onSubmit={(e) => {
        e.preventDefault();
        enviar(valor.trim());
      }}
    >
      {pregunta.type === 'textarea' ? (
        <textarea
          className="form-control ip-step-input"
          rows={3}
          placeholder="Escribe tu respuesta…"
          value={valor}
          disabled={disabled}
          onChange={(e) => setValor(e.target.value)}
          autoFocus
        />
      ) : (
        <input
          type={esNumeroLibre ? 'number' : 'text'}
          min={esNumeroLibre ? 0 : undefined}
          className="form-control ip-step-input"
          placeholder={pregunta.id === 'anios_operacion'
            ? 'Ej: 2 años o 18 meses'
            : pregunta.id === 'tamanio_equipo'
              ? 'Ej: 120 personas'
              : 'Escribe tu respuesta…'}
          value={valor}
          disabled={disabled}
          onChange={(e) => setValor(e.target.value)}
          autoFocus
        />
      )}
      {validacion && <div className="w-100 text-danger small">{validacion}</div>}
      <button type="submit" className="btn ip-btn-primary ip-step-submit" disabled={disabled || (pregunta.required && valor === '')}>
        Enviar
      </button>
    </form>
  );
}
