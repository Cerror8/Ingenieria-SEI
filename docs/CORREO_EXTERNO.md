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
   de entrega. El asunto es limpio y legible:
   `SEI EJ-INT-001 · Fase 1.1 #7 - Hojas de vida del personal`.
4. La respuesta se enruta sin código visible en el asunto:
   - Con cuenta Gmail se envía un `Reply-To` con dirección plus
     (`usuario+seiact-<id de la actividad>@gmail.com`); al responder, Gmail conserva esa
     dirección y el sistema la usa para vincular la respuesta.
   - Con otros proveedores se añade al asunto el código `[SEI-ACT:<id de la actividad>]`.
5. Al enviarse se guarda una copia HTML en **Documentos** (tipo `Comunicaciones`) con el
   nombre `Correo enviado - <asunto>`, se registra la fecha de envío y la actividad pasa
   de `No realizado` a `En ejecución`.
6. Cuando la persona externa responde al mismo correo, el botón
   **Sincronizar respuestas** (solo administradores) o el cron diario archivan:
   - el correo completo como `.eml` (tipo `Comunicaciones`, estado `En revisión`);
   - cada adjunto permitido (PDF, Word, Excel, PowerPoint, imágenes, TXT, CSV, ZIP, EML).

## Qué debe hacer la persona externa

- **Responder al mismo correo**. Con Gmail basta con pulsar *Responder*: la dirección
  plus (`+seiact-…`) viaja sola aunque el asunto cambie. Con otros proveedores hay que
  conservar el asunto tal cual (lleva `[SEI-ACT:…]`).
- Enviar desde el **mismo correo** al que se le escribió; otros remitentes se ignoran.
- Adjuntar los documentos directamente en la respuesta (máx. 10 archivos, 20 MB por archivo).
- No reenviar el correo a otra persona: el reenvío no conserva la dirección de respuesta
  en todos los clientes y la respuesta podría no archivarse.

## Configuración del servidor

Variables de entorno (las mismas de Gmail u otro proveedor SMTP/IMAP):

| Variable | Uso |
|---|---|
| `SMTP_USER` / `SMTP_PASS` | Cuenta que envía. Con Gmail se requiere contraseña de aplicación (2FA activo). |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_FROM` | Opcionales para proveedores distintos de Gmail. |
| `IMAP_USER` / `IMAP_PASS` | Buzón que recibe. Por defecto usa `SMTP_USER` / `SMTP_PASS`. |
| `IMAP_HOST` / `IMAP_PORT` | Por defecto `imap.gmail.com:993`. |
| `IMAP_ENABLED=false` | Desactiva la lectura del buzón. |

La sincronización busca en los últimos 30 días (máximo 60 mensajes por corrida) tanto el
código `[SEI-ACT:…]` del asunto como la dirección plus `+seiact-…` del destinatario;
valida que el remitente sea el contacto externo asignado o un usuario interno activo. Los
mensajes ya registrados se omiten por `Message-ID`.

## Automatización

### Qué hace **Sincronizar respuestas**

1. Abre el buzón IMAP y lee los correos de los últimos 30 días (máximo 60 por corrida).
2. Identifica los que pertenecen a una actividad: por la dirección `+seiact-<id>` o por
   el código `[SEI-ACT:<id>]` del asunto.
3. Comprueba que el remitente sea el contacto externo asignado a esa actividad o un
   usuario interno activo; si no coincide, lo ignora.
4. Omite los mensajes ya archivados (control por `Message-ID`).
5. Por cada respuesta nueva guarda:
   - el correo completo como `.eml` (tipo `Comunicaciones`, estado `En revisión`) con el
     nombre `Correo enviado - <asunto>` o su variante de respuesta;
   - cada adjunto permitido como documento independiente.
6. Deja los archivos visibles en **Documentos**, en la tarjeta de la actividad y en el
   detalle de la tarea del tablero, en la sección **Documentos de la actividad**.

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
