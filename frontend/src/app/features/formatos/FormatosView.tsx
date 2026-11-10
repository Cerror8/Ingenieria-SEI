import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ClipboardList,
  Download,
  Eye,
  FileSpreadsheet,
  FolderDown,
  Pencil,
  Plus,
  Send,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import {
  api,
  fechaCorta,
  type FormatoApi,
  type RegistroFormatoApi,
  type ValorReferenciaApi,
  type ValorTablaApi,
} from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { CargandoModule, ErrorModule } from "../../components/DataState";
import { AnalizarValorModal } from "./AnalizarValorModal";
import { ValorPreviewModal } from "./ValorPreviewModal";
import { normalizarEtiqueta } from "./tablasExcel";

const TIPOS_VALOR = ["Presupuesto", "APU", "EDT", "Cronograma", "Otro"];

const sePuedeAnalizar = (nombre: string) => /\.(xlsx|xls|csv)$/i.test(nombre);

const TAMANO_LEGIBLE = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

export function FormatosView() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === "admin";
  const [valores, setValores] = useState<ValorReferenciaApi[] | null>(null);
  const [formatos, setFormatos] = useState<FormatoApi[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalValor, setModalValor] = useState(false);
  const [valorEditar, setValorEditar] = useState<ValorReferenciaApi | null>(null);
  const [modalFormato, setModalFormato] = useState(false);
  const [formatoEditar, setFormatoEditar] = useState<FormatoApi | null>(null);
  const [formatoActivo, setFormatoActivo] = useState<FormatoApi | null>(null);
  const [valorPreview, setValorPreview] = useState<ValorReferenciaApi | null>(null);
  const [valorAnalisis, setValorAnalisis] = useState<ValorReferenciaApi | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      const [rValores, rFormatos] = await Promise.all([api.valores(), api.formatos()]);
      setValores(rValores.valores);
      setFormatos(rFormatos.formatos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el módulo de Formatos.");
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const mostrarAviso = (mensaje: string) => {
    setAviso(mensaje);
    window.setTimeout(() => setAviso(null), 4000);
  };

  const eliminarValor = async (valor: ValorReferenciaApi) => {
    if (!window.confirm(`¿Eliminar el valor de referencia “${valor.nombre}”? Los formatos asociados quedarán sin valor base.`)) return;
    try {
      await api.eliminarValor(valor.id);
      mostrarAviso(`Valor “${valor.nombre}” eliminado.`);
      void cargar();
    } catch (e) {
      mostrarAviso(e instanceof Error ? e.message : "No se pudo eliminar el valor");
    }
  };

  const eliminarFormato = async (formato: FormatoApi) => {
    const mensaje = formato.esReferencia
      ? `¿Desactivar el formato de referencia “${formato.nombre}”? Conserva sus ${formato.totalRegistros} registro(s), pero deja de aparecer en la lista.`
      : `¿Eliminar el formato “${formato.nombre}” junto con sus ${formato.totalRegistros} registro(s)?`;
    if (!window.confirm(mensaje)) return;
    try {
      await api.eliminarFormato(formato.id);
      mostrarAviso(
        formato.esReferencia
          ? `Formato de referencia “${formato.nombre}” desactivado.`
          : `Formato “${formato.nombre}” eliminado.`,
      );
      void cargar();
    } catch (e) {
      mostrarAviso(e instanceof Error ? e.message : "No se pudo eliminar el formato");
    }
  };

  if (error) return <ErrorModule mensaje={error} onRetry={cargar} />;
  if (valores === null || formatos === null) return <CargandoModule mensaje="Cargando Formatos…" />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Formatos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Valores de referencia preestablecidos y formatos que se diligencian desde la plataforma.
        </p>
      </div>

      {aviso && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {aviso}
        </div>
      )}

      <section className="rounded-2xl border border-gray-100 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C2410C]/10">
              <FolderDown className="h-4 w-4 text-[#C2410C]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">Valores de referencia</h2>
              <p className="text-xs text-gray-400">
                {valores.length === 0 ? "Sin archivos subidos" : `${valores.length} archivo(s)`}
              </p>
            </div>
          </div>
          {esAdmin && (
            <button
              type="button"
              onClick={() => setModalValor(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#C2410C] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#9A3412]"
            >
              <Plus className="h-3.5 w-3.5" />
              Subir valor
            </button>
          )}
        </div>

        {valores.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-gray-400">
            Sube aquí los Excel de valores (presupuesto, APU, EDT) que servirán de base para los formatos.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {valores.map((valor) => (
              <li key={valor.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">{valor.nombre}</p>
                  <p className="truncate text-xs text-gray-400">
                    {valor.tipo} · {valor.archivoNombre} · {TAMANO_LEGIBLE(Number(valor.archivoTamano))} ·{" "}
                    {fechaCorta(valor.creadoEn)}
                    {valor.actualizadoEn.slice(0, 10) !== valor.creadoEn.slice(0, 10)
                      ? ` · actualizado ${fechaCorta(valor.actualizadoEn)}`
                      : ""}
                    {valor.totalTablas > 0 ? ` · ${valor.totalTablas} tabla(s) analizada(s)` : ""}
                  </p>
                  {valor.descripcion && (
                    <p className="mt-0.5 truncate text-xs text-gray-400">{valor.descripcion}</p>
                  )}
                </div>
                {esAdmin && sePuedeAnalizar(valor.archivoNombre) && (
                  <button
                    type="button"
                    onClick={() => setValorAnalisis(valor)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#C2410C]/10 px-3 py-1.5 text-xs font-bold text-[#C2410C] transition-colors hover:bg-[#C2410C]/20"
                  >
                    <Table2 className="h-3.5 w-3.5" />
                    Analizar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setValorPreview(valor)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Vista previa
                </button>
                <a
                  href={api.valorArchivoUrl(valor.id, true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Descargar
                </a>
                {esAdmin && (
                  <button
                    type="button"
                    onClick={() => setValorEditar(valor)}
                    aria-label={`Editar ${valor.nombre}`}
                    title="Editar referencia o subir nueva versión"
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {esAdmin && (
                  <button
                    type="button"
                    onClick={() => void eliminarValor(valor)}
                    aria-label={`Eliminar ${valor.nombre}`}
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C2410C]/10">
              <ClipboardList className="h-4 w-4 text-[#C2410C]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">Formatos para diligenciar</h2>
              <p className="text-xs text-gray-400">
                {formatos.length === 0 ? "Sin formatos creados" : `${formatos.length} formato(s)`}
              </p>
            </div>
          </div>
          {esAdmin && (
            <button
              type="button"
              onClick={() => setModalFormato(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#C2410C] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#9A3412]"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo formato
            </button>
          )}
        </div>

        {formatos.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-gray-400">
            Crea el primer formato definiendo sus campos; luego se podrá diligenciar desde aquí.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {formatos.map((formato) => (
              <li key={formato.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-800">{formato.nombre}</p>
                    {formato.esReferencia && (
                      <span className="flex-shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A3412]">
                        Referencia
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-gray-400">
                    {formato.campos.length} campo(s)
                    {formato.valorNombre ? ` · basado en “${formato.valorNombre}”` : ""} ·{" "}
                    {formato.totalRegistros} registro(s)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormatoActivo(formato)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#C2410C]/10 px-3 py-1.5 text-xs font-bold text-[#C2410C] transition-colors hover:bg-[#C2410C]/20"
                >
                  <Send className="h-3.5 w-3.5" />
                  Diligenciar
                </button>
                {esAdmin && (
                  <button
                    type="button"
                    onClick={() => setFormatoEditar(formato)}
                    aria-label={`Editar ${formato.nombre}`}
                    title="Editar formato"
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {esAdmin && (
                  <button
                    type="button"
                    onClick={() => void eliminarFormato(formato)}
                    aria-label={`Eliminar ${formato.nombre}`}
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {modalValor && (
        <ModalValor
          valores={valores}
          onCerrar={() => setModalValor(false)}
          onListo={(mensaje) => {
            setModalValor(false);
            mostrarAviso(mensaje);
            void cargar();
          }}
        />
      )}

      {valorEditar && (
        <ModalValor
          valores={valores}
          valor={valorEditar}
          onCerrar={() => setValorEditar(null)}
          onListo={(mensaje) => {
            setValorEditar(null);
            mostrarAviso(mensaje);
            void cargar();
          }}
        />
      )}

      {modalFormato && (
        <ModalFormato
          valores={valores}
          onCerrar={() => setModalFormato(false)}
          onListo={(mensaje) => {
            setModalFormato(false);
            mostrarAviso(mensaje);
            void cargar();
          }}
        />
      )}

      {valorPreview && (
        <ValorPreviewModal valor={valorPreview} onCerrar={() => setValorPreview(null)} />
      )}

      {valorAnalisis && (
        <AnalizarValorModal
          valor={valorAnalisis}
          onCerrar={() => {
            setValorAnalisis(null);
            void cargar();
          }}
          onCambio={() => void cargar()}
        />
      )}

      {formatoEditar && (
        <ModalFormato
          valores={valores}
          formato={formatoEditar}
          onCerrar={() => setFormatoEditar(null)}
          onListo={(mensaje) => {
            setFormatoEditar(null);
            mostrarAviso(mensaje);
            void cargar();
          }}
        />
      )}

      {formatoActivo && (
        <ModalDiligenciar
          formato={formatoActivo}
          onCerrar={() => setFormatoActivo(null)}
          onListo={(mensaje) => {
            setFormatoActivo(null);
            mostrarAviso(mensaje);
            void cargar();
          }}
        />
      )}
    </div>
  );
}

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-sm font-bold text-gray-900">{titulo}</h3>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-[#C2410C] focus:ring-2 focus:ring-[#C2410C]/20";

function ModalValor({
  valores,
  valor,
  onCerrar,
  onListo,
}: {
  valores: ValorReferenciaApi[];
  valor?: ValorReferenciaApi;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}) {
  const editar = Boolean(valor);
  const [nombre, setNombre] = useState(valor?.nombre ?? "");
  const [tipo, setTipo] = useState(valor?.tipo ?? TIPOS_VALOR[0]);
  const [descripcion, setDescripcion] = useState(valor?.descripcion ?? "");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opcionesTipo = TIPOS_VALOR.includes(tipo) ? TIPOS_VALOR : [tipo, ...TIPOS_VALOR];

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!editar && !archivo) {
      setError("Selecciona un archivo");
      return;
    }
    setCargando(true);
    setError(null);
    try {
      if (valor) {
        await api.actualizarValor(valor.id, {
          nombre: nombre.trim() || undefined,
          tipo,
          descripcion: descripcion.trim() || null,
        });
        if (archivo) await api.reemplazarValorArchivo(valor.id, archivo);
        onListo(
          `Valor “${nombre.trim() || valor.nombre}” actualizado${
            archivo ? " con una nueva versión del archivo" : ""
          }.`,
        );
      } else {
        await api.subirValor(archivo!, {
          tipo,
          nombre: nombre.trim() || undefined,
          descripcion: descripcion.trim() || undefined,
        });
        onListo(`Valor “${nombre.trim() || archivo!.name}” subido correctamente.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el valor");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal
      titulo={editar ? "Editar valor de referencia" : "Subir valor de referencia"}
      onCerrar={onCerrar}
    >
      <form onSubmit={enviar} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-600">Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={INPUT}>
            {opcionesTipo.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-600">Nombre (opcional)</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Presupuesto La Palizada"
            className={INPUT}
            maxLength={200}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-600">Descripción (opcional)</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            className={INPUT}
            maxLength={500}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-600">
            {editar ? "Nueva versión del archivo (opcional)" : "Archivo"}
          </label>
          <input
            type="file"
            accept=".xls,.xlsx,.pdf,.doc,.docx,.csv,.txt,.png,.jpg,.jpeg"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#C2410C]/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#C2410C]"
          />
          {editar && !archivo && (
            <p className="mt-1 text-[11px] text-gray-400">
              Archivo actual: {valor!.archivoNombre}. Si adjuntas otro, lo reemplaza y conserva las
              tablas ya analizadas.
            </p>
          )}
          {archivo && (
            <p className="mt-1 text-xs text-gray-400">
              {archivo.name} · {TAMANO_LEGIBLE(archivo.size)}
            </p>
          )}
        </div>
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={cargando}
            className="rounded-lg bg-[#C2410C] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#9A3412] disabled:opacity-50"
          >
            {cargando ? "Guardando…" : editar ? "Guardar cambios" : "Subir"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ModalFormato({
  valores,
  formato,
  onCerrar,
  onListo,
}: {
  valores: ValorReferenciaApi[];
  formato?: FormatoApi;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}) {
  const editar = Boolean(formato);
  const [nombre, setNombre] = useState(formato?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(formato?.descripcion ?? "");
  const [valorId, setValorId] = useState(formato?.valorId ?? "");
  const [tablas, setTablas] = useState<ValorTablaApi[]>([]);
  const [tablaId, setTablaId] = useState("");
  const [campos, setCampos] = useState<string[]>(
    formato?.campos.length ? formato.campos : [""],
  );
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTablaId("");
    if (!valorId) {
      setTablas([]);
      return;
    }
    let cancelado = false;
    api
      .valorTablas(valorId)
      .then(({ tablas: lista }) => {
        if (!cancelado) setTablas(lista);
      })
      .catch(() => {
        if (!cancelado) setTablas([]);
      });
    return () => {
      cancelado = true;
    };
  }, [valorId]);

  const usarColumnas = (id: string) => {
    const tabla = tablas.find((item) => item.id === id);
    if (!tabla) return;
    if (
      campos.some((campo) => campo.trim()) &&
      !window.confirm("Se reemplazarán los campos actuales por las columnas de la tabla. ¿Continuar?")
    ) {
      return;
    }
    setTablaId(id);
    setCampos(tabla.columnas.map((columna) => columna.etiqueta).slice(0, 60));
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const limpios = campos.map((c) => c.trim()).filter(Boolean);
    if (limpios.length === 0) {
      setError("Define al menos un campo");
      return;
    }
    setCargando(true);
    setError(null);
    try {
      if (formato) {
        await api.actualizarFormato(formato.id, {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          campos: limpios,
          valorId: valorId || null,
        });
        onListo(`Formato “${nombre.trim()}” actualizado correctamente.`);
      } else {
        await api.crearFormato({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
          campos: limpios,
          valorId: valorId || null,
        });
        onListo(`Formato “${nombre.trim()}” creado correctamente.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el formato");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal titulo={editar ? "Editar formato" : "Nuevo formato"} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-600">Nombre</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Formato de control de calidad"
            className={INPUT}
            maxLength={200}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-600">Descripción (opcional)</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            className={INPUT}
            maxLength={500}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-600">
            Valor de referencia (opcional)
          </label>
          <select value={valorId} onChange={(e) => setValorId(e.target.value)} className={INPUT}>
            <option value="">Sin valor asociado</option>
            {valores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre} ({v.tipo})
              </option>
            ))}
          </select>
        </div>
        {tablas.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-600">
              Columnas desde tabla analizada (opcional)
            </label>
            <select value={tablaId} onChange={(e) => usarColumnas(e.target.value)} className={INPUT}>
              <option value="">Definir campos manualmente</option>
              {tablas.map((tabla) => (
                <option key={tabla.id} value={tabla.id}>
                  {tabla.hoja} · {tabla.columnas.length} columna(s)
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-400">
              Copia las etiquetas de la hoja como campos del formato.
            </p>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-600">Campos a diligenciar</label>
          <div className="space-y-2">
            {campos.map((campo, indice) => (
              <div key={indice} className="flex items-center gap-2">
                <input
                  value={campo}
                  onChange={(e) =>
                    setCampos((prev) => prev.map((c, i) => (i === indice ? e.target.value : c)))
                  }
                  placeholder={`Campo ${indice + 1}`}
                  className={INPUT}
                  maxLength={120}
                />
                <button
                  type="button"
                  onClick={() => setCampos((prev) => prev.filter((_, i) => i !== indice))}
                  aria-label="Quitar campo"
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setCampos((prev) => [...prev, ""])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-bold text-gray-500 transition-colors hover:border-[#C2410C] hover:text-[#C2410C]"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar campo
            </button>
          </div>
        </div>
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={cargando}
            className="rounded-lg bg-[#C2410C] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#9A3412] disabled:opacity-50"
          >
            {cargando ? "Guardando…" : editar ? "Guardar cambios" : "Crear formato"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ModalDiligenciar({
  formato,
  onCerrar,
  onListo,
}: {
  formato: FormatoApi;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(formato.campos.map((c) => [c, ""])),
  );
  const [registros, setRegistros] = useState<RegistroFormatoApi[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tablas, setTablas] = useState<ValorTablaApi[]>([]);
  const [prellenar, setPrellenar] = useState(false);
  const [tablaId, setTablaId] = useState("");
  const [filas, setFilas] = useState<string[][] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [avisoTabla, setAvisoTabla] = useState<string | null>(null);

  useEffect(() => {
    api
      .registrosFormato(formato.id)
      .then((r) => setRegistros(r.registros))
      .catch(() => setRegistros([]));
  }, [formato.id]);

  useEffect(() => {
    if (!formato.valorId) {
      setTablas([]);
      return;
    }
    let cancelado = false;
    api
      .valorTablas(formato.valorId)
      .then(({ tablas: lista }) => {
        if (cancelado) return;
        setTablas(lista);
        setTablaId(lista[0]?.id ?? "");
      })
      .catch(() => {
        if (!cancelado) setTablas([]);
      });
    return () => {
      cancelado = true;
    };
  }, [formato.valorId]);

  async function cargarFilas(id: string) {
    if (!formato.valorId) return;
    setTablaId(id);
    setFilas(null);
    setBusqueda("");
    try {
      const { tabla } = await api.valorTablaFilas(formato.valorId, id);
      setFilas(tabla.filas);
    } catch {
      setFilas([]);
    }
  }

  const alternarPrellenar = () => {
    const abriendo = !prellenar;
    setPrellenar(abriendo);
    if (abriendo && tablaId && filas === null) void cargarFilas(tablaId);
  };

  const filasFiltradas = useMemo(() => {
    if (!filas) return [];
    const consulta = normalizarEtiqueta(busqueda);
    const lista = consulta
      ? filas.filter((fila) => fila.some((valor) => normalizarEtiqueta(valor).includes(consulta)))
      : filas;
    return lista.slice(0, 40);
  }, [filas, busqueda]);

  const aplicarFila = (fila: string[]) => {
    const tabla = tablas.find((item) => item.id === tablaId);
    if (!tabla) return;
    const siguientes = { ...valores };
    let aplicados = 0;
    for (const campo of formato.campos) {
      const indice = tabla.columnas.findIndex(
        (columna) => normalizarEtiqueta(columna.etiqueta) === normalizarEtiqueta(campo),
      );
      if (indice >= 0 && fila[indice] !== undefined) {
        siguientes[campo] = fila[indice];
        aplicados++;
      }
    }
    setValores(siguientes);
    setAvisoTabla(`Se prellenaron ${aplicados} de ${formato.campos.length} campo(s).`);
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const vacios = formato.campos.filter((c) => !valores[c]?.trim());
    if (vacios.length) {
      setError(`Campos vacíos: ${vacios.join(", ")}`);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      await api.crearRegistroFormato(formato.id, valores);
      onListo(`Registro de “${formato.nombre}” guardado correctamente.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el registro");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal titulo={formato.nombre} onCerrar={onCerrar}>
      {formato.descripcion && <p className="mb-4 text-xs text-gray-500">{formato.descripcion}</p>}
      {formato.valorNombre && (
        <p className="mb-4 rounded-lg bg-orange-50 px-3 py-2 text-xs font-semibold text-[#9A3412]">
          Se diligencia con base en: {formato.valorNombre}
        </p>
      )}

      {formato.valorId && tablas.length > 0 && (
        <div className="mb-4 rounded-xl border border-[#C2410C]/20 bg-orange-50/70 px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-[#9A3412]">Prellenar desde tabla analizada</p>
            <button
              type="button"
              onClick={alternarPrellenar}
              className="text-xs font-bold text-[#C2410C] underline"
            >
              {prellenar ? "Ocultar" : "Abrir"}
            </button>
          </div>
          {prellenar && (
            <div className="mt-2 space-y-2">
              {tablas.length > 1 && (
                <select
                  value={tablaId}
                  onChange={(e) => void cargarFilas(e.target.value)}
                  className={INPUT}
                >
                  {tablas.map((tabla) => (
                    <option key={tabla.id} value={tabla.id}>
                      {tabla.hoja} · {tabla.totalFilas} fila(s)
                    </option>
                  ))}
                </select>
              )}
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar en la tabla…"
                className={INPUT}
              />
              {filas === null ? (
                <p className="text-xs text-gray-500">Cargando filas…</p>
              ) : filasFiltradas.length === 0 ? (
                <p className="text-xs text-gray-500">Sin filas que coincidan.</p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-y-auto">
                  {filasFiltradas.map((fila, indice) => (
                    <li key={indice}>
                      <button
                        type="button"
                        onClick={() => aplicarFila(fila)}
                        className="w-full rounded-lg bg-white px-2 py-1.5 text-left text-[11px] text-gray-600 transition-colors hover:bg-[#C2410C]/10"
                      >
                        {fila.filter(Boolean).slice(0, 3).join(" · ") || "(fila vacía)"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {avisoTabla && (
                <p className="text-[11px] font-semibold text-[#9A3412]">{avisoTabla}</p>
              )}
            </div>
          )}
        </div>
      )}

      <form onSubmit={enviar} className="space-y-4">
        {formato.campos.map((campo) => (
          <div key={campo}>
            <label className="mb-1 block text-xs font-bold text-gray-600">{campo}</label>
            <textarea
              value={valores[campo] ?? ""}
              onChange={(e) => setValores((prev) => ({ ...prev, [campo]: e.target.value }))}
              rows={2}
              className={INPUT}
              maxLength={2000}
            />
          </div>
        ))}
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={cargando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#C2410C] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#9A3412] disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {cargando ? "Guardando…" : "Guardar registro"}
          </button>
        </div>
      </form>

      <div className="mt-6 border-t border-gray-100 pt-4">
        <h4 className="mb-2 text-xs font-bold text-gray-600">
          Registros anteriores ({registros?.length ?? 0})
        </h4>
        {registros === null ? (
          <p className="text-xs text-gray-400">Cargando…</p>
        ) : registros.length === 0 ? (
          <p className="text-xs text-gray-400">Todavía no hay registros de este formato.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {registros.map((registro) => (
              <li key={registro.id} className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-gray-500">
                  {registro.diligenciadoPor} · {fechaCorta(registro.creadoEn)}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                  {formato.campos
                    .slice(0, 3)
                    .map((c) => `${c}: ${registro.valores[c] ?? "—"}`)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
