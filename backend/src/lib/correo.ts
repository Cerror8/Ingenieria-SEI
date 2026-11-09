import nodemailer, { type Transporter } from "nodemailer";
import { pool } from "../db.js";

const NARANJA = "#C2410C";
const NARANJA_CLARO = "#FFEDD5";
const BORDE = "#E2E8F0";
const TEXTO = "#334155";
const TITULO = "#0F172A";

type Correo = {
  para: string | string[];
  asunto: string;
  html: string;
  texto: string;
};

type Detalle = { etiqueta: string; valor: string };

type Plantilla = {
  titulo: string;
  intro: string;
  detalles?: Detalle[];
  cta?: { texto: string; url: string };
  nota?: string;
};

type TareaCorreo = {
  titulo: string;
  tableroNombre: string | null;
  proyectoNombre: string | null;
  proyectoLiderId: string | null;
  tableroCreadoPor: string | null;
  creadoPor: string | null;
  responsableId: string | null;
  responsable: string;
  fechaLimite: string | null;
  prioridad: string;
};

type Actor = { id: string; email: string; nombre: string };

export function enlaceApp(ruta = ""): string {
  const base = (process.env.FRONTEND_URL ?? "http://localhost:5174").replace(/\/$/, "");
  return `${base}${ruta}`;
}

function configSmtp() {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;

  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    secure,
    auth: { user, pass },
    remitente: process.env.SMTP_FROM?.trim() || user,
  };
}

export function correoConfigurado(): boolean {
  return configSmtp() !== null;
}

let transporte: Transporter | null = null;
let transporteUsuario = "";

function obtenerTransporte(config: NonNullable<ReturnType<typeof configSmtp>>): Transporter {
  if (!transporte || transporteUsuario !== config.auth.user) {
    transporte = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
    transporteUsuario = config.auth.user;
  }
  return transporte;
}

export async function enviarCorreo({ para, asunto, html, texto }: Correo): Promise<boolean> {
  const config = configSmtp();
  if (!config) return false;

  const destinatarios = (Array.isArray(para) ? para : [para]).filter(Boolean);
  if (!destinatarios.length) return false;

  try {
    await obtenerTransporte(config).sendMail({
      from: `"Ingeniería SEI" <${config.remitente}>`,
      to: destinatarios.join(", "),
      subject: asunto,
      text: texto,
      html,
    });
    return true;
  } catch (e) {
    console.error("[correo] No se pudo enviar:", e instanceof Error ? e.message : e);
    return false;
  }
}

function escapar(valor: string): string {
  return valor
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function plantilla({ titulo, intro, detalles = [], cta, nota }: Plantilla): string {
  const filas = detalles
    .map(
      (d) => `
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#64748B;vertical-align:top;width:130px">${escapar(d.etiqueta)}</td>
          <td style="padding:6px 0;font-size:13px;color:${TITULO};font-weight:600">${escapar(d.valor)}</td>
        </tr>`,
    )
    .join("");

  const boton = cta
    ? `<div style="margin-top:24px">
         <a href="${escapar(cta.url)}" style="display:inline-block;background:${NARANJA};color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;border-radius:10px">${escapar(cta.texto)}</a>
       </div>`
    : "";

  const notaHtml = nota
    ? `<p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#64748B">${escapar(nota)}</p>`
    : "";

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#F8FAFC;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${BORDE};border-radius:16px;overflow:hidden">
            <tr>
              <td style="background:${NARANJA};padding:20px 28px">
                <div style="font-size:18px;font-weight:800;color:#FFFFFF;letter-spacing:.4px">Ingeniería SEI</div>
                <div style="font-size:12px;color:${NARANJA_CLARO};margin-top:2px">Gestión de proyectos e indicadores</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px">
                <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${TITULO}">${escapar(titulo)}</h1>
                <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${TEXTO}">${escapar(intro)}</p>
                ${filas ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDE};border-bottom:1px solid ${BORDE};padding:8px 0">${filas}</table>` : ""}
                ${boton}
                ${notaHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;border-top:1px solid ${BORDE};background:#F8FAFC">
                <p style="margin:0;font-size:11px;line-height:1.5;color:#64748B">
                  Este correo se generó automáticamente por Ingeniería SEI. No respondas a este mensaje.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function formatearFecha(fecha: string | null): string {
  if (!fecha) return "Sin fecha límite";
  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
  if (!anio || !mes || !dia) return fecha;
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(anio, mes - 1, dia)));
}

function mensajeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function correosDeUsuarios(ids: Array<string | null | undefined>): Promise<string[]> {
  const limpios = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!limpios.length) return [];

  const { rows } = await pool.query<{ email: string }>(
    `SELECT DISTINCT lower(email) AS email
       FROM usuarios
      WHERE id = ANY($1::uuid[]) AND activo = true`,
    [limpios],
  );
  return rows.map((fila) => fila.email);
}

