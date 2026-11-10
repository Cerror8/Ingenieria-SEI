import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, X } from "lucide-react";
import { api, ApiError } from "../../api/client";
import type { Document, DocStatus } from "../../types";

const TIPOS = ["Ficha técnica", "Actas", "Informes", "Antecedentes", "Evidencias", "Otros"];
const ESTADOS: DocStatus[] = ["En revisión", "Aprobado", "Borrador", "Rechazado"];
const ACEPTADOS = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt";

export function ActualizarDocumentoModal({
  abierto,
  documento,
  onCerrar,
  onActualizado,
}: {
  abierto: boolean;
  documento: Document | null;
  onCerrar: () => void;
  onActualizado: () => void;
}) {
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [estado, setEstado] = useState<DocStatus>("En revisión");
  const [carpetas, setCarpetas] = useState<string[]>([]);
  const [carpeta, setCarpeta] = useState("");
  const [nombre, setNombre] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || !documento) return;
    setTipo(documento.type);
    setEstado(documento.status);
    setCarpeta(documento.folder ?? "");
    setNombre(documento.name);
    setArchivo(null);
    setError(null);
  }, [abierto, documento]);

  useEffect(() => {
    if (!abierto || !documento) {
      setCarpetas([]);
      return;
    }

    let vigente = true;
    api
      .proyecto(documento.projectId)
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
  }, [abierto, documento]);

  if (!abierto || !documento) return null;

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEnviando(true);
    setError(null);

    try {
      await api.actualizarDocumento(
        documento.id,
        {
          nombre: nombre.trim() || undefined,
          tipo,
          carpeta: carpetas.length > 0 ? carpeta || null : undefined,
          estado,
        },
        archivo ?? undefined,
      );
      onActualizado();
      onCerrar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo actualizar el documento.");
    } finally {
      setEnviando(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Actualizar documento</h2>
            <p className="mt-0.5 text-[11px] text-gray-400">
              {documento.projectId} · versión actual {documento.version}
            </p>
          </div>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="edit-tipo" className="text-xs font-semibold text-slate-700">Tipo</label>
              <select
                id="edit-tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10"
              >
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-estado" className="text-xs font-semibold text-slate-700">Estado</label>
              <select
                id="edit-estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value as DocStatus)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10"
              >
                {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>

          {carpetas.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="edit-carpeta" className="text-xs font-semibold text-slate-700">Carpeta</label>
              <select
                id="edit-carpeta"
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
            <label htmlFor="edit-nombre" className="text-xs font-semibold text-slate-700">
              Nombre del documento
            </label>
            <input
              id="edit-nombre"
              type="text"
              maxLength={200}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-archivo" className="text-xs font-semibold text-slate-700">
              Nuevo archivo <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              id="edit-archivo"
              type="file"
              accept={ACEPTADOS}
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#C2410C] hover:file:bg-orange-100"
            />
            <p className="text-[11px] text-slate-400">
              {archivo
                ? `Se guardará como ${siguienteVersion(documento.version)} y reemplazará el archivo actual.`
                : `Archivo actual: ${documento.fileName ?? "sin archivo"} · máximo 20 MB`}
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
              <RefreshCw className="h-4 w-4" />
              {enviando ? "Actualizando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function siguienteVersion(version: string): string {
  const resultado = /^v?(\d+)\.(\d+)$/i.exec(version.trim());
  return resultado ? `v${resultado[1]}.${Number(resultado[2]) + 1}` : "v1.1";
}
