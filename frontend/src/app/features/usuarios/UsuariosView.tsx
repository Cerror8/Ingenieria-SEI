import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { api, fechaCorta } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { CargandoModule, ErrorModule } from "../../components/DataState";
import type { Rol, UsuarioAdmin } from "../../types";

const ROLES: { id: Rol; label: string; badge: string }[] = [
  { id: "admin", label: "Administrador", badge: "bg-orange-100 text-[#9A3412] border-orange-200" },
  { id: "usuario", label: "Usuario", badge: "bg-slate-100 text-slate-600 border-slate-200" },
];

const campoCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10";

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

function fechaHora(iso: string | null) {
  if (!iso) return "Sin registro";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

function Avatar({
  nombre,
  fotoUrl,
  tamano = "md",
}: {
  nombre: string;
  fotoUrl: string | null;
  tamano?: "sm" | "md";
}) {
  const [rota, setRota] = useState(false);

  useEffect(() => setRota(false), [fotoUrl]);

  const clases = tamano === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1F2937] font-bold text-white ${clases}`}
    >
      {fotoUrl && !rota ? (
        <img
          src={fotoUrl}
          alt={nombre}
          referrerPolicy="no-referrer"
          onError={() => setRota(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        iniciales(nombre)
      )}
    </div>
  );
}

export function UsuariosView({ onShowToast }: { onShowToast: (msg: string) => void }) {
  const { usuario: actual } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rolesSolicitud, setRolesSolicitud] = useState<Record<string, Rol>>({});
  const [nuevo, setNuevo] = useState({
    nombre: "",
    email: "",
    rol: "usuario" as Rol,
    password: "",
  });

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { usuarios: lista } = await api.usuarios();
      setUsuarios(lista);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los usuarios.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const pendientes = useMemo(
    () => usuarios.filter((u) => u.pendienteAprobacion),
    [usuarios],
  );
  const cuentas = useMemo(
    () => usuarios.filter((u) => !u.pendienteAprobacion),
    [usuarios],
  );

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return cuentas;
    return cuentas.filter((u) =>
      [u.nombre, u.email, ROLES.find((r) => r.id === u.rol)?.label ?? u.rol]
        .join(" ")
        .toLowerCase()
        .includes(texto),
    );
  }, [cuentas, busqueda]);

  const resumen = useMemo(
    () => ({
      total: cuentas.length,
      activos: cuentas.filter((u) => u.activo).length,
      admins: cuentas.filter((u) => u.rol === "admin" && u.activo).length,
      pendientes: pendientes.length,
    }),
    [cuentas, pendientes],
  );

  async function actualizar(id: string, datos: { rol?: Rol; activo?: boolean }, mensaje: string) {
    setOcupado(id);
    setAviso(null);
    try {
      const { usuario } = await api.actualizarUsuario(id, datos);
      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                rol: usuario.rol,
                activo: usuario.activo,
                nombre: usuario.nombre,
                pendienteAprobacion: usuario.pendienteAprobacion,
              }
            : u,
        ),
      );
      onShowToast(mensaje);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo actualizar el usuario.");
    } finally {
      setOcupado(null);
    }
  }

  async function aprobarSolicitud(id: string) {
    setOcupado(id);
    setAviso(null);
    try {
      const rol = rolesSolicitud[id] ?? "usuario";
      const { usuario } = await api.aprobarUsuario(id, rol);
      setUsuarios((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...usuario, pendienteAprobacion: false } : u)),
      );
      setRolesSolicitud((prev) => {
        const siguiente = { ...prev };
        delete siguiente[id];
        return siguiente;
      });
      onShowToast(`Acceso aprobado para ${usuario.nombre}.`);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo aprobar la solicitud.");
    } finally {
      setOcupado(null);
    }
  }

  async function rechazarSolicitud(id: string) {
    const solicitud = pendientes.find((u) => u.id === id);
    if (!solicitud) return;
    if (
      !window.confirm(
        `¿Rechazar la solicitud de ${solicitud.nombre} (${solicitud.email})? Se eliminará la cuenta pendiente.`,
      )
    ) {
      return;
    }

    setOcupado(id);
    setAviso(null);
    try {
      await api.rechazarSolicitud(id);
      setUsuarios((prev) => prev.filter((u) => u.id !== id));
      setRolesSolicitud((prev) => {
        const siguiente = { ...prev };
        delete siguiente[id];
        return siguiente;
      });
      onShowToast(`Solicitud de ${solicitud.nombre} rechazada.`);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo rechazar la solicitud.");
    } finally {
      setOcupado(null);
    }
  }

  async function crearUsuario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nuevo.nombre.trim() || !nuevo.email.trim() || nuevo.password.length < 8) return;

    setGuardando(true);
    setFormError(null);
    try {
      const { usuario } = await api.crearUsuario({
        nombre: nuevo.nombre.trim(),
        email: nuevo.email.trim(),
        rol: nuevo.rol,
        password: nuevo.password,
      });
      setUsuarios((prev) => [...prev, usuario]);
      setNuevo({ nombre: "", email: "", rol: "usuario", password: "" });
      setMostrarFormulario(false);
      onShowToast(`Usuario ${usuario.nombre} creado correctamente.`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo crear el usuario.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <CargandoModule mensaje="Cargando usuarios…" />;
  if (error) return <ErrorModule mensaje={error} onRetry={() => void cargar()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Usuarios y permisos</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Gestiona las cuentas, su rol y el acceso a Ingeniería SEI.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setMostrarFormulario(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9A3412]"
        >
          <Plus className="h-4 w-4" />
          Nuevo usuario
        </button>
      </div>

      {aviso && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-800">{aviso}</p>
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            <X className="h-4 w-4 text-amber-600" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Cuentas registradas", valor: resumen.total, icon: Users },
          { label: "Cuentas activas", valor: resumen.activos, icon: CheckCircle2 },
          { label: "Administradores activos", valor: resumen.admins, icon: ShieldCheck },
          { label: "Solicitudes pendientes", valor: resumen.pendientes, icon: Mail },
        ].map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm ${
              item.label === "Solicitudes pendientes" && item.valor > 0
                ? "border-orange-200 bg-orange-50/70"
                : "border-gray-100 bg-white"
            }`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-[#C2410C]">
              <item.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none text-gray-800">{item.valor}</p>
              <p className="mt-1 text-[11px] font-medium text-gray-500">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {pendientes.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-orange-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-orange-100 bg-orange-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#9A3412]">
                Solicitudes pendientes ({pendientes.length})
              </h2>
              <p className="text-[11px] text-orange-800/70">
                Cuentas creadas con correo o Google que esperan aprobación para ingresar.
              </p>
            </div>
          </div>

          <ul className="divide-y divide-orange-50">
            {pendientes.map((u) => {
              const ocupada = ocupado === u.id;
              return (
                <li
                  key={u.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar nombre={u.nombre} fotoUrl={u.fotoUrl} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-800">{u.nombre}</p>
                      <p className="flex items-center gap-1 truncate text-[11px] text-gray-500">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        {u.email}
                        <span className="text-gray-300">·</span>
                        {u.proveedor === "google" ? "Google" : "Cuenta local"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-400">
                        Solicitada el {fechaHora(u.creadoEn)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <select
                      value={rolesSolicitud[u.id] ?? "usuario"}
                      disabled={ocupada}
                      onChange={(e) =>
                        setRolesSolicitud((prev) => ({ ...prev, [u.id]: e.target.value as Rol }))
                      }
                      aria-label={`Rol para ${u.nombre}`}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 outline-none focus:border-[#EA580C] disabled:opacity-60"
                    >
                      {ROLES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={ocupada}
                      onClick={() => void aprobarSolicitud(u.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#C2410C] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aprobar
                    </button>
                    <button
                      type="button"
                      disabled={ocupada}
                      onClick={() => void rechazarSolicitud(u.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" />
                      Rechazar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, correo o rol…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10"
            />
          </div>
          <span className="text-xs font-medium text-gray-400">
            {filtrados.length} de {cuentas.length} cuentas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["Usuario", "Rol", "Estado", "Tareas", "Último acceso", "Alta"].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map((u) => {
                const esYo = u.id === actual?.id;
                const rolCfg = ROLES.find((r) => r.id === u.rol) ?? ROLES[3];
                const bloqueado = ocupado === u.id || esYo;

                return (
                  <tr key={u.id} className={u.activo ? "hover:bg-gray-50/50" : "bg-slate-50/60"}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar nombre={u.nombre} fotoUrl={u.fotoUrl} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <span className="truncate">{u.nombre}</span>
                            {esYo && (
                              <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#9A3412]">
                                Tú
                              </span>
                            )}
                          </p>
                          <p className="flex items-center gap-1 truncate text-[11px] text-gray-500">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            {u.email}
                          </p>
                          <p className="mt-0.5 text-[10px] font-medium text-gray-400">
                            {u.proveedor === "google" ? "Google" : "Cuenta local"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {esYo ? (
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${rolCfg.badge}`}
                        >
                          {rolCfg.label}
                        </span>
                      ) : (
                        <select
                          value={u.rol}
                          disabled={bloqueado}
                          onChange={(e) =>
                            void actualizar(
                              u.id,
                              { rol: e.target.value as Rol },
                              `Rol de ${u.nombre} actualizado.`,
                            )
                          }
                          aria-label={`Rol de ${u.nombre}`}
                          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 outline-none focus:border-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {ROLES.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={bloqueado}
                        onClick={() =>
                          void actualizar(
                            u.id,
                            { activo: !u.activo },
                            `${u.nombre} ${u.activo ? "desactivado" : "activado"} correctamente.`,
                          )
                        }
                        title={esYo ? "No puedes desactivar tu propia cuenta" : undefined}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          u.activo
                            ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${u.activo ? "bg-green-500" : "bg-slate-400"}`}
                        />
                        {u.activo ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="min-w-[110px]">
                        <p className="text-[11px] font-semibold text-gray-600">
                          {u.tareasCompletadas} de {u.tareasAsignadas} completadas
                        </p>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#C2410C]"
                            style={{
                              width: `${
                                u.tareasAsignadas
                                  ? Math.round((u.tareasCompletadas / u.tareasAsignadas) * 100)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {fechaHora(u.ultimoAcceso)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {fechaCorta(u.creadoEn)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtrados.length === 0 && (
          <p className="px-4 py-10 text-center text-xs text-gray-400">
            No hay cuentas que coincidan con la búsqueda.
          </p>
        )}
      </div>

      <p className="flex items-start gap-2 text-[11px] text-slate-400">
        <UserRound className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        Al desactivar una cuenta, la persona pierde el acceso de inmediato. Aprobar una solicitud
        habilita el ingreso con el rol elegido. Debe quedar al menos un administrador activo.
      </p>

      {mostrarFormulario && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
          <div className="my-auto w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-800">Nuevo usuario local</h2>
              <button
                type="button"
                onClick={() => setMostrarFormulario(false)}
                aria-label="Cerrar"
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void crearUsuario(e)} className="space-y-4 px-5 py-5">
              <div className="space-y-1.5">
                <label htmlFor="usuario-nombre" className="text-xs font-semibold text-slate-700">
                  Nombre completo
                </label>
                <input
                  id="usuario-nombre"
                  required
                  minLength={2}
                  maxLength={120}
                  value={nuevo.nombre}
                  onChange={(e) => setNuevo((prev) => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej. María Fernanda López"
                  className={campoCls}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="usuario-email" className="text-xs font-semibold text-slate-700">
                  Correo
                </label>
                <input
                  id="usuario-email"
                  type="email"
                  required
                  maxLength={160}
                  value={nuevo.email}
                  onChange={(e) => setNuevo((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="persona@unicesmag.edu.co"
                  className={campoCls}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="usuario-rol" className="text-xs font-semibold text-slate-700">
                    Rol
                  </label>
                  <select
                    id="usuario-rol"
                    value={nuevo.rol}
                    onChange={(e) => setNuevo((prev) => ({ ...prev, rol: e.target.value as Rol }))}
                    className={campoCls}
                  >
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="usuario-password" className="text-xs font-semibold text-slate-700">
                    Contraseña
                  </label>
                  <input
                    id="usuario-password"
                    type="password"
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    value={nuevo.password}
                    onChange={(e) => setNuevo((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Mínimo 8 caracteres"
                    className={campoCls}
                  />
                </div>
              </div>

              <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                La cuenta se crea con acceso por correo y contraseña. El rol administrador permite
                gestionar usuarios y ver todas las secciones.
              </p>

              {formError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {formError}
                </p>
              )}

              <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {guardando ? "Creando…" : "Crear usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
