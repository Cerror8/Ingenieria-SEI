import { pool, type Db } from "../db.js";
import { estructuraPorId } from "./estructura.js";

type Consulta = typeof pool | Db;

export const TIPOS_CONTRATO = ["Obra", "Interventoría"] as const;
export type TipoContrato = (typeof TIPOS_CONTRATO)[number];

type TipoActividad = "Actividad" | "Documento" | "Acta";

type ActividadPlantilla = {
  clave: string;
  nombre: string;
  tipo?: TipoActividad;
  descripcion?: string;
  requiereDocumento?: boolean;
  carpeta?: string;
  requisitos?: string[];
};

type FasePlantilla = {
  clave: string;
  nombre: string;
  descripcion: string;
  actividades: ActividadPlantilla[];
};

export type FaseEdt = {
  id: string;
  proyectoId: string;
  nombre: string;
  descripcion: string;
  clave: string | null;
  orden: number;
  esPrincipal: boolean;
  dependeDeFaseId: string | null;
};

type ProyectoRef = { id: string; nombre: string; liderId: string | null; estructura: string | null };

const CARPETAS: Record<string, string[]> = {
  legalizacion: ["legalizacion", "documentacion contractual"],
  polizas: ["polizas"],
  personal: ["personal"],
  contratacion: ["documentacion contractual"],
  liquidacion: ["liquidacion", "documentacion contractual"],
  informes: ["informes"],
  "informes-mensual": ["informes/1.mensual", "mensual", "informes"],
  "informes-semanal": ["informes/2.semanal", "semanal", "informes"],
  comunicaciones: ["comunicaciones"],
  tecnica: ["documentacion tecnica"],
  cronograma: ["cronograma"],
  registro: ["registro fotografico", "registro"],
  bitacora: ["bitacora", "control de obra"],
  calidad: ["calidad", "formatos"],
  finanzas: ["finanzas"],
  control: ["control de obra"],
};

function sugerirCarpeta(estructuraId: string | null, semantica?: string): string | null {
  if (!semantica) return null;
  const estructura = estructuraId ? estructuraPorId(estructuraId) : null;
  if (!estructura) return null;
  const claves = CARPETAS[semantica] ?? [semantica];
  for (const clave of claves) {
    const encontrada = estructura.carpetas.find((ruta) => ruta.toLowerCase().includes(clave));
    if (encontrada) return encontrada;
  }
  return null;
}

const FASE_1: Omit<FasePlantilla, "actividades"> = {
  clave: "fase-1",
  nombre: "Etapa precontractual",
  descripcion: "Actividades previas al inicio del contrato: legalización, documentos y socialización.",
};

const FASE_2: Omit<FasePlantilla, "actividades"> = {
  clave: "fase-2",
  nombre: "Etapa contractual",
  descripcion: "Ejecución del contrato: actas, informes, control de obra y entregables.",
};

const FASE_3: Omit<FasePlantilla, "actividades"> = {
  clave: "fase-3",
  nombre: "Cierre de proyecto",
  descripcion: "Recibo final, liquidación, paz y salvos y cierre documental.",
};

