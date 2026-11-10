import { formatearFecha, type RecordatorioTarea } from "./correo.js";

type ConfigWhatsApp = {
  token: string;
  phoneNumberId: string;
  version: string;
  plantilla: string;
  idioma: string;
  pais: string;
};

function configWhatsApp(): ConfigWhatsApp | null {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return null;

  return {
    token,
    phoneNumberId,
    version: process.env.WHATSAPP_API_VERSION?.trim() || "v23.0",
    plantilla: process.env.WHATSAPP_TEMPLATE_RECORDATORIO?.trim() || "recordatorio_tareas",
    idioma: process.env.WHATSAPP_TEMPLATE_IDIOMA?.trim() || "es",
    pais: (process.env.WHATSAPP_PAIS ?? "57").replace(/\D/g, "") || "57",
  };
}

export function whatsappConfigurado(): boolean {
  return configWhatsApp() !== null;
}

// Meta exige el número en formato internacional sin "+" ni separadores.
export function normalizarTelefono(valor: string | null | undefined): string | null {
  const pais = configWhatsApp()?.pais ?? "57";
  const digitos = (valor ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length === 10) return `${pais}${digitos}`;
  if (digitos.length >= 11 && digitos.length <= 15) return digitos;
  return null;
}

async function enviarPlantilla(telefono: string, variables: string[]): Promise<boolean> {
  const config = configWhatsApp();
  if (!config) return false;

  try {
    const respuesta = await fetch(
      `https://graph.facebook.com/${config.version}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: telefono,
          type: "template",
          template: {
            name: config.plantilla,
            language: { code: config.idioma },
            ...(variables.length
              ? {
                  components: [
                    {
                      type: "body",
                      parameters: variables.map((texto) => ({ type: "text", text: texto })),
                    },
                  ],
                }
              : {}),
          },
        }),
      },
    );

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => "");
      console.error(
        `[whatsapp] Meta respondió ${respuesta.status}: ${detalle.slice(0, 300)}`,
      );
      return false;
    }

    return true;
  } catch (e) {
    console.error(
      "[whatsapp] No se pudo enviar:",
      e instanceof Error ? e.message : String(e),
    );
    return false;
  }
}

export type GrupoWhatsApp = {
  nombre: string;
  telefono: string | null;
  tareas: RecordatorioTarea[];
};

// Plantilla de utilidad con dos variables: {{1}} nombre, {{2}} resumen de tareas.
export function avisarRecordatoriosWhatsApp(grupos: GrupoWhatsApp[]): Promise<number> {
  return (async () => {
    if (!whatsappConfigurado()) return 0;

    let enviados = 0;

    for (const grupo of grupos) {
      const telefono = normalizarTelefono(grupo.telefono);
      if (!telefono) continue;

      const detalle = grupo.tareas.slice(0, 8).map((tarea) => {
        const estado =
          tarea.diasRestantes < 0
            ? `vencida hace ${Math.abs(tarea.diasRestantes)} día(s)`
            : tarea.diasRestantes === 0
              ? "vence hoy"
              : `vence en ${tarea.diasRestantes} día(s)`;
        return `${tarea.titulo} (${formatearFecha(tarea.fechaLimite)}, ${estado})`;
      });
      if (grupo.tareas.length > detalle.length) {
        detalle.push(`y ${grupo.tareas.length - detalle.length} tarea(s) más`);
      }

      const enviado = await enviarPlantilla(telefono, [grupo.nombre, detalle.join("; ")]);
      if (enviado) enviados += 1;
    }

    return enviados;
  })();
}
