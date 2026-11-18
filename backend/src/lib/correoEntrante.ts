import crypto from "node:crypto";
import path from "node:path";
import { ImapFlow, type FetchMessageObject, type MessageStructureObject } from "imapflow";
import { pool } from "../db.js";
import { HttpError } from "../http.js";
import { guardarBuffer } from "./almacen.js";
import { carpetaSubidas } from "./carpetas.js";

const CARPETA = carpetaSubidas();
const DIAS_ATRAS = 30;
const MAX_MENSAJES = 60;
const MAX_ADJUNTOS = 10;
const MAX_ADJUNTO = 20 * 1024 * 1024;

const EXTENSIONES = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".png", ".jpg", ".jpeg", ".txt", ".csv", ".zip", ".eml",
]);

type Resultado = {
  revisados: number;
  registrados: number;
  documentos: number;
  ignorados: number;
};

type Config = {
  host: string;
  port: number;
  user: string;
  pass: string;
};

function configImap(): Config | null {
  if (process.env.IMAP_ENABLED === "false") return null;
  const user = process.env.IMAP_USER?.trim() || process.env.SMTP_USER?.trim();
  const pass = process.env.IMAP_PASS || process.env.SMTP_PASS;
  if (!user || !pass) return null;

  return {
    host: process.env.IMAP_HOST?.trim() || "imap.gmail.com",
    port: Number(process.env.IMAP_PORT ?? 993),
    user,
    pass,
  };
}

export function imapConfigurado(): boolean {
  return configImap() !== null;
}

let enCurso: Promise<Resultado> | null = null;

// La sincronización se puede lanzar desde el botón de la interfaz y desde el cron;
// una sola conexión a la vez evita descargar dos veces el mismo buzón.
export function sincronizarCorreosEntrantes(): Promise<Resultado> {
  if (!enCurso) {
    enCurso = ejecutar().finally(() => {
      enCurso = null;
    });
  }
  return enCurso;
}

async function ejecutar(): Promise<Resultado> {
  const config = configImap();
  if (!config) {
    throw new HttpError(
      503,
      "La recepción de correo no está configurada. Define IMAP_USER e IMAP_PASS (o usa SMTP_USER y SMTP_PASS) en el servidor.",
    );
  }

  const cliente = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  });

  const resultado: Resultado = { revisados: 0, registrados: 0, documentos: 0, ignorados: 0 };

  await cliente.connect();
  try {
    const bloqueo = await cliente.getMailboxLock("INBOX");
    try {
      const desde = new Date(Date.now() - DIAS_ATRAS * 24 * 3600 * 1000);
      const [porAsunto, porDestino] = await Promise.all([
        cliente.search({ subject: "SEI-ACT", since: desde }, { uid: true }),
        cliente.search({ to: "seiact-", since: desde }, { uid: true }),
      ]);
      const uids = [
        ...new Set([
          ...(Array.isArray(porAsunto) ? porAsunto : []),
          ...(Array.isArray(porDestino) ? porDestino : []),
        ]),
      ]
        .sort((a, b) => a - b)
        .slice(-MAX_MENSAJES);
      if (!uids.length) return resultado;

      for await (const mensaje of cliente.fetch(uids, {
        uid: true,
        envelope: true,
        bodyStructure: true,
        source: true,
      })) {
        resultado.revisados += 1;
        try {
          const creados = await procesarMensaje(cliente, mensaje);
          if (creados === null) {
            resultado.ignorados += 1;
            continue;
          }
          resultado.registrados += 1;
          resultado.documentos += creados;
        } catch (e) {
          console.error(
            "[correo-entrante] No se pudo registrar un mensaje:",
            e instanceof Error ? e.message : e,
          );
        }
      }
    } finally {
      bloqueo.release();
    }
  } finally {
    await cliente.logout().catch(() => undefined);
  }

  return resultado;
}