// Transcrito de Fases_v_obra.docx (v1.1 – 30 ene 2026). Cada acta o documento
// obligatorio es una tarjeta del tablero de su fase y exige archivo cargado.
const PLANTILLA_OBRA: FasePlantilla[] = [
  {
    ...FASE_1,
    actividades: [
      { clave: "obra-f1-legalizacion", nombre: "Legalización del contrato", descripcion: "Firma del contrato, creación de cuenta bancaria y, para consorcios o uniones temporales, trámite del RUT.", carpeta: "legalizacion" },
      { clave: "obra-f1-contrato", nombre: "Contrato de obra", tipo: "Documento", descripcion: "Contrato firmado y sus anexos.", carpeta: "legalizacion" },
      { clave: "obra-f1-rut", nombre: "RUT y cuenta bancaria", tipo: "Documento", descripcion: "RUT actualizado y certificación de la cuenta bancaria del contratista o consorcio.", carpeta: "legalizacion" },
      { clave: "obra-f1-polizas", nombre: "Pólizas y garantías", tipo: "Documento", descripcion: "Póliza inicial constituida y presentada con su anexo.", carpeta: "polizas" },
      { clave: "obra-f1-hojas-vida", nombre: "Hojas de vida del personal", tipo: "Documento", descripcion: "Hojas de vida del personal propuesto para la ejecución.", carpeta: "personal" },
      { clave: "obra-f1-presupuesto", nombre: "Presupuesto con APUs iniciales", tipo: "Documento", descripcion: "Presupuesto de obra con análisis de precios unitarios iniciales.", carpeta: "contratacion" },
      { clave: "obra-f1-disenos", nombre: "Diseños y estudios iniciales", tipo: "Documento", descripcion: "Estudios, diseños y especificaciones entregadas por la entidad.", carpeta: "tecnica" },
      { clave: "obra-f1-plan-inversion", nombre: "Plan de inversión del anticipo", tipo: "Documento", descripcion: "Programación de uso del anticipo o pago anticipado.", carpeta: "finanzas" },
      { clave: "obra-f1-visita", nombre: "Visita preliminar e informe de diagnóstico", descripcion: "Visita al sitio e informe de diagnóstico preliminar cuando hay hallazgos.", requiereDocumento: true, carpeta: "tecnica" },
      { clave: "obra-f1-plan-calidad", nombre: "Plan de calidad y PGIO", tipo: "Documento", descripcion: "Programa de ensayos, planes, carpetas, formatos y listas de chequeo.", carpeta: "calidad" },
      { clave: "obra-f1-cronograma", nombre: "Programación de obra (Gantt)", tipo: "Documento", descripcion: "Cronograma de ejecución con actividades y fechas.", carpeta: "cronograma" },
      { clave: "obra-f1-licencias", nombre: "Licencias, permisos y políticas", tipo: "Documento", descripcion: "Licencias, permisos y pólizas exigidas para iniciar la obra.", carpeta: "legalizacion" },
      { clave: "obra-f1-socializacion", nombre: "Socialización del proyecto", descripcion: "Chapolas, perifoneo, cadenas de WhatsApp y oficios a la comunidad.", requiereDocumento: true, carpeta: "comunicaciones" },
      { clave: "obra-f1-actas-vecindad", nombre: "Actas de vecindad", tipo: "Acta", descripcion: "Levantamiento y definición del estado de los predios vecinos.", carpeta: "comunicaciones" },
      { clave: "obra-f1-acta-comite", nombre: "Acta de reunión de comité", tipo: "Acta", descripcion: "Acta de reunión del comité del proyecto.", carpeta: "comunicaciones" },
      { clave: "obra-f1-cdp", nombre: "CDP", tipo: "Documento", descripcion: "Certificado de disponibilidad presupuestal.", carpeta: "finanzas" },
      { clave: "obra-f1-rp", nombre: "RP", tipo: "Documento", descripcion: "Registro presupuestal del compromiso.", carpeta: "finanzas" },
    ],
  },
  {
    ...FASE_2,
    actividades: [
      {
        clave: "obra-f2-acta-inicio",
        nombre: "Acta de inicio de obra",
        tipo: "Acta",
        descripcion: "Acta de inicio con validación de anticipo o pago anticipado, garantías y documentos previos.",
        carpeta: "contratacion",
        requisitos: ["obra-f1-contrato", "obra-f1-polizas", "obra-f1-rp", "obra-f1-plan-inversion", "obra-f1-cronograma", "obra-f1-disenos", "obra-f1-licencias"],
      },
      { clave: "obra-f2-anticipo", nombre: "Validación de anticipo o pago anticipado", tipo: "Acta", descripcion: "Soporte del desembolso y su aplicación según el plan de inversión.", carpeta: "finanzas", requisitos: ["obra-f2-acta-inicio"] },
      { clave: "obra-f2-polizas-anexo", nombre: "Actualización de pólizas (Anexo 1)", tipo: "Documento", descripcion: "Actualización de garantías asociada al acta de inicio.", carpeta: "polizas", requisitos: ["obra-f2-acta-inicio"] },
      { clave: "obra-f2-pgio", nombre: "Implementación del PGIO", descripcion: "Implementación del programa de gestión e implementación de obra.", requiereDocumento: true, carpeta: "calidad", requisitos: ["obra-f2-acta-inicio"] },
      { clave: "obra-f2-cronograma", nombre: "Implementación del cronograma", descripcion: "Seguimiento de la programación y actualización del avance.", carpeta: "cronograma" },
      { clave: "obra-f2-bitacora", nombre: "Bitácora de obra", descripcion: "Registro diario de novedades, instrucciones y visitas.", requiereDocumento: true, carpeta: "bitacora" },
      { clave: "obra-f2-registro", nombre: "Registro fotográfico", descripcion: "Evidencia fotográfica del avance y de las actividades ejecutadas.", requiereDocumento: true, carpeta: "registro" },
      { clave: "obra-f2-cantidades", nombre: "Cantidades de obra y preacta", descripcion: "Medición de cantidades ejecutadas que alimenta la preacta y las actas de cobro.", requiereDocumento: true, carpeta: "control" },
      { clave: "obra-f2-cobros", nombre: "Actas de cobro parcial y final", tipo: "Acta", descripcion: "Actas parciales y final de cobro con soportes de cantidades.", carpeta: "contratacion", requisitos: ["obra-f2-cantidades"] },
      { clave: "obra-f2-planos", nombre: "Planos y señalización de lo construido", descripcion: "Planos actualizados y señalización que alimenta la preacta.", requiereDocumento: true, carpeta: "tecnica" },
      { clave: "obra-f2-ensayos", nombre: "Ensayos de materiales y procedimientos", tipo: "Documento", descripcion: "Resultados de laboratorio, conceptos y fichas técnicas.", carpeta: "calidad" },
      { clave: "obra-f2-comites", nombre: "Comités técnicos", descripcion: "Reuniones técnicas de seguimiento y decisiones.", requiereDocumento: true, carpeta: "comunicaciones" },
      { clave: "obra-f2-acciones", nombre: "Acciones correctivas y preventivas", descripcion: "Registro de acciones, responsables y verificación de eficacia.", requiereDocumento: true, carpeta: "calidad" },
      { clave: "obra-f2-balance", nombre: "Balance de obra", tipo: "Documento", descripcion: "Balance de ejecución física y financiera.", carpeta: "informes" },
      { clave: "obra-f2-mayores-menores", nombre: "Acta de mayores y menores cantidades", tipo: "Acta", descripcion: "Acta con sábana de cantidades, APUs y soportes de CDP y RP.", carpeta: "contratacion", requisitos: ["obra-f2-cantidades", "obra-f1-cdp", "obra-f1-rp"] },
      { clave: "obra-f2-informe-mensual", nombre: "Informe mensual", tipo: "Documento", descripcion: "Informe mensual de ejecución con avance, actas y evidencias.", carpeta: "informes-mensual" },
      { clave: "obra-f2-informe-semanal", nombre: "Informe semanal", tipo: "Documento", descripcion: "Informe semanal de avance y novedades.", carpeta: "informes-semanal" },
      { clave: "obra-f2-suspension", nombre: "Acta de suspensión", tipo: "Acta", descripcion: "Acta de suspensión cuando aplique, con causales y fechas.", carpeta: "contratacion" },
      { clave: "obra-f2-reinicio", nombre: "Acta de reinicio", tipo: "Acta", descripcion: "Acta de reinicio de la obra.", carpeta: "contratacion", requisitos: ["obra-f2-suspension"] },
      { clave: "obra-f2-adicion", nombre: "Acta de adición", tipo: "Acta", descripcion: "Acta de adición presupuestal cuando aplique.", carpeta: "contratacion" },
      { clave: "obra-f2-prorroga", nombre: "Acta de prórroga", tipo: "Acta", descripcion: "Acta de prórroga en tiempo cuando aplique.", carpeta: "contratacion" },
      { clave: "obra-f2-pago-anticipado", nombre: "Acta de pago anticipado", tipo: "Acta", descripcion: "Acta de pago anticipado cuando aplique.", carpeta: "finanzas" },
    ],
  },
  {
    ...FASE_3,
    actividades: [
      { clave: "obra-f3-vecindad", nombre: "Cierre de actas de vecindad", tipo: "Acta", descripcion: "Cierre y verificación de las actas de vecindad.", carpeta: "comunicaciones" },
      { clave: "obra-f3-paz-salvos", nombre: "Paz y salvos de pagos", tipo: "Documento", descripcion: "Paz y salvos de materiales, trabajadores y maquinaria.", carpeta: "contractual" },
      { clave: "obra-f3-planos-record", nombre: "Planos récord", tipo: "Documento", descripcion: "Planos récord elaborados y entregados.", carpeta: "tecnica" },
      { clave: "obra-f3-polizas-finales", nombre: "Actualización de pólizas finales", tipo: "Documento", descripcion: "Actualización de garantías para el cierre.", carpeta: "polizas" },
      {
        clave: "obra-f3-recibo-final",
        nombre: "Acta de recibo final a satisfacción",
        tipo: "Acta",
        descripcion: "Recibo final de la obra a satisfacción.",
        carpeta: "contratacion",
        requisitos: ["obra-f3-planos-record", "obra-f3-paz-salvos", "obra-f3-vecindad", "obra-f3-polizas-finales"],
      },
      { clave: "obra-f3-entrega-entidad", nombre: "Acta de entrega a la entidad territorial", tipo: "Acta", descripcion: "Entrega formal de la obra a la entidad.", carpeta: "contratacion", requisitos: ["obra-f3-recibo-final"] },
      { clave: "obra-f3-liquidacion", nombre: "Acta de liquidación", tipo: "Acta", descripcion: "Liquidación del contrato cuatro meses después del recibo final, con salvedades si aplican.", carpeta: "liquidacion", requisitos: ["obra-f3-recibo-final", "obra-f3-paz-salvos", "obra-f3-planos-record"] },
      { clave: "obra-f3-informe-cierre", nombre: "Informe de cierre final", tipo: "Documento", descripcion: "Informe final de cierre del contrato.", carpeta: "informes" },
    ],
  },
];

