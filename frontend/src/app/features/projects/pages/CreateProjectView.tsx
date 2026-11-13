import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { api, fechaCorta, type EstructuraApi, type ProyectoApi } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { CargandoModule, ErrorModule } from "../../../components/DataState";
import { Crumb } from "../../../components/shared";
import { STATUS_CFG } from "../../../constants";
import type { ProjectStatus, UsuarioAsignable } from "../../../types";

type Props = {
  onBack: () => void;
  onSave: (id: string) => void;
  proyectoId?: string;
};

const FORM_INICIAL = {
  id: "", prefijo: "OBR", consecutivo: "", nombre: "", nombreCorto: "", numeroContrato: "",
  organizadores: "", entidadContratante: "", entidadContratista: "", fechaAsignacion: "",
  fechaInicio: "", fechaFin: "", linea: "", tipoContrato: "Interventoría", dependencia: "",
  responsable: "", liderId: "", estructura: "", objetivo: "", presupuesto: "0", estado: "En ejecución",
  avance: "0", ejecucionPct: "0",
};
type Campo = keyof typeof FORM_INICIAL;
const PREFIJOS = ["OBR", "INT", "CON"];
const LINEAS_PROYECTO = ["Obra", "Interventoría", "Consultoría"];
const inputCls = "w-full min-w-0 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-60 read-only:bg-gray-100";
const labelCls = "mb-1.5 block text-xs font-semibold text-gray-700";

// El cambio entre alta y edición reinicia el formulario sin reutilizar datos de otro proyecto.
export function CreateProjectView(props: Props) {
  return <ProjectForm key={props.proyectoId ? `editar:${props.proyectoId}` : "alta"} {...props} />;
}

