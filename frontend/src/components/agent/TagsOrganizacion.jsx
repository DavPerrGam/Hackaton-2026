// Etapa 4 del protocolo: tags estandarizados. Se muestran agrupados por
// origen porque no todos significan lo mismo: una etiqueta de categoría
// dice a qué se dedica la organización, una de entidad dice a quién le
// puede vender hoy, y una de estado dice qué acredita. Mostrar el origen
// es lo que evita que se lean como palabras sueltas.

const GRUPOS = [
  { tipo: 'categoria', titulo: 'Sector', clase: 'text-bg-primary' },
  { tipo: 'capacidad', titulo: 'Capacidades y temas', clase: 'text-bg-secondary' },
  { tipo: 'necesidad', titulo: 'Necesidad pública', clase: 'text-bg-info' },
  { tipo: 'entidad', titulo: 'Mercado accesible hoy', clase: 'text-bg-success' },
  { tipo: 'organizacion', titulo: 'Ficha', clase: 'text-bg-light border' },
  { tipo: 'estado', titulo: 'Acreditación', clase: 'text-bg-dark' },
];

export default function TagsOrganizacion({ tags }) {
  const items = Array.isArray(tags) ? tags.filter((t) => t?.tag) : [];
  if (items.length === 0) return null;

  return (
    <div className="ip-card p-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">Tags de la organización</h6>
        <span className="small text-secondary">{items.length} etiquetas</span>
      </div>

      {GRUPOS.map((grupo) => {
        const delGrupo = items.filter((tag) => tag.tipo === grupo.tipo);
        if (delGrupo.length === 0) return null;
        return (
          <div className="mb-3" key={grupo.tipo}>
            <div className="small text-secondary mb-1">{grupo.titulo}</div>
            <div className="d-flex flex-wrap gap-2">
              {delGrupo.map((tag) => (
                <span className={`badge rounded-pill ${grupo.clase}`} key={tag.tag} title={tag.origen}>
                  {tag.tag}
                </span>
              ))}
            </div>
          </div>
        );
      })}

      <p className="small text-secondary mb-0">
        Estas etiquetas agrupan a su organización con otras del ecosistema IDEAPRO que resuelven
        problemas públicos parecidos: son la base de las alianzas y de las convocatorias dirigidas.
      </p>
    </div>
  );
}