// Transcrito de Fases_ve_interventoria.docx (v1.1 – 30 ene 2026). Es el espejo
// de la obra: el interventor solicita, verifica y avala los entregables.
const PLANTILLA_INTERVENTORIA: FasePlantilla[] = [
  {
    ...FASE_1,
    actividades: [
      { clave: "int-f1-solicitud-contrato", nombre: "Solicitud del contrato de obra a la entidad", descripcion: "Solicitud formal del contrato y sus anexos.", requiereDocumento: true, carpeta: "comunicaciones" },
      { clave: "int-f1-contrato", nombre: "Contrato de obra", tipo: "Documento", descripcion: "Contrato de obra y anexos entregados por la entidad.", carpeta: "legalizacion" },
      { clave: "int-f1-solicitud-presupuesto", nombre: "Solicitud de presupuesto", descripcion: "Solicitud del presupuesto y APUs con los que se ejecutará la obra.", requiereDocumento: true, carpeta: "comunicaciones" },
      { clave: "int-f1-presupuesto", nombre: "Presupuesto y APUs", tipo: "Documento", descripcion: "Presupuesto de obra con análisis de precios unitarios.", carpeta: "contratacion" },
      { clave: "int-f1-solicitud-disenos", nombre: "Solicitud de diseños iniciales", descripcion: "Solicitud de estudios, diseños y especificaciones.", requiereDocumento: true, carpeta: "comunicaciones" },
      { clave: "int-f1-disenos", nombre: "Diseños y estudios iniciales", tipo: "Documento", descripcion: "Estudios, diseños y especificaciones técnicas.", carpeta: "tecnica" },
      { clave: "int-f1-solicitud-calidad", nombre: "Solicitud del plan de calidad", descripcion: "Solicitud del plan de calidad y programa de ensayos.", requiereDocumento: true, carpeta: "comunicaciones" },
      { clave: "int-f1-plan-calidad", nombre: "Plan de calidad y PGIO", tipo: "Documento", descripcion: "Programa de ensayos, planes, formatos y listas de chequeo.", carpeta: "calidad" },
      { clave: "int-f1-solicitud-cronograma", nombre: "Solicitud de la programación de obra", descripcion: "Solicitud del cronograma de ejecución.", requiereDocumento: true, carpeta: "comunicaciones" },
      { clave: "int-f1-cronograma", nombre: "Programación de obra (Gantt)", tipo: "Documento", descripcion: "Cronograma de ejecución con actividades y fechas.", carpeta: "cronograma" },
      { clave: "int-f1-verificacion-licencias", nombre: "Verificación de licencias, permisos y políticas", descripcion: "Revisión de licencias, permisos y pólizas exigidas.", requiereDocumento: true, carpeta: "legalizacion" },
      { clave: "int-f1-licencias", nombre: "Licencias, permisos y políticas", tipo: "Documento", descripcion: "Soportes de licencias, permisos y pólizas.", carpeta: "legalizacion" },
      { clave: "int-f1-polizas", nombre: "Pólizas y garantías del contrato de obra", tipo: "Documento", descripcion: "Garantías constituidas por el contratista de obra.", carpeta: "polizas" },
      { clave: "int-f1-plan-inversion", nombre: "Plan de inversión del anticipo", tipo: "Documento", descripcion: "Programación de uso del anticipo o pago anticipado.", carpeta: "finanzas" },
      { clave: "int-f1-visita", nombre: "Visita preliminar e informe de diagnóstico", descripcion: "Visita al sitio e informe de diagnóstico preliminar cuando hay hallazgos.", requiereDocumento: true, carpeta: "tecnica" },
      { clave: "int-f1-socializacion", nombre: "Socialización del proyecto", descripcion: "Chapolas, perifoneo, oficios y actas de vecindad.", requiereDocumento: true, carpeta: "comunicaciones" },
      { clave: "int-f1-actas-vecindad", nombre: "Actas de vecindad", tipo: "Acta", descripcion: "Levantamiento y definición del estado de los predios vecinos.", carpeta: "comunicaciones" },
      { clave: "int-f1-acta-comite", nombre: "Acta de reunión de comité", tipo: "Acta", descripcion: "Acta de reunión del comité del proyecto.", carpeta: "comunicaciones" },
      { clave: "int-f1-cdp", nombre: "CDP", tipo: "Documento", descripcion: "Certificado de disponibilidad presupuestal.", carpeta: "finanzas" },
      { clave: "int-f1-rp", nombre: "RP", tipo: "Documento", descripcion: "Registro presupuestal del compromiso.", carpeta: "finanzas" },
    ],
  },
  {
    ...FASE_2,
    actividades: [
      {
        clave: "int-f2-acta-inicio",
        nombre: "Acta de inicio",
        tipo: "Acta",
        descripcion: "Acta de inicio con contrato, garantías, RP, plan de inversión del anticipo, cronograma, diseños y permisos.",
        carpeta: "contratacion",
        requisitos: ["int-f1-contrato", "int-f1-polizas", "int-f1-rp", "int-f1-plan-inversion", "int-f1-cronograma", "int-f1-disenos", "int-f1-licencias"],
      },
      { clave: "int-f2-anticipo", nombre: "Validación de anticipo o pago anticipado", tipo: "Acta", descripcion: "Verificación del desembolso y su aplicación.", carpeta: "finanzas", requisitos: ["int-f2-acta-inicio"] },
      { clave: "int-f2-pgio", nombre: "Revisión de la implementación del PGIO", descripcion: "Seguimiento a la implementación del plan de calidad.", requiereDocumento: true, carpeta: "calidad" },
      { clave: "int-f2-cronograma", nombre: "Revisión de la implementación del cronograma", descripcion: "Seguimiento del avance frente a la programación.", requiereDocumento: true, carpeta: "cronograma" },
      { clave: "int-f2-bitacora", nombre: "Bitácora de obra", descripcion: "Revisión y seguimiento de la bitácora.", requiereDocumento: true, carpeta: "bitacora" },
      { clave: "int-f2-registro", nombre: "Registro fotográfico", descripcion: "Evidencia fotográfica del avance de la obra.", requiereDocumento: true, carpeta: "registro" },
      { clave: "int-f2-cantidades", nombre: "Cantidades de obra y preacta", descripcion: "Verificación de cantidades ejecutadas y preacta.", requiereDocumento: true, carpeta: "control" },
      { clave: "int-f2-cobros", nombre: "Actas de cobro parcial y final", tipo: "Acta", descripcion: "Revisión y aval de las actas de cobro.", carpeta: "contratacion", requisitos: ["int-f2-cantidades"] },
      { clave: "int-f2-planos", nombre: "Seguimiento de planos y señalización", descripcion: "Verificación de planos actualizados y señalización de lo construido.", requiereDocumento: true, carpeta: "tecnica" },
      { clave: "int-f2-ensayos", nombre: "Ensayos y apoyos técnicos", tipo: "Documento", descripcion: "Resultados de ensayos, conceptos técnicos y fichas.", carpeta: "calidad" },
      { clave: "int-f2-comites", nombre: "Comités técnicos", descripcion: "Participación y seguimiento de comités técnicos.", requiereDocumento: true, carpeta: "comunicaciones" },
      { clave: "int-f2-acciones", nombre: "Acciones correctivas, preventivas y balance", tipo: "Documento", descripcion: "Seguimiento de acciones y balance de obra.", carpeta: "calidad" },
      { clave: "int-f2-mayores-menores", nombre: "Acta de mayores y menores cantidades", tipo: "Acta", descripcion: "Revisión del acta con sábana de cantidades, APUs, CDP y RP.", carpeta: "contratacion", requisitos: ["int-f2-cantidades", "int-f1-cdp", "int-f1-rp"] },
      { clave: "int-f2-informe-mensual", nombre: "Informe mensual", tipo: "Documento", descripcion: "Informe mensual de interventoría.", carpeta: "informes-mensual" },
      { clave: "int-f2-informe-semanal", nombre: "Informe semanal", tipo: "Documento", descripcion: "Informe semanal de avance y novedades.", carpeta: "informes-semanal" },
      { clave: "int-f2-suspension", nombre: "Acta de suspensión", tipo: "Acta", descripcion: "Acta de suspensión cuando aplique.", carpeta: "contratacion" },
      { clave: "int-f2-reinicio", nombre: "Acta de reinicio", tipo: "Acta", descripcion: "Acta de reinicio de la obra.", carpeta: "contratacion", requisitos: ["int-f2-suspension"] },
      { clave: "int-f2-adicion", nombre: "Acta de adición", tipo: "Acta", descripcion: "Acta de adición presupuestal cuando aplique.", carpeta: "contratacion" },
      { clave: "int-f2-prorroga", nombre: "Acta de prórroga", tipo: "Acta", descripcion: "Acta de prórroga en tiempo cuando aplique.", carpeta: "contratacion" },
      { clave: "int-f2-pago-anticipado", nombre: "Acta de pago anticipado", tipo: "Acta", descripcion: "Acta de pago anticipado cuando aplique.", carpeta: "finanzas" },
    ],
  },
  {
    ...FASE_3,
    actividades: [
      { clave: "int-f3-vecindad", nombre: "Cierre de actas de vecindad", tipo: "Acta", descripcion: "Cierre y verificación de las actas de vecindad.", carpeta: "comunicaciones" },
      { clave: "int-f3-paz-salvos", nombre: "Paz y salvos de pagos", tipo: "Documento", descripcion: "Paz y salvos de materiales, trabajadores y maquinaria.", carpeta: "contractual" },
      { clave: "int-f3-planos-record", nombre: "Planos récord", tipo: "Documento", descripcion: "Verificación de planos récord elaborados y entregados.", carpeta: "tecnica" },
      { clave: "int-f3-polizas-finales", nombre: "Actualización de pólizas finales", tipo: "Documento", descripcion: "Verificación de garantías para el cierre.", carpeta: "polizas" },
      {
        clave: "int-f3-recibo-final",
        nombre: "Acta de recibo final a satisfacción",
        tipo: "Acta",
        descripcion: "Recibo final de la obra a satisfacción.",
        carpeta: "contratacion",
        requisitos: ["int-f3-planos-record", "int-f3-paz-salvos", "int-f3-vecindad", "int-f3-polizas-finales"],
      },
      { clave: "int-f3-entrega-entidad", nombre: "Acta de entrega a la entidad territorial", tipo: "Acta", descripcion: "Entrega formal de la obra a la entidad.", carpeta: "contratacion", requisitos: ["int-f3-recibo-final"] },
      { clave: "int-f3-liquidacion", nombre: "Acta de liquidación", tipo: "Acta", descripcion: "Liquidación del contrato con salvedades si aplican.", carpeta: "liquidacion", requisitos: ["int-f3-recibo-final", "int-f3-paz-salvos", "int-f3-planos-record"] },
      { clave: "int-f3-informe-final", nombre: "Informe final de interventoría", tipo: "Documento", descripcion: "Informe final y cierre documental de la interventoría.", carpeta: "informes" },
    ],
  },
];