// Devuelve cuántos documentos quedaron vinculados o null si el mensaje no aplica.
async function procesarMensaje(
  cliente: ImapFlow,
  mensaje: FetchMessageObject,
): Promise<number | null> {
  const asunto = mensaje.envelope?.subject ?? "";
  const token = tokenDelMensaje(mensaje);
  if (!token) return null;

  const remitente = (mensaje.envelope?.from?.[0]?.address ?? "").toLowerCase();
  if (!remitente) return null;

  const { rows } = await pool.query<{
    id: string;
    proyectoId: string;
    carpeta: string | null;
    contactoEmail: string | null;
  }>(
    `SELECT a.id, a.proyecto_id AS "proyectoId", a.carpeta,
            lower(c.email) AS "contactoEmail"
       FROM edt_actividades a
       LEFT JOIN contactos_externos c ON c.id = a.contacto_externo_id
      WHERE a.id = $1`,
    [token],
  );
  const actividad = rows[0];
  if (!actividad) return null;

  if (actividad.contactoEmail) {
    if (remitente !== actividad.contactoEmail) return null;
  } else {
    const { rows: internos } = await pool.query<{ existe: boolean }>(
      "SELECT true AS existe FROM usuarios WHERE lower(email) = $1 AND activo = true",
      [remitente],
    );
    if (!internos[0]) return null;
  }

  const messageId = mensaje.envelope?.messageId ?? `uid:${mensaje.uid}`;
  const { rows: previo } = await pool.query(
    "SELECT 1 FROM correos_entrantes WHERE message_id = $1",
    [messageId],
  );
  if (previo[0]) {
    await marcarLeido(cliente, mensaje.uid);
    return null;
  }

  const recibidoEn = fechaValida(mensaje.envelope?.date ?? mensaje.internalDate);
  const fecha = recibidoEn ? recibidoEn.toISOString().slice(0, 10) : hoy();
  let documentos = 0;

  if (mensaje.source) {
    const nombre = nombreSeguro(`Correo recibido - ${fecha} - ${asunto}`, "correo-recibido.eml");
    const clave = await guardarBuffer(
      Buffer.from(mensaje.source),
      `${nombre}.eml`,
      "message/rfc822",
      "documentos",
      CARPETA,
    );
    await insertarDocumento({
      proyectoId: actividad.proyectoId,
      actividadId: actividad.id,
      carpeta: actividad.carpeta,
      nombre: nombre.slice(0, 180),
      archivoNombre: `${nombre}.eml`.slice(0, 255),
      clave,
      mime: "message/rfc822",
      tamano: mensaje.source.length,
      fecha,
      usuario: remitente,
    });
    documentos += 1;
  }

  const adjuntos = partesAdjuntas(mensaje.bodyStructure);
  if (adjuntos.length) {
    const partes = adjuntos.slice(0, MAX_ADJUNTOS).map((nodo) => nodo.part!);
    type Descarga = {
      meta: { contentType?: string; filename?: string };
      content: Buffer | null;
    };
    const descargas = (await cliente
      .downloadMany(String(mensaje.uid), partes, { uid: true })
      .catch(() => ({}))) as Record<string, Descarga>;
    for (const nodo of adjuntos.slice(0, MAX_ADJUNTOS)) {
      const descarga = descargas[nodo.part!];
      const contenido = descarga?.content;
      if (!contenido || contenido.length > MAX_ADJUNTO) continue;

      const original = nombreSeguro(descarga.meta.filename ?? nodo.dispositionParameters?.filename ?? "adjunto", "adjunto");
      const extension = path.extname(original).toLowerCase();
      if (!EXTENSIONES.has(extension)) continue;

      const clave = await guardarBuffer(
        contenido,
        original,
        descarga.meta.contentType ?? null,
        "documentos",
        CARPETA,
      );
      await insertarDocumento({
        proyectoId: actividad.proyectoId,
        actividadId: actividad.id,
        carpeta: actividad.carpeta,
        nombre: path.parse(original).name.slice(0, 180),
        archivoNombre: original.slice(0, 255),
        clave,
        mime: descarga.meta.contentType ?? null,
        tamano: contenido.length,
        fecha,
        usuario: remitente,
      });
      documentos += 1;
    }
  }

  await pool.query(
    `INSERT INTO correos_entrantes
       (message_id, actividad_id, remitente, asunto, recibido_en, documentos)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (message_id) DO NOTHING`,
    [messageId, actividad.id, remitente, asunto.slice(0, 500), recibidoEn, documentos],
  );

  await marcarLeido(cliente, mensaje.uid);
  return documentos;
}

// El id de la actividad viaja en la etiqueta del buzón (respuesta al
// destinatario usuario+seiact-<id>@gmail.com) o, para correos anteriores, en el
// asunto entre corchetes.
function tokenDelMensaje(mensaje: FetchMessageObject): string | null {
  const asunto = mensaje.envelope?.subject ?? "";
  const delAsunto =
    /\[SEI-ACT:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/i.exec(
      asunto,
    )?.[1];
  if (delAsunto) return delAsunto;

  const destinatarios = [...(mensaje.envelope?.to ?? []), ...(mensaje.envelope?.cc ?? [])];
  for (const destinatario of destinatarios) {
    const delDestino =
      /\+seiact-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i.exec(
        destinatario.address ?? "",
      )?.[1];
    if (delDestino) return delDestino;
  }
  return null;
}

function partesAdjuntas(nodo: MessageStructureObject | undefined): MessageStructureObject[] {
  if (!nodo) return [];
  const propias =
    nodo.part &&
    (nodo.disposition === "attachment" ||
      Boolean(nodo.dispositionParameters?.filename) ||
      Boolean(nodo.parameters?.name))
      ? [nodo]
      : [];
  return [...propias, ...(nodo.childNodes ?? []).flatMap(partesAdjuntas)];
}

async function marcarLeido(cliente: ImapFlow, uid: number) {
  await cliente.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }).catch(() => undefined);
}

async function insertarDocumento(datos: {
  proyectoId: string;
  actividadId: string;
  carpeta: string | null;
  nombre: string;
  archivoNombre: string;
  clave: string;
  mime: string | null;
  tamano: number;
  fecha: string;
  usuario: string;
}) {
  await pool.query(
    `INSERT INTO documentos
       (id, nombre, tipo, carpeta, version, fecha, usuario, estado, proyecto_id,
        archivo_nombre, archivo_ruta, archivo_mime, archivo_tamano, fecha_documento,
        numero_documento, edt_actividad_id)
     VALUES ($1, $2, 'Comunicaciones', $3, 'v1.0', (now() AT TIME ZONE 'America/Bogota')::date,
             $4, 'En revisión', $5, $6, $7, $8, $9, $10::date, NULL, $11)`,
    [
      crypto.randomUUID(),
      datos.nombre,
      datos.carpeta,
      datos.usuario,
      datos.proyectoId,
      datos.archivoNombre,
      datos.clave,
      datos.mime,
      datos.tamano,
      datos.fecha,
      datos.actividadId,
    ],
  );
}

function nombreSeguro(valor: string, respaldo: string): string {
  return (
    valor
      .replace(/[\\/:*?"<>|\r\n]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160) || respaldo
  );
}

function fechaValida(valor: unknown): Date | null {
  if (!valor) return null;
  const fecha = valor instanceof Date ? valor : new Date(String(valor));
  return Number.isFinite(fecha.getTime()) ? fecha : null;
}

function hoy(): string {
  const fecha = new Date();
  fecha.setMinutes(fecha.getMinutes() - fecha.getTimezoneOffset());
  return fecha.toISOString().slice(0, 10);
}