function ProjectForm({ onBack, onSave, proyectoId }: Props) {
  const { usuario } = useAuth();
  const editando = Boolean(proyectoId);
  const [form, setForm] = useState(FORM_INICIAL);
  const [original, setOriginal] = useState<ProyectoApi | null>(null);
  const [cargando, setCargando] = useState(editando);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [intentoCarga, setIntentoCarga] = useState(0);
  const [lideres, setLideres] = useState<UsuarioAsignable[]>([]);
  const [estructuras, setEstructuras] = useState<EstructuraApi[]>([]);
  const [errorCatalogos, setErrorCatalogos] = useState<string | null>(null);
  const [intentoCatalogos, setIntentoCatalogos] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Campo, string>>>({});
  const formularioRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let activo = true;
    setErrorCatalogos(null);
    Promise.allSettled([api.usuariosAsignables(), api.estructuras()]).then(([usuarios, plantillas]) => {
      if (!activo) return;
      if (usuarios.status === "fulfilled") setLideres(usuarios.value.usuarios);
      if (plantillas.status === "fulfilled") setEstructuras(plantillas.value.estructuras);
      if (usuarios.status === "rejected" || plantillas.status === "rejected") {
        setErrorCatalogos("No se pudieron cargar todos los líderes o estructuras. Los valores actuales se conservan.");
      }
    });
    return () => { activo = false; };
  }, [intentoCatalogos]);

  useEffect(() => {
    if (!proyectoId) return;
    let activo = true;
    setCargando(true);
    setErrorCarga(null);
    api.proyecto(proyectoId).then(({ proyecto: p }) => {
      if (!activo) return;
      setOriginal(p);
      setForm({
        ...FORM_INICIAL,
        id: p.id, nombre: p.nombre, nombreCorto: p.nombreCorto ?? "", numeroContrato: p.numeroContrato ?? "",
        organizadores: p.organizadores ?? "", entidadContratante: p.entidadContratante ?? "",
        entidadContratista: p.entidadContratista ?? "", fechaAsignacion: p.fechaAsignacion?.slice(0, 10) ?? "",
        fechaInicio: p.fechaInicio?.slice(0, 10) ?? "", fechaFin: p.fechaFin?.slice(0, 10) ?? "",
        linea: p.linea ?? "", dependencia: p.dependencia ?? "", responsable: p.responsable ?? "",
        tipoContrato: p.tipoContrato ?? "Interventoría",
        liderId: p.liderId ?? "", estructura: p.estructura ?? "", objetivo: p.objetivo ?? "",
        presupuesto: String(p.presupuesto ?? 0), estado: p.estado,
        avance: String(p.avance ?? 0), ejecucionPct: String(p.ejecucionPct ?? 0),
      });
    }).catch((e: unknown) => {
      if (activo) setErrorCarga(e instanceof Error ? e.message : "No se pudo cargar el proyecto.");
    }).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [proyectoId, intentoCarga]);

  const upd = (campo: Campo, valor: string) => {
    setForm(f => ({ ...f, [campo]: valor }));
    setErrors(e => ({ ...e, [campo]: undefined, ...(campo === "fechaInicio" ? { fechaFin: undefined } : {}) }));
    setErrorGuardado(null);
  };

  // Los proyectos antiguos pueden conservar campos contractuales aún no registrados.
  const contractualObligatorio = (campo: "nombreCorto" | "numeroContrato" | "entidadContratante" | "entidadContratista" | "fechaAsignacion" | "fechaInicio" | "fechaFin") =>
    !editando || Boolean(original?.[campo]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (guardandoRef.current || cargando || (editando && !original)) return;
    if (!usuario) {
      setErrorGuardado("Debe iniciar sesión para guardar el proyecto.");
      return;
    }
    const e: Partial<Record<Campo, string>> = {};
    const requeridos: [Campo, string][] = [
      ["nombre", "Ingrese el nombre del proyecto."], ["linea", "Ingrese la línea / área del proyecto."],
      ["estado", "Seleccione el estado del proyecto."],
    ];
    const contractuales = ["nombreCorto", "numeroContrato", "entidadContratante", "entidadContratista", "fechaAsignacion", "fechaInicio", "fechaFin"] as const;
    contractuales.forEach(campo => {
      if (contractualObligatorio(campo)) requeridos.push([campo, "Este campo es obligatorio."]);
    });
    requeridos.forEach(([campo, mensaje]) => { if (!form[campo].trim()) e[campo] = mensaje; });
    if (!editando) {
      if (!PREFIJOS.includes(form.prefijo)) e.prefijo = "Seleccione OBR, INT o CON.";
      if (!/^\d+$/.test(form.consecutivo.trim())) e.consecutivo = "Ingrese el consecutivo asignado usando sólo números.";
    }
    for (const campo of ["fechaAsignacion", "fechaInicio", "fechaFin"] as const) {
      const valor = form[campo];
      if (!valor) continue;
      const fecha = new Date(`${valor}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || !Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
        e[campo] = "Ingrese una fecha válida.";
      }
    }
    if (form.fechaInicio && form.fechaFin && form.fechaFin < form.fechaInicio) {
      e.fechaFin = "La fecha de finalización debe ser igual o posterior a la fecha de inicio.";
    }
    for (const campo of ["presupuesto", "avance", "ejecucionPct"] as const) {
      const valor = Number(form[campo]);
      if (!form[campo].trim() || !Number.isFinite(valor) || valor < 0 || (campo !== "presupuesto" && valor > 100)) {
        e[campo] = campo === "presupuesto" ? "Ingrese un valor válido mayor o igual a cero." : "Ingrese un porcentaje entre 0 y 100.";
      }
    }
    setErrors(e);
    if (Object.keys(e).length) {
      setErrorGuardado("Revise los campos señalados antes de guardar.");
      const campo = formularioRef.current?.elements.namedItem(`proyecto-${Object.keys(e)[0]}`);
      if (campo instanceof HTMLElement) campo.focus();
      return;
    }

    guardandoRef.current = true;
    setGuardando(true);
    setErrorGuardado(null);
    try {
      const base = {
        nombre: form.nombre.trim(), nombreCorto: form.nombreCorto.trim(), numeroContrato: form.numeroContrato.trim(),
        organizadores: form.organizadores.trim(), entidadContratante: form.entidadContratante.trim(),
        entidadContratista: form.entidadContratista.trim(), linea: form.linea.trim(),
        tipoContrato: form.tipoContrato as "Obra" | "Interventoría",
        dependencia: form.dependencia.trim(), responsable: form.responsable.trim(),
        liderId: form.liderId || null, estructura: form.estructura || null, objetivo: form.objetivo.trim(),
        presupuesto: Number(form.presupuesto), estado: form.estado as ProjectStatus,
        avance: Number(form.avance), ejecucionPct: Number(form.ejecucionPct),
      };
      // Las fechas vacías se omiten para no invalidar proyectos antiguos al completarlos.
      const fechas = {
        ...(form.fechaAsignacion ? { fechaAsignacion: form.fechaAsignacion } : {}),
        ...(form.fechaInicio ? { fechaInicio: form.fechaInicio } : {}),
        ...(form.fechaFin ? { fechaFin: form.fechaFin } : {}),
      };
      const { proyecto } = proyectoId
        ? await api.actualizarProyecto(proyectoId, { ...base, ...fechas })
        : await api.crearProyecto({
            ...base,
            ...fechas,
            id: `${form.prefijo}-${form.consecutivo.trim()}`,
            fechaAsignacion: form.fechaAsignacion,
          });
      onSave(proyecto.id);
    } catch (e) {
      setErrorGuardado(e instanceof Error ? e.message : "No se pudo guardar el proyecto.");
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  };

  const atributos = (campo: Campo) => ({
    id: `proyecto-${campo}`, name: `proyecto-${campo}`, value: form[campo],
    "aria-invalid": Boolean(errors[campo]),
    "aria-describedby": errors[campo] ? `error-${campo}` : undefined,
    className: `${inputCls} ${errors[campo] ? "border-red-400" : ""}`,
  });
  const errorCampo = (campo: Campo) => errors[campo] && <p id={`error-${campo}`} className="mt-1 text-xs text-red-600">{errors[campo]}</p>;
  const campo = (key: Campo, label: string, opciones: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`proyecto-${key}`} className={labelCls}>{label}{opciones.required ? " *" : ""}</label>
      <input {...opciones} {...atributos(key)} onChange={e => upd(key, e.target.value)} />
      {errorCampo(key)}
    </div>
  );
  const titulo = editando ? "Editar proyecto" : "Nuevo proyecto";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} disabled={guardando} title="Volver a proyectos" aria-label="Volver a proyectos" className="rounded-lg p-2 text-gray-500 hover:bg-gray-200 disabled:opacity-60">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{titulo}</h1>
          <Crumb items={[{ label: "Proyectos", onClick: guardando ? undefined : onBack }, { label: titulo }]} />
        </div>
      </div>

      {cargando ? <CargandoModule mensaje="Cargando proyecto…" /> : errorCarga ? (
        <ErrorModule mensaje={errorCarga} onRetry={() => setIntentoCarga(i => i + 1)} />
      ) : (
        <form ref={formularioRef} onSubmit={handleSave} noValidate className="space-y-5" aria-busy={guardando}>
          <p className="text-sm text-gray-500">Los campos marcados con * son obligatorios. Los antecedentes se gestionan en la pestaña del detalle del proyecto.</p>
          {editando && <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">Puede completar los datos contractuales faltantes de proyectos antiguos sin cambiar su código. Los campos aún no registrados son opcionales en esta edición; los datos obligatorios existentes deben conservarse.</p>}
          {errorCatalogos && (
            <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {errorCatalogos} <button type="button" disabled={guardando} onClick={() => setIntentoCatalogos(i => i + 1)} className="font-semibold underline">Reintentar carga de catálogos</button>
            </div>
          )}
          <fieldset disabled={guardando} className="min-w-0 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
            <legend className="px-1 text-base font-bold text-gray-900">Datos contrato</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {editando ? (
                <div>
                  {campo("id", "Código del proyecto", { readOnly: true })}
                  <p className="mt-1 text-xs text-gray-500">Identificador inmutable; se conservan los códigos antiguos.</p>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2">
                    <div>
                      <label htmlFor="proyecto-prefijo" className={labelCls}>Prefijo *</label>
                      <select {...atributos("prefijo")} required onChange={e => upd("prefijo", e.target.value)}>
                        {PREFIJOS.map(prefijo => <option key={prefijo}>{prefijo}</option>)}
                      </select>
                      {errorCampo("prefijo")}
                    </div>
                    {campo("consecutivo", "Consecutivo *", { inputMode: "numeric", placeholder: "Consecutivo asignado" })}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Código: {form.prefijo}-{form.consecutivo.trim() || "…"}. Ingrese el consecutivo; no se genera automáticamente.</p>
                </div>
              )}
              {campo("numeroContrato", "Número de contrato", { required: contractualObligatorio("numeroContrato") })}
              {campo("nombre", "Nombre del proyecto", { required: true })}
              {campo("nombreCorto", "Nombre corto (abreviatura / identificador coloquial)", { required: contractualObligatorio("nombreCorto") })}
              {campo("entidadContratante", "Entidad contratante", { required: contractualObligatorio("entidadContratante") })}
              {campo("entidadContratista", "Entidad contratista", { required: contractualObligatorio("entidadContratista") })}
              <div className="sm:col-span-2">
                <label htmlFor="proyecto-objetivo" className={labelCls}>Objeto / objetivo del proyecto</label>
                <textarea {...atributos("objetivo")} rows={3} onChange={e => upd("objetivo", e.target.value)} />
              </div>
            </div>
          </fieldset>

          <fieldset disabled={guardando} className="min-w-0 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
            <legend className="px-1 text-base font-bold text-gray-900">Organización</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {campo("organizadores", "Organizadores (opcional)", { placeholder: "Texto libre" })}
              <div>
                <label htmlFor="proyecto-linea" className={labelCls}>Línea / área del proyecto *</label>
                <select {...atributos("linea")} onChange={e => upd("linea", e.target.value)}>
                  <option value="">Selecciona una línea</option>
                  {LINEAS_PROYECTO.map(linea => <option key={linea} value={linea}>{linea}</option>)}
                  {form.linea && !LINEAS_PROYECTO.includes(form.linea) && (
                    <option value={form.linea}>Línea actual ({form.linea})</option>
                  )}
                </select>
              </div>
              <div>
                <label htmlFor="proyecto-tipoContrato" className={labelCls}>Tipo de contrato</label>
                <select {...atributos("tipoContrato")} onChange={e => upd("tipoContrato", e.target.value)}>
                  <option value="Interventoría">Interventoría</option>
                  <option value="Obra">Obra</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Define el checklist EDT, los documentos obligatorios y los tableros de fase del proyecto.
                </p>
              </div>
              {campo("dependencia", "Área responsable")}
              {campo("responsable", "Responsable")}
              <div>
                <label htmlFor="proyecto-liderId" className={labelCls}>Líder del proyecto</label>
                <select {...atributos("liderId")} onChange={e => upd("liderId", e.target.value)}>
                  <option value="">Sin asignar</option>
                  {form.liderId && !lideres.some(u => u.id === form.liderId) && <option value={form.liderId}>Líder actual ({form.liderId})</option>}
                  {lideres.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="proyecto-estructura" className={labelCls}>Estructura documental</label>
                <select {...atributos("estructura")} onChange={e => upd("estructura", e.target.value)}>
                  <option value="">Sin plantilla de carpetas</option>
                  {form.estructura && !estructuras.some(e => e.id === form.estructura) && <option value={form.estructura}>Estructura actual ({form.estructura})</option>}
                  {estructuras.map(e => <option key={e.id} value={e.id}>{e.nombre} · {e.carpetas.length} carpetas</option>)}
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset disabled={guardando} className="min-w-0 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
            <legend className="px-1 text-base font-bold text-gray-900">Fechas / valor</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {campo("fechaAsignacion", "Fecha de asignación", { type: "date", required: contractualObligatorio("fechaAsignacion") })}
              {campo("fechaInicio", "Fecha de inicio", { type: "date", required: contractualObligatorio("fechaInicio") })}
              {campo("fechaFin", "Fecha de finalización", { type: "date", min: form.fechaInicio || undefined, required: contractualObligatorio("fechaFin") })}
              {campo("presupuesto", "Valor del contrato (COP)", { type: "number", min: 0, step: "any", required: true })}
              <div>
                <label htmlFor="proyecto-estado" className={labelCls}>Estado *</label>
                <select {...atributos("estado")} required onChange={e => upd("estado", e.target.value)}>
                  {!Object.keys(STATUS_CFG).includes(form.estado) && <option value={form.estado}>{form.estado}</option>}
                  {Object.keys(STATUS_CFG).map(estado => <option key={estado}>{estado}</option>)}
                </select>
                {errorCampo("estado")}
              </div>
              {campo("avance", "Avance técnico (%)", { type: "number", min: 0, max: 100, step: "any", required: true })}
              {campo("ejecucionPct", "Ejecución presupuestal (%)", { type: "number", min: 0, max: 100, step: "any", required: true })}
            </div>
            {editando && original && (
              <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs font-semibold text-gray-500">Creador (sólo lectura)</dt><dd className="mt-1 break-words text-gray-800">{original.creadoPor || "No registrado"}</dd></div>
                <div><dt className="text-xs font-semibold text-gray-500">Creado el (sólo lectura)</dt><dd className="mt-1 text-gray-800">{fechaCorta(original.creadoEn)}</dd></div>
              </dl>
            )}
          </fieldset>
          {errorGuardado && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorGuardado}</div>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onBack} disabled={guardando} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">Cancelar</button>
            <button type="submit" disabled={guardando || !usuario} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C2410C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#9A3412] disabled:opacity-60">
              <Save className="h-4 w-4" />{guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear proyecto"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