export function plantillaDe(tipo: TipoContrato): FasePlantilla[] {
  return tipo === "Obra" ? PLANTILLA_OBRA : PLANTILLA_INTERVENTORIA;
}

const COLUMNA_POR_ESTADO: Record<string, string> = {
  Completado: "completado",
  "En ejecución": "en-curso",
  "No realizado": "por-hacer",
};

function etiquetaActividad(fase: FaseEdt, tipo: string): string {
  return `F${fase.orden} · ${tipo}`.slice(0, 60);
}

async function proyectoRef(db: Consulta, proyectoId: string): Promise<ProyectoRef> {
  const { rows } = await db.query<ProyectoRef>(
    `SELECT id, nombre, lider_id AS "liderId", estructura
       FROM proyectos WHERE id = $1`,
    [proyectoId],
  );
  if (!rows[0]) throw new Error(`Proyecto no encontrado: ${proyectoId}`);
  return rows[0];
}

export async function crearTableroFase(
  db: Consulta,
  proyecto: ProyectoRef,
  fase: FaseEdt,
): Promise<string> {
  const { rows: existentes } = await db.query<{ id: string }>(
    "SELECT id FROM tableros WHERE fase_id = $1 LIMIT 1",
    [fase.id],
  );
  if (existentes[0]) return existentes[0].id;

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO tableros (nombre, descripcion, proyecto_id, fase_id, tipo, creado_por)
     VALUES ($1, $2, $3, $4, 'Fase', $5)
     RETURNING id`,
    [
      `F${fase.orden} · ${fase.nombre}`.slice(0, 120),
      `Tablero automático de la fase "${fase.nombre}" del proyecto ${proyecto.id}.`,
      proyecto.id,
      fase.id,
      proyecto.liderId,
    ],
  );
  return rows[0].id;
}

export async function crearTareaActividad(
  db: Consulta,
  proyecto: ProyectoRef,
  fase: FaseEdt,
  actividad: {
    id: string;
    nombre: string;
    descripcion: string;
    tipo: string;
    responsable: string | null;
    responsableId: string | null;
    estado: string;
    prioridad: string;
    fechaCumplimiento: string | null;
    orden: number;
  },
): Promise<void> {
  const { rows: existente } = await db.query(
    "SELECT 1 FROM tareas_tablero WHERE edt_actividad_id = $1 LIMIT 1",
    [actividad.id],
  );
  if (existente[0]) return;

  const tableroId = await crearTableroFase(db, proyecto, fase);
  await db.query(
    `INSERT INTO tareas_tablero
       (tablero_id, proyecto_id, titulo, descripcion, columna, responsable, responsable_id,
        edt_actividad_id, creado_por, prioridad, fecha_limite, etiqueta, orden)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      tableroId,
      proyecto.id,
      actividad.nombre || "Sin nombre",
      [actividad.descripcion, actividad.tipo !== "Actividad" ? `Tipo: ${actividad.tipo}.` : ""]
        .filter(Boolean)
        .join(" "),
      COLUMNA_POR_ESTADO[actividad.estado] ?? "por-hacer",
      actividad.responsable || "Sin asignar",
      actividad.responsableId,
      actividad.id,
      proyecto.liderId,
      actividad.prioridad || "Alta",
      actividad.fechaCumplimiento,
      etiquetaActividad(fase, actividad.tipo),
      actividad.orden,
    ],
  );
}

