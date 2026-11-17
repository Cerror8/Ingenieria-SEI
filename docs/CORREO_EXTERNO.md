# Correo bidireccional con personas externas

Las actividades del EDT se pueden asignar a personas del equipo o a **personas externas**
(entidades, contratistas, supervisores). El sistema envía el correo con el detalle de la
actividad y archiva la respuesta y sus adjuntos dentro de la misma actividad.

## Flujo en el sistema

1. En **Proyectos → EDT → Editar actividad → Responsable**, elige o crea una
   **persona externa** (nombre, correo y entidad).
2. En la tarjeta de la actividad aparece el correo y el botón **Enviar correo**.
3. El correo incluye: referencia del contrato, abreviatura y número de contrato, fase,
   número y nombre de la actividad, entregable, descripción, formatos sugeridos y fecha
   de entrega. El asunto lleva el código `[SEI-ACT:<id de la actividad>]`.
4. Al enviarse se guarda una copia HTML en **Documentos** (tipo `Comunicaciones`), se
   registra la fecha de envío y la actividad pasa de `No realizado` a `En ejecución`.
5. Cuando la persona externa responde conservando el asunto, el botón
   **Sincronizar respuestas** (solo administradores) o el cron diario archivan:
   - el correo completo como `.eml` (tipo `Comunicaciones`, estado `En revisión`);
   - cada adjunto permitido (PDF, Word, Excel, PowerPoint, imágenes, TXT, CSV, ZIP, EML).

## Qué debe hacer la persona externa

- **Responder al mismo correo**, sin cambiar el asunto (el código `[SEI-ACT:…]` es lo que
  vincula la respuesta con la actividad).
- Enviar desde el **mismo correo** al que se le escribió; otros remitentes se ignoran.
- Adjuntar los documentos directamente en la respuesta (máx. 10 archivos, 20 MB por archivo).
- No reenviar el correo a otra persona ni crear un asunto nuevo: se registraría como
  respuesta independiente o se ignoraría.

## Configuración del servidor

Variables de entorno (las mismas de Gmail u otro proveedor SMTP/IMAP):

| Variable | Uso |
|---|---|
| `SMTP_USER` / `SMTP_PASS` | Cuenta que envía. Con Gmail se requiere contraseña de aplicación (2FA activo). |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_FROM` | Opcionales para proveedores distintos de Gmail. |
| `IMAP_USER` / `IMAP_PASS` | Buzón que recibe. Por defecto usa `SMTP_USER` / `SMTP_PASS`. |
| `IMAP_HOST` / `IMAP_PORT` | Por defecto `imap.gmail.com:993`. |
| `IMAP_ENABLED=false` | Desactiva la lectura del buzón. |

La sincronización busca en los últimos 30 días (máximo 60 mensajes por corrida), exige
el código en el asunto y valida que el remitente sea el contacto externo asignado o un
usuario interno activo. Los mensajes ya registrados se omiten por `Message-ID`.

## Automatización

- **Manual:** botón **Sincronizar respuestas** en el EDT (administradores) →
  `POST /api/edt/correos/sincronizar`.
- **Cron:** `GET /api/cron/correos` (requiere `CRON_SECRET`) programado en `vercel.json`
  una vez al día, límite del plan Hobby. Si se necesita más frecuencia, usar el botón o un
  programador externo que llame al endpoint.

## API relacionada

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/contactos-externos?buscar=` | Lista o busca contactos. |
| `POST` | `/api/contactos-externos` | Crea un contacto externo. |
| `PATCH` | `/api/contactos-externos/:id` | Edita o desactiva un contacto. |
| `POST` | `/api/edt/actividades/:id/correo` | Envía el correo de la actividad. |
| `POST` | `/api/edt/correos/sincronizar` | Sincroniza el buzón (administradores). |
| `GET` | `/api/cron/correos` | Sincronización programada. |