async function correosDeAdmins(): Promise<string[]> {
  const { rows } = await pool.query<{ email: string }>(
    `SELECT lower(email) AS email
       FROM usuarios
      WHERE rol = 'admin' AND activo = true`,
  );
  return rows.map((fila) => fila.email);
}

function sinActor(emails: string[], actorEmail: string): string[] {
  const propio = actorEmail.toLowerCase();
  return emails.filter((email) => email !== propio);
}

export function avisarSolicitudAcceso(datos: {
  nombre: string;
  email: string;
  proveedor: string;
}): void {
  void (async () => {
    if (!correoConfigurado()) return;

    const para = await correosDeAdmins();
    if (!para.length) return;

    await enviarCorreo({
      para,
      asunto: `Nueva solicitud de acceso · ${datos.nombre}`,
      texto: `${datos.nombre} (${datos.email}) solicitó acceso a Ingeniería SEI mediante ${datos.proveedor === "google" ? "Google" : "correo y contraseña"}. Revisa la solicitud en la aplicación.`,
      html: plantilla({
        titulo: "Nueva solicitud de acceso",
        intro: `${datos.nombre} solicitó acceso a Ingeniería SEI. La cuenta quedará activa cuando un administrador la apruebe.`,
        detalles: [
          { etiqueta: "Nombre", valor: datos.nombre },
          { etiqueta: "Correo", valor: datos.email },
          {
            etiqueta: "Método",
            valor: datos.proveedor === "google" ? "Google" : "Correo y contraseña",
          },
        ],
        cta: { texto: "Revisar solicitudes", url: enlaceApp() },
      }),
    });
  })().catch((e) => console.error("[correo] Aviso de solicitud:", mensajeError(e)));
}

export function avisarCuentaAprobada(datos: {
  nombre: string;
  email: string;
  rol: string;
}): void {
  void (async () => {
    if (!correoConfigurado()) return;

    await enviarCorreo({
      para: datos.email,
      asunto: "Tu cuenta fue aprobada · Ingeniería SEI",
      texto: `Hola ${datos.nombre}, tu solicitud de acceso fue aprobada. Ya puedes ingresar a Ingeniería SEI con rol ${datos.rol}.`,
      html: plantilla({
        titulo: "Tu cuenta fue aprobada",
        intro: `Hola ${datos.nombre}, tu solicitud de acceso fue aprobada. Ya puedes ingresar a Ingeniería SEI.`,
        detalles: [
          { etiqueta: "Correo", valor: datos.email },
          { etiqueta: "Rol", valor: datos.rol },
        ],
        cta: { texto: "Ingresar", url: enlaceApp("/login") },
      }),
    });
  })().catch((e) => console.error("[correo] Aviso de aprobación:", mensajeError(e)));
}

export function avisarAsignacion(datos: {
  usuarioId: string;
  actor: string;
  titulo: string;
  tablero: string;
  proyecto: string | null;
  prioridad: string;
  fechaLimite: string | null;
}): void {
  void (async () => {
    if (!correoConfigurado()) return;

    const para = await correosDeUsuarios([datos.usuarioId]);
    if (!para.length) return;

    await enviarCorreo({
      para,
      asunto: `Nueva tarea asignada: ${datos.titulo}`,
      texto: `${datos.actor} te asignó la tarea "${datos.titulo}" en el tablero ${datos.tablero}. Prioridad: ${datos.prioridad}. Fecha límite: ${formatearFecha(datos.fechaLimite)}.`,
      html: plantilla({
        titulo: "Nueva tarea asignada",
        intro: `${datos.actor} te asignó una tarea en el tablero ${datos.tablero}.`,
        detalles: [
          { etiqueta: "Tarea", valor: datos.titulo },
          { etiqueta: "Proyecto", valor: datos.proyecto ?? "Sin proyecto" },
          { etiqueta: "Prioridad", valor: datos.prioridad },
          { etiqueta: "Fecha límite", valor: formatearFecha(datos.fechaLimite) },
        ],
        cta: { texto: "Abrir mi tablero", url: enlaceApp() },
      }),
    });
  })().catch((e) => console.error("[correo] Aviso de asignación:", mensajeError(e)));
}

export type TipoFlujo = "inicio" | "revision" | "aprobada" | "devuelta";