export async function sincronizarTareasDeActividad(db: Consulta, actividadId: string): Promise<void> {
  const { rows } = await db.query<{
    nombre: string;
    descripcion: string;
    estado: string;
    prioridad: string;
    fecha: string | null;
    responsable: string | null;
    responsableId: string | null;
    tipo: string;
    faseOrden: number;
  }>(
    `SELECT a.actividad AS nombre, a.descripcion, a.estado, a.prioridad,
            a.fecha_cumplimiento AS fecha, a.responsable, a.responsable_id AS "responsableId",
            a.tipo, COALESCE(f.orden, a.etapa) AS "faseOrden"
       FROM edt_actividades a
       LEFT JOIN edt_fases f ON f.id = a.fase_id
      WHERE a.id = $1`,
    [actividadId],
  );
  const actividad = rows[0];
  if (!actividad) return;

  await db.query(
    `UPDATE tareas_tablero t
        SET titulo = $2,
            descripcion = $3,
            prioridad = $4,
            fecha_limite = $5,
            responsable = COALESCE($6, responsable),
            responsable_id = $7,
            etiqueta = $8,
            columna = n.columna,
            completado_en = CASE
              WHEN n.columna = 'completado' THEN COALESCE(t.completado_en, now())
              WHEN t.columna = 'completado' THEN NULL
              ELSE t.completado_en
            END
       FROM (
         SELECT id,
                CASE
                  WHEN $9 = 'Completado' THEN 'completado'
                  WHEN $9 = 'En ejecución' AND columna IN ('por-hacer', 'completado') THEN 'en-curso'
                  WHEN $9 = 'No realizado' AND columna IN ('en-curso', 'completado') THEN 'por-hacer'
                  ELSE columna
                END AS columna
           FROM tareas_tablero
          WHERE edt_actividad_id = $1
       ) n
      WHERE t.id = n.id`,
    [
      actividadId,
      actividad.nombre || "Sin nombre",
      [actividad.descripcion, actividad.tipo !== "Actividad" ? `Tipo: ${actividad.tipo}.` : ""]
        .filter(Boolean)
        .join(" "),
      actividad.prioridad || "Alta",
      actividad.fecha,
      actividad.responsable,
      actividad.responsableId,
      `F${actividad.faseOrden} · ${actividad.tipo}`.slice(0, 60),
      actividad.estado,
    ],
  );
}

