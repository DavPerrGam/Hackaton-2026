# n8n local IDEAPRO

El proyecto usa n8n como servicio separado. La configuración está en `docker-compose.n8n.yml`.

## Requisitos

Instala Docker Desktop para Windows y asegúrate de que esté iniciado.

## Iniciar n8n

Desde la raíz del proyecto:

```powershell
docker compose -f docker-compose.n8n.yml up -d
```

Abre `http://localhost:5678` y crea el usuario administrador de n8n.

## Detener o revisar

```powershell
docker compose -f docker-compose.n8n.yml ps
docker compose -f docker-compose.n8n.yml logs -f n8n
docker compose -f docker-compose.n8n.yml down
```

El volumen `n8n_data` conserva workflows y credenciales entre reinicios. `restart: unless-stopped` hace que el contenedor vuelva a levantarse cuando Docker Desktop inicia.

## Webhooks IDEAPRO

Configura en `backend/.env`:

```env
N8N_CHAT_WEBHOOK_URL=http://localhost:5678/webhook/ideapro-chat
N8N_WEBHOOK_URL=http://localhost:5678/webhook/ideapro-ia-filter
N8N_ALERTAS_WEBHOOK_URL=http://localhost:5678/webhook/ideapro-alertas
```

El workflow debe estar activo y devolver JSON con `reply`, `next_action` y `confidence`. La URL `/webhook-test/` solo sirve mientras n8n está escuchando manualmente; para el proyecto usa `/webhook/` con el workflow activo.

## Contrato de asesoramiento

En `DIAGNOSTICO_CHAT`, el webhook recibe el contexto completo calculado por el backend:

- `$json.entrevista.preguntas_realizadas`: preguntas efectivamente realizadas y sus respuestas.
- `$json.entrevista.respuestas_completas`: respuestas planas completas de la sesión.
- `$json.diagnostico`: índice, scores, dimensiones IDEAPRO, radar, madurez, elegibilidad, riesgos, brechas, clasificación, perfilamiento, entidades, plan y reporte.
- `$json.rutaCrecimientoRecomendada`: ruta de servicios ya priorizada.
- `$json.oportunidadesPriorizadas`: oportunidades compatibles y sus brechas.
- `$json.documentos`: documentos aportados por la organización, si existen.
- `$json.historial`: conversación previa.
- `$json.rubrica_asesoramiento`: reglas que debe seguir el asesor.

El modelo debe responder JSON con esta forma:

```json
{
	"reply": "respuesta basada únicamente en el contexto recibido",
	"next_action": "ask_clarification",
	"confidence": 0.85
}
```

`confidence` debe ser un número entre `0` y `1`. Si no hay evidencia suficiente, debe pedir aclaración y usar una confianza menor a `0.65`; el backend descartará respuestas que no cumplan el umbral o que introduzcan cifras no presentes en el contexto.