export function avisarFlujo(datos: {
  tipo: TipoFlujo;
  tarea: TareaCorreo;
  actor: Actor;
  motivo?: string;
}): void {
  void (async () => {
    if (!correoConfigurado()) return;

    const { tipo, tarea, actor } = datos;

    const esGestor = tipo === "inicio" || tipo === "revision";
    const ids = esGestor
      ? [tarea.creadoPor, tarea.proyectoLiderId, tarea.tableroCreadoPor]
      : [tarea.responsableId];

    const para = sinActor(await correosDeUsuarios(ids), actor.email);
    if (!para.length) return;

    const contenido = {
      inicio: {
        asunto: `Tarea iniciada: ${tarea.titulo}`,
        titulo: "Tarea iniciada",
        intro: `${actor.nombre} marcó como entendida la tarea y comenzó a trabajar en ella.`,
      },
      revision: {
        asunto: `Tarea lista para revisión: ${tarea.titulo}`,
        titulo: "Tarea lista para revisión",
        intro: `${actor.nombre} envió la tarea a revisión. Revisa el avance para aprobarla o devolverla con observaciones.`,
      },
      aprobada: {
        asunto: `Tarea aprobada: ${tarea.titulo}`,
        titulo: "Tarea aprobada",
        intro: `${actor.nombre} aprobó la tarea. El trabajo quedó marcado como completado.`,
      },
      devuelta: {
        asunto: `Tarea devuelta para corrección: ${tarea.titulo}`,
        titulo: "Tarea devuelta para corrección",
        intro: `${actor.nombre} devolvió la tarea con observaciones. Revisa el motivo y ajusta lo necesario.`,
      },
    }[tipo];

    const detalles: Detalle[] = [
      { etiqueta: "Tarea", valor: tarea.titulo },
      { etiqueta: "Tablero", valor: tarea.tableroNombre ?? "Tablero" },
      { etiqueta: "Proyecto", valor: tarea.proyectoNombre ?? "Sin proyecto" },
      { etiqueta: "Responsable", valor: tarea.responsable },
      { etiqueta: "Fecha límite", valor: formatearFecha(tarea.fechaLimite) },
    ];
    if (tipo === "devuelta" && datos.motivo) {
      detalles.push({ etiqueta: "Motivo", valor: datos.motivo });
    }

    await enviarCorreo({
      para,
      asunto: contenido.asunto,
      texto: `${contenido.intro} Tarea: ${tarea.titulo}. Tablero: ${tarea.tableroNombre ?? "Tablero"}. Proyecto: ${tarea.proyectoNombre ?? "Sin proyecto"}.${datos.motivo ? ` Motivo: ${datos.motivo}.` : ""}`,
      html: plantilla({
        titulo: contenido.titulo,
        intro: contenido.intro,
        detalles,
        cta: { texto: "Abrir Ingeniería SEI", url: enlaceApp() },
      }),
    });
  })().catch((e) => console.error("[correo] Aviso de flujo:", mensajeError(e)));
}

export type RecordatorioTarea = {
  titulo: string;
  tablero: string;
  proyecto: string | null;
  fechaLimite: string;
  diasRestantes: number;
  prioridad: string;
};

export function avisarRecordatorios(
  grupos: Array<{ nombre: string; email: string; tareas: RecordatorioTarea[] }>,
): Promise<number> {
  return (async () => {
    if (!correoConfigurado()) return 0;

    let enviados = 0;

    for (const grupo of grupos) {
      const pendientes = grupo.tareas.length;
      const tabla = grupo.tareas
        .map((tarea) => {
          const estado =
            tarea.diasRestantes < 0
              ? `Vencida hace ${Math.abs(tarea.diasRestantes)} día(s)`
              : tarea.diasRestantes === 0
                ? "Vence hoy"
                : `Vence en ${tarea.diasRestantes} día(s)`;
          return `${tarea.titulo} — ${tarea.tablero} · ${formatearFecha(tarea.fechaLimite)} · ${estado} · Prioridad ${tarea.prioridad}`;
        })
        .join("\n");

      const enviado = await enviarCorreo({
        para: grupo.email,
        asunto:
          pendientes === 1
            ? `Recordatorio: ${grupo.tareas[0].titulo}`
            : `Recordatorio: ${pendientes} tareas por vencer`,
        texto: `Hola ${grupo.nombre}, estas son tus tareas próximas a vencer:\n\n${tabla}\n\nAbre Ingeniería SEI para revisarlas.`,
        html: plantilla({
          titulo: pendientes === 1 ? "Tienes una tarea por vencer" : `Tienes ${pendientes} tareas por vencer`,
          intro: `Hola ${grupo.nombre}, estas son tus tareas con fecha límite en los próximos 7 días o ya vencidas.`,
          detalles: grupo.tareas.map((tarea) => {
            const estado =
              tarea.diasRestantes < 0
                ? `Vencida hace ${Math.abs(tarea.diasRestantes)} día(s)`
                : tarea.diasRestantes === 0
                  ? "Vence hoy"
                  : `Vence en ${tarea.diasRestantes} día(s)`;
            return {
              etiqueta: estado,
              valor: `${tarea.titulo} — ${tarea.tablero} · ${formatearFecha(tarea.fechaLimite)} · Prioridad ${tarea.prioridad}`,
            };
          }),
          cta: { texto: "Abrir mi tablero", url: enlaceApp() },
        }),
      });

      if (enviado) enviados += 1;
    }

    return enviados;
  })();
}