async function fasesDeProyecto(db: Consulta, proyectoId: string): Promise<FaseEdt[]> {
  const { rows } = await db.query<FaseEdt>(
    `SELECT id, proyecto_id AS "proyectoId", nombre, descripcion, clave, orden,
            es_principal AS "esPrincipal", depende_de_fase_id AS "dependeDeFaseId"
       FROM edt_fases WHERE proyecto_id = $1 ORDER BY orden, creado_en`,
    [proyectoId],
  );
  return rows;
}

export async function asegurarFasesProyecto(
  db: Consulta,
  proyectoId: string,
  tipoContrato: TipoContrato,
): Promise<FaseEdt[]> {
  const proyecto = await proyectoRef(db, proyectoId);
  let fases = await fasesDeProyecto(db, proyectoId);
  if (!fases.length) {
    const base = plantillaDe(tipoContrato).map((fase) => ({
      clave: fase.clave,
      nombre: fase.nombre,
      descripcion: fase.descripcion,
    }));
    let anterior: string | null = null;
    for (const [indice, fase] of base.entries()) {
      const insertada: { id: string }[] = (
        await db.query<{ id: string }>(
          `INSERT INTO edt_fases
             (proyecto_id, nombre, descripcion, clave, orden, es_principal, depende_de_fase_id)
           VALUES ($1, $2, $3, $4, $5, true, $6)
           RETURNING id`,
          [proyectoId, fase.nombre, fase.descripcion, fase.clave, indice + 1, anterior],
        )
      ).rows;
      anterior = insertada[0].id;
    }
    fases = await fasesDeProyecto(db, proyectoId);
  }

  // Las actividades anteriores al modelo por fases se conservan y se ubican
  // en la fase principal equivalente a su etapa.
  await db.query(
    `UPDATE edt_actividades a
        SET fase_id = f.id
       FROM edt_fases f
      WHERE a.proyecto_id = $1 AND a.fase_id IS NULL
        AND f.proyecto_id = $1 AND f.es_principal AND f.orden = LEAST(3, a.etapa)`,
    [proyectoId],
  );

  for (const fase of fases) {
    await crearTableroFase(db, proyecto, fase);
  }
  return fases;
}

