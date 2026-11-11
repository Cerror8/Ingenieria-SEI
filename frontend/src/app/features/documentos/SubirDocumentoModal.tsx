import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Upload, X } from "lucide-react";
import { api, ApiError, type ProyectoApi } from "../../api/client";

const TIPOS = ["Actas", "Informes", "Antecedentes", "Evidencias", "Documentación técnica", "Comunicaciones", "Otros"];
const ESTADOS = ["En revisión", "Aprobado", "Borrador", "Rechazado"] as const;
const ACEPTADOS = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt";

export function SubirDocumentoModal({
  abierto,
  proyectoId,
  onCerrar,
  onSubido,
}: {
  abierto: boolean;
  proyectoId?: string;
  onCerrar: () => void;
  onSubido: () => void;
}) {
  const [proyectos, setProyectos] = useState<ProyectoApi[]>([]);
  const [proyectoSel, setProyectoSel] = useState(proyectoId ?? "");
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]>("En revisión");
  const [carpetas, setCarpetas] = useState<string[]>([]);
  const [carpeta, setCarpeta] = useState("");
  const [nombre, setNombre] = useState("");
  const [fechaDocumento, setFechaDocumento] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setProyectoSel(proyectoId ?? "");
    setTipo(TIPOS[0]);
    setEstado("En revisión");
    setCarpeta("");
    setNombre("");
    setFechaDocumento("");
    setNumeroDocumento("");
    setArchivo(null);
    setError(null);
    if (!proyectoId) {
      api
        .proyectos()
        .then((r) => setProyectos(r.proyectos))
        .catch(() => setError("No se pudieron cargar los proyectos."));
    }
  }, [abierto, proyectoId]);

  useEffect(() => {
    if (!abierto || !proyectoSel) {
      setCarpetas([]);
      return;
    }

    let vigente = true;
    setCarpeta("");

    api
      .proyecto(proyectoSel)
      .then(({ proyecto }) =>
        proyecto.estructura ? api.estructura(proyecto.estructura) : null,
      )
      .then((respuesta) => {
        if (vigente) setCarpetas(respuesta?.estructura.carpetas ?? []);
      })
      .catch(() => {
        if (vigente) setCarpetas([]);
      });

    return () => {
      vigente = false;
    };
  }, [abierto, proyectoSel]);

  if (!abierto) return null;

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enviando) return;
    if (!proyectoSel) return setError("Selecciona el proyecto.");
    if (!fechaDocumento) return setError("Indica la fecha del documento.");
    if (!archivo) return setError("Selecciona un archivo.");

    setEnviando(true);
    setError(null);

    try {
      await api.subirDocumento(archivo, {
        proyectoId: proyectoSel,
        tipo,
        carpeta: carpeta || null,
        estado,
        version: "v1.0",
        nombre: nombre.trim() || undefined,
        fechaDocumento,
        numeroDocumento: numeroDocumento.trim() || null,
      });
      onSubido();
      onCerrar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo subir el documento.");
    } finally {
      setEnviando(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-bold text-gray-900">Cargar documento</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="space-y-4 px-5 py-4" onSubmit={enviar}>
          {!proyectoId && (
            <div className="space-y-1.5">
              <label htmlFor="proyecto" className="text-xs font-semibold text-slate-700">Proyecto</label>
              <select
                id="proyecto"
                required
                value={proyectoSel}
                onChange={(e) => setProyectoSel(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10"
              >
                <option value="">Selecciona un proyecto</option>
                {proyectos.map((p) => (
                  <option key={p.id} value={p.id}>{p.id} · {p.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="tipo" className="text-xs font-semibold text-slate-700">Tipo</label>
              <select
                id="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10"
              >
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="estado" className="text-xs font-semibold text-slate-700">Estado</label>
              <select
                id="estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value as (typeof ESTADOS)[number])}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10"
              >
                {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>

          {carpetas.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="carpeta" className="text-xs font-semibold text-slate-700">Carpeta</label>
              <select
                id="carpeta"
                value={carpeta}
                onChange={(e) => setCarpeta(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10"
              >
                <option value="">Raíz del proyecto</option>
                {carpetas.map((ruta) => (
                  <option key={ruta} value={ruta}>{ruta}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="nombre" className="text-xs font-semibold text-slate-700">
              Nombre del documento <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              id="nombre"
              type="text"
              maxLength={200}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Si lo dejas vacío se usa el nombre del archivo"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="fecha-documento" className="text-xs font-semibold text-slate-700">
                Fecha del documento <span className="font-normal text-slate-400">(obligatoria)</span>
              </label>
              <input
                id="fecha-documento"
                type="date"
                required
                disabled={enviando}
                value={fechaDocumento}
                onChange={(e) => setFechaDocumento(e.target.value)}
                aria-describedby="fecha-documento-ayuda"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10 disabled:opacity-60"
              />
              <p id="fecha-documento-ayuda" className="text-[11px] text-slate-400">
                Fecha interna del documento, independiente de la fecha de subida.
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="numero-documento" className="text-xs font-semibold text-slate-700">
                Número acta/documento <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                id="numero-documento"
                type="text"
                maxLength={80}
                disabled={enviando}
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="archivo" className="text-xs font-semibold text-slate-700">Archivo</label>
            <input
              id="archivo"
              type="file"
              required
              accept={ACEPTADOS}
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#C2410C] hover:file:bg-orange-100"
            />
            <p className="text-[11px] text-slate-400">
              PDF, Word, Excel, PowerPoint, imágenes o TXT · máximo 20 MB
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="inline-flex items-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {enviando ? "Subiendo…" : "Subir documento"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
