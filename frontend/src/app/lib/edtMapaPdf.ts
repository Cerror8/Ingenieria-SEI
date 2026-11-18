export type EstadoMapa = "Completado" | "En ejecución" | "No realizado" | "No aplica" | "Pendiente";

export type FaseMapa = {
  etiqueta: string;
  nombre: string;
  actividades: Array<{ nombre: string; estado: EstadoMapa }>;
};

const TINTA = [51, 65, 85] as const;
const GRIS = [100, 116, 139] as const;
const NARANJA = [194, 65, 12] as const;

const TONO: Record<EstadoMapa, { fondo: [number, number, number]; borde: [number, number, number]; texto: [number, number, number] }> = {
  Completado: { fondo: [236, 253, 245], borde: [16, 185, 129], texto: [4, 120, 87] },
  "En ejecución": { fondo: [255, 251, 235], borde: [245, 158, 11], texto: [180, 83, 9] },
  "No realizado": { fondo: [254, 242, 242], borde: [251, 113, 133], texto: [190, 18, 60] },
  "No aplica": { fondo: [255, 255, 255], borde: [203, 213, 225], texto: [148, 163, 184] },
  Pendiente: { fondo: [248, 250, 252], borde: [203, 213, 225], texto: [100, 116, 139] },
};

export async function descargarMapaConceptualEdt(proyecto: string, fases: FaseMapa[]): Promise<void> {
  const doc = await generarMapaConceptualEdt(proyecto, fases);
  const nombre = `Mapa conceptual EDT - ${proyecto}`.replace(/[\\/:*?"<>|]/g, "_").slice(0, 120);
  doc.save(`${nombre}.pdf`);
}

export async function generarMapaConceptualEdt(proyecto: string, fases: FaseMapa[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });

  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const margen = 24;
  const separacion = 12;
  const anchoFase = (ancho - margen * 2 - separacion * Math.max(0, fases.length - 1)) / Math.max(1, fases.length);

  const total = fases.reduce((suma, fase) => suma + fase.actividades.length, 0);
  const hechas = fases.reduce(
    (suma, fase) => suma + fase.actividades.filter((item) => item.estado === "Completado").length,
    0,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...TINTA);
  doc.text("Mapa conceptual del EDT", margen, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRIS);
  doc.text(`${proyecto} · ${hechas} de ${total} actividades completadas (${total ? Math.round((hechas / total) * 100) : 0}%)`, margen, 45);

  const leyenda: Array<{ texto: string; estado: EstadoMapa }> = [
    { texto: "Completada", estado: "Completado" },
    { texto: "En ejecución", estado: "En ejecución" },
    { texto: "No realizada", estado: "No realizado" },
    { texto: "No aplica", estado: "No aplica" },
    { texto: "Pendiente de cargar", estado: "Pendiente" },
  ];
  let xLeyenda = ancho - margen - 470;
  for (const item of leyenda) {
    const tono = TONO[item.estado];
    doc.setDrawColor(...tono.borde);
    doc.setFillColor(...tono.fondo);
    doc.roundedRect(xLeyenda, 22, 10, 10, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(item.texto, xLeyenda + 14, 30.5);
    xLeyenda += 92;
  }

  const raizAncho = 320;
  const raizX = ancho / 2 - raizAncho / 2;
  const raizY = 58;
  const raizAlto = 28;
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(...NARANJA);
  doc.roundedRect(raizX, raizY, raizAncho, raizAlto, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NARANJA);
  doc.text(`EDT · ${proyecto}`.slice(0, 60), ancho / 2, raizY + 18, { align: "center" });

  const cabeceraY = 108;
  const cabeceraAlto = 30;
  const inicioY = cabeceraY + cabeceraAlto + 14;

  fases.forEach((fase, indice) => {
    const x = margen + indice * (anchoFase + separacion);
    const centro = x + anchoFase / 2;

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(1);
    doc.line(ancho / 2, raizY + raizAlto, ancho / 2, raizY + raizAlto + 8);
    doc.line(ancho / 2, raizY + raizAlto + 8, centro, raizY + raizAlto + 8);
    doc.line(centro, raizY + raizAlto + 8, centro, cabeceraY);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...TONO.Completado.borde);
    doc.roundedRect(x, cabeceraY, anchoFase, cabeceraAlto, 5, 5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NARANJA);
    doc.text(fase.etiqueta, x + 8, cabeceraY + 12);
    doc.setFontSize(8);
    doc.setTextColor(...TINTA);
    doc.text(recortar(doc, fase.nombre, anchoFase - 16), x + 8, cabeceraY + 23);

    const columnaX = x + 20;
    const anchoCaja = anchoFase - 26;
    const altoCaja = 18;
    const paso = 20;
    const altoDisponible = alto - margen - inicioY;
    const maximo = Math.max(1, Math.floor(altoDisponible / paso));
    const visibles = fase.actividades.slice(0, maximo);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(1.2);
    const finEspina = inicioY + Math.max(0, visibles.length - 1) * paso + altoCaja / 2;
    doc.line(x + 10, cabeceraY + cabeceraAlto, x + 10, finEspina);

    visibles.forEach((actividad, posicion) => {
      const y = inicioY + posicion * paso;
      const tono = TONO[actividad.estado];
      doc.setDrawColor(...tono.borde);
      doc.setLineWidth(0.8);
      if (actividad.estado === "No aplica") doc.setLineDashPattern([2, 2], 0);
      doc.setFillColor(...tono.fondo);
      doc.roundedRect(columnaX, y, anchoCaja, altoCaja, 3, 3, "FD");
      doc.setLineDashPattern([], 0);

      doc.setDrawColor(203, 213, 225);
      doc.line(x + 10, y + altoCaja / 2, columnaX, y + altoCaja / 2);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.6);
      doc.setTextColor(...tono.texto);
      const lineas = partirTexto(doc, actividad.nombre, anchoCaja - 10, 2);
      lineas.forEach((linea, salto) => {
        doc.text(linea, columnaX + 5, y + 7.5 + salto * 7.2);
      });
    });

    if (fase.actividades.length > visibles.length) {
      const y = inicioY + visibles.length * paso;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(...GRIS);
      doc.text(`+ ${fase.actividades.length - visibles.length} actividad(es) más`, columnaX, y + 6);
    }
  });

  return doc;
}

function recortar(doc: { getTextWidth: (texto: string) => number }, texto: string, ancho: number): string {
  if (doc.getTextWidth(texto) <= ancho) return texto;
  let recorte = texto;
  while (recorte.length > 1 && doc.getTextWidth(`${recorte}…`) > ancho) {
    recorte = recorte.slice(0, -1);
  }
  return `${recorte}…`;
}

function partirTexto(
  doc: { getTextWidth: (texto: string) => number },
  texto: string,
  ancho: number,
  maximo: number,
): string[] {
  const palabras = texto.split(/\s+/);
  const lineas: string[] = [];
  let actual = "";

  for (const palabra of palabras) {
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (doc.getTextWidth(candidata) <= ancho) {
      actual = candidata;
    } else {
      if (actual) lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);

  if (lineas.length <= maximo) return lineas.length ? lineas : [""];
  const visibles = lineas.slice(0, maximo);
  visibles[maximo - 1] = recortar(
    doc,
    `${visibles[maximo - 1]} ${lineas.slice(maximo).join(" ")}`,
    ancho,
  );
  return visibles;
}