export async function sembrarChecklist(
  db: Consulta,
  proyectoId: string,
  tipoContrato: TipoContrato,
): Promise<{
  fasesCreadas: number;
  actividadesCreadas: number;
  tablerosCreados: number;
  tareasCreadas: number;
}> {
  const proyecto = await proyectoRef(db, proyectoId);
  const antes = await fasesDeProyecto(db, proyectoId);
  const { rows: tablerosAntes } = await db.query<{ total: number }>(
    "SELECT COUNT(*)::int AS total FROM tableros WHERE proyecto_id = $1",
    [proyectoId],
  );
  const fases = await asegurarFasesProyecto(db, proyectoId, tipoContrato);
  const plantilla = plantillaDe(tipoContrato);
  let actividadesCreadas = 0;

  const fasePorClave = new Map(fases.map((fase) => [fase.clave, fase]));
  const actividadPorClave = new Map<string, string>();

  for (const fasePlantilla of plantilla) {
    const fase = fasePorClave.get(fasePlantilla.clave);
    if (!fase) continue;

    for (const [indice, item] of fasePlantilla.actividades.entries()) {
      const { rows: existentes } = await db.query<{ id: string }>(
        "SELECT id FROM edt_actividades WHERE proyecto_id = $1 AND plantilla_clave = $2",
        [proyectoId, item.clave],
      );
      if (existentes[0]) {
        actividadPorClave.set(item.clave, existentes[0].id);
        continue;
      }

      const tipo = item.tipo ?? "Actividad";
      const requiereDocumento =
        item.requiereDocumento ?? (tipo === "Documento" || tipo === "Acta");
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO edt_actividades
           (proyecto_id, fase_id, etapa, actividad, descripcion, tipo, plantilla_clave,
            prioridad, requiere_documento, carpeta, estado, orden)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Alta', $8, $9, 'No realizado', $10)
         RETURNING id`,
        [
          proyectoId,
          fase.id,
          Math.min(3, fase.orden),
          item.nombre,
          item.descripcion ?? "",
          tipo,
          item.clave,
          requiereDocumento,
          sugerirCarpeta(proyecto.estructura, item.carpeta),
          indice + 1,
        ],
      );
      actividadPorClave.set(item.clave, rows[0].id);
      actividadesCreadas += 1;
    }
  }

  for (const fasePlantilla of plantilla) {
    for (const item of fasePlantilla.actividades) {
      const actividadId = actividadPorClave.get(item.clave);
      if (!actividadId || !item.requisitos?.length) continue;
      for (const requisito of item.requisitos) {
        const requisitoId = actividadPorClave.get(requisito);
        if (!requisitoId || requisitoId === actividadId) continue;
        await db.query(
          `INSERT INTO edt_requisitos (actividad_id, requisito_id)
           SELECT $1, $2 WHERE NOT EXISTS (
             SELECT 1 FROM edt_requisitos WHERE actividad_id = $1 AND requisito_id = $2
           )`,
          [actividadId, requisitoId],
        );
      }
    }
  }

  let tareasCreadas = 0;
  const { rows: actividades } = await db.query<{
    id: string;
    nombre: string;
    descripcion: string;
    tipo: string;
    responsable: string | null;
    responsableId: string | null;
    estado: string;
    prioridad: string;
    fechaCumplimiento: string | null;
    orden: number;
    faseId: string | null;
  }>(
    `SELECT id, actividad AS nombre, descripcion, tipo, responsable,
            responsable_id AS "responsableId", estado, prioridad,
            fecha_cumplimiento AS "fechaCumplimiento", orden, fase_id AS "faseId"
       FROM edt_actividades WHERE proyecto_id = $1 AND fase_id IS NOT NULL`,
    [proyectoId],
  );
  const fasePorId = new Map(fases.map((fase) => [fase.id, fase]));
  for (const actividad of actividades) {
    const fase = actividad.faseId ? fasePorId.get(actividad.faseId) : null;
    if (!fase) continue;
    const { rows: tarea } = await db.query(
      "SELECT 1 FROM tareas_tablero WHERE edt_actividad_id = $1 LIMIT 1",
      [actividad.id],
    );
    if (tarea[0]) continue;
    await crearTareaActividad(db, proyecto, fase, actividad);
    tareasCreadas += 1;
  }

  const { rows: tablerosDespues } = await db.query<{ total: number }>(
    "SELECT COUNT(*)::int AS total FROM tableros WHERE proyecto_id = $1",
    [proyectoId],
  );

  return {
    fasesCreadas: Math.max(0, fases.length - antes.length),
    actividadesCreadas,
    tablerosCreados: Math.max(0, tablerosDespues[0].total - tablerosAntes[0].total),
    tareasCreadas,
  };
}
