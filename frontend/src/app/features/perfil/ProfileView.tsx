import { useEffect, useState, type FormEvent } from "react";
import {
  BadgeCheck,
  Check,
  Copy,
  Image as ImageIcon,
  KeyRound,
  Mail,
  Phone,
  QrCode,
  RefreshCw,
  Save,
  ShieldCheck,
  ShieldOff,
  UserRound,
} from "lucide-react";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { SectionHero } from "../../components/SectionHero";
import type { Rol } from "../../types";

const ROL_ETIQUETA: Record<Rol, string> = {
  admin: "Administrador",
  usuario: "Usuario",
};

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

function fechaLarga(iso: string | null) {
  if (!iso) return "Sin registro";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function ProfileView({ onShowToast }: { onShowToast: (msg: string) => void }) {
  const { usuario, actualizarPerfil, cambiarCorreo, cambiarPassword } = useAuth();
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [fotoUrl, setFotoUrl] = useState(usuario?.fotoUrl ?? "");
  const [telefono, setTelefono] = useState(usuario?.telefono ?? "");
  const [whatsappOptIn, setWhatsappOptIn] = useState(usuario?.whatsappOptIn ?? false);
  const [fotoRota, setFotoRota] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [correo, setCorreo] = useState(usuario?.email ?? "");
  const [claveCorreo, setClaveCorreo] = useState("");
  const [guardandoCorreo, setGuardandoCorreo] = useState(false);
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);

  const [claveActual, setClaveActual] = useState("");
  const [claveNueva, setClaveNueva] = useState("");
  const [claveRepite, setClaveRepite] = useState("");
  const [guardandoClave, setGuardandoClave] = useState(false);
  const [errorClave, setErrorClave] = useState<string | null>(null);

  const [estado2fa, setEstado2fa] = useState<{ habilitado: boolean; codigosRestantes: number } | null>(
    null,
  );
  const [config2fa, setConfig2fa] = useState<{
    secreto: string;
    urlOtpauth: string;
    qr: string;
  } | null>(null);
  const [codigo2fa, setCodigo2fa] = useState("");
  const [clave2fa, setClave2fa] = useState("");
  const [codigosNuevos, setCodigosNuevos] = useState<string[] | null>(null);
  const [error2fa, setError2fa] = useState<string | null>(null);
  const [ocupado2fa, setOcupado2fa] = useState(false);
  const [modo2fa, setModo2fa] = useState<"inactivo" | "desactivar" | "regenerar">("inactivo");
  const [copiado, setCopiado] = useState<"secreto" | "codigos" | null>(null);

  useEffect(() => {
    if (!usuario?.id) return;
    let activo = true;
    api
      .estado2fa()
      .then(({ habilitado, codigosRestantes }) => {
        if (activo) setEstado2fa({ habilitado, codigosRestantes });
      })
      .catch(() => {
        if (activo) setEstado2fa({ habilitado: usuario.totpHabilitado, codigosRestantes: 0 });
      });
    return () => {
      activo = false;
    };
  }, [usuario?.id, usuario?.totpHabilitado]);

  async function copiar(texto: string, tipo: "secreto" | "codigos") {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(tipo);
      window.setTimeout(() => setCopiado(null), 2000);
    } catch {
      setError2fa("No se pudo copiar al portapapeles. Selecciona y copia manualmente.");
    }
  }

  async function iniciar2fa() {
    if (!usuario) return;
    setError2fa(null);
    setOcupado2fa(true);
    try {
      const config = await api.iniciar2fa(usuario.proveedor === "local" ? clave2fa : undefined);
      setConfig2fa(config);
      setClave2fa("");
      setCodigosNuevos(null);
    } catch (e) {
      setError2fa(e instanceof Error ? e.message : "No se pudo iniciar la configuración.");
    } finally {
      setOcupado2fa(false);
    }
  }

  async function activar2fa() {
    setError2fa(null);
    setOcupado2fa(true);
    try {
      const { codigos } = await api.activar2fa(codigo2fa);
      setEstado2fa({ habilitado: true, codigosRestantes: codigos.length });
      setCodigosNuevos(codigos);
      setConfig2fa(null);
      setCodigo2fa("");
      onShowToast("Verificación en dos pasos activada.");
    } catch (e) {
      setError2fa(e instanceof Error ? e.message : "No se pudo activar la verificación.");
    } finally {
      setOcupado2fa(false);
    }
  }

  async function desactivar2fa() {
    if (!usuario) return;
    setError2fa(null);
    setOcupado2fa(true);
    try {
      await api.desactivar2fa({
        password: usuario.proveedor === "local" ? clave2fa : undefined,
        codigo: codigo2fa,
      });
      setEstado2fa({ habilitado: false, codigosRestantes: 0 });
      setModo2fa("inactivo");
      setCodigosNuevos(null);
      setClave2fa("");
      setCodigo2fa("");
      onShowToast("Verificación en dos pasos desactivada.");
    } catch (e) {
      setError2fa(e instanceof Error ? e.message : "No se pudo desactivar la verificación.");
    } finally {
      setOcupado2fa(false);
    }
  }

  async function regenerarCodigos() {
    if (!usuario) return;
    setError2fa(null);
    setOcupado2fa(true);
    try {
      const { codigos } = await api.regenerarCodigos2fa({
        password: usuario.proveedor === "local" ? clave2fa : undefined,
        codigo: codigo2fa,
      });
      setCodigosNuevos(codigos);
      setEstado2fa((actual) =>
        actual ? { habilitado: true, codigosRestantes: codigos.length } : actual,
      );
      setModo2fa("inactivo");
      setClave2fa("");
      setCodigo2fa("");
      onShowToast("Códigos de respaldo regenerados.");
    } catch (e) {
      setError2fa(e instanceof Error ? e.message : "No se pudieron regenerar los códigos.");
    } finally {
      setOcupado2fa(false);
    }
  }

  useEffect(() => {
    setNombre(usuario?.nombre ?? "");
    setFotoUrl(usuario?.fotoUrl ?? "");
    setTelefono(usuario?.telefono ?? "");
    setWhatsappOptIn(usuario?.whatsappOptIn ?? false);
    setCorreo(usuario?.email ?? "");
  }, [usuario?.nombre, usuario?.fotoUrl, usuario?.telefono, usuario?.whatsappOptIn, usuario?.email]);

  useEffect(() => {
    setFotoRota(false);
  }, [fotoUrl]);

  if (!usuario) return null;

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await actualizarPerfil({
        nombre: nombre.trim(),
        fotoUrl: fotoUrl.trim() || null,
        telefono: telefono.trim() || null,
        whatsappOptIn,
      });
      onShowToast("Perfil actualizado correctamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el perfil");
    } finally {
      setGuardando(false);
    }
  };

  const guardarCorreo = async (evento: FormEvent) => {
    evento.preventDefault();
    setErrorCorreo(null);
    setGuardandoCorreo(true);
    try {
      await cambiarCorreo({ email: correo.trim(), password: claveCorreo });
      setClaveCorreo("");
      onShowToast("Correo actualizado correctamente.");
    } catch (e) {
      setErrorCorreo(e instanceof Error ? e.message : "No se pudo cambiar el correo");
    } finally {
      setGuardandoCorreo(false);
    }
  };

  const guardarClave = async (evento: FormEvent) => {
    evento.preventDefault();
    setErrorClave(null);
    if (claveNueva !== claveRepite) {
      setErrorClave("La confirmación no coincide con la nueva contraseña.");
      return;
    }
    setGuardandoClave(true);
    try {
      await cambiarPassword({ actual: claveActual, nueva: claveNueva });
      setClaveActual("");
      setClaveNueva("");
      setClaveRepite("");
      onShowToast("Contraseña actualizada correctamente.");
    } catch (e) {
      setErrorClave(e instanceof Error ? e.message : "No se pudo cambiar la contraseña");
    } finally {
      setGuardandoClave(false);
    }
  };

  const mostrarFoto = Boolean(fotoUrl) && !fotoRota;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <SectionHero
        compact
        eyebrow="Mi espacio"
        icon={UserRound}
        title="Mi perfil"
        subtitle="Personaliza cómo apareces en Ingeniería SEI y revisa los datos de tu cuenta."
      />

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <section className="rounded-xl border border-gray-100 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-orange-100 bg-orange-50">
            {mostrarFoto ? (
              <img
                src={fotoUrl}
                alt={usuario.nombre}
                referrerPolicy="no-referrer"
                onError={() => setFotoRota(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl font-black text-[#C2410C]">{iniciales(usuario.nombre)}</span>
            )}
          </div>

          <h2 className="mt-4 text-lg font-bold text-gray-800">{usuario.nombre}</h2>
          <p className="truncate text-xs text-gray-500">{usuario.email}</p>

          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#9A3412]">
            <BadgeCheck className="h-3.5 w-3.5" />
            {ROL_ETIQUETA[usuario.rol]}
          </span>

          <div className="mt-5 space-y-3 border-t border-gray-100 pt-4 text-left">
            <div className="flex items-start gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Correo</p>
                <p className="truncate text-xs text-gray-600">{usuario.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Acceso</p>
                <p className="text-xs text-gray-600">
                  {usuario.proveedor === "google" ? "Cuenta de Google" : "Cuenta local"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <UserRound className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  Último acceso
                </p>
                <p className="text-xs text-gray-600">{fechaLarga(usuario.ultimoAcceso)}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800">Datos del perfil</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              El nombre y la foto se usan en la barra superior, el calendario y los tableros.
            </p>

            <form onSubmit={(evento) => void guardar(evento)} className="mt-5 space-y-4">
              <div>
                <label htmlFor="perfil-nombre" className="text-xs font-semibold text-slate-700">
                  Nombre para mostrar
                </label>
                <input
                  id="perfil-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                  className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
                />
              </div>

              <div>
                <label htmlFor="perfil-foto" className="text-xs font-semibold text-slate-700">
                  URL de la foto
                </label>
                <div className="relative mt-1.5">
                  <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="perfil-foto"
                    type="url"
                    value={fotoUrl}
                    onChange={(e) => setFotoUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  Déjala vacía para usar tus iniciales. Si tu cuenta es de Google, esta URL se toma de tu
                  perfil.
                </p>
              </div>

              <div>
                <label htmlFor="perfil-telefono" className="text-xs font-semibold text-slate-700">
                  Teléfono para WhatsApp
                </label>
                <div className="relative mt-1.5">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="perfil-telefono"
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="300 123 4567"
                    maxLength={30}
                    className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
                  />
                </div>
                <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={whatsappOptIn}
                    onChange={(e) => setWhatsappOptIn(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#C2410C]"
                  />
                  <span className="text-[11px] leading-relaxed text-gray-500">
                    Recibir recordatorios de tareas por WhatsApp. El número se usa solo para avisos de
                    Ingeniería SEI y puedes desactivarlo cuando quieras.
                  </span>
                </label>
              </div>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-gray-400">
                  Si personalizas tu nombre o foto, se conservarán al volver a entrar con Google.
                </p>
                <button
                  type="submit"
                  disabled={guardando}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {guardando ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800">Seguridad de la cuenta</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Cambia el correo con el que inicias sesión y tu contraseña.
            </p>

            {usuario.proveedor === "local" ? (
              <>
                <form
                  onSubmit={(evento) => void guardarCorreo(evento)}
                  className="mt-5 space-y-4 border-b border-gray-100 pb-5"
                >
                  <div>
                    <label htmlFor="perfil-correo" className="text-xs font-semibold text-slate-700">
                      Correo de acceso
                    </label>
                    <div className="relative mt-1.5">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        id="perfil-correo"
                        type="email"
                        value={correo}
                        onChange={(e) => setCorreo(e.target.value)}
                        required
                        maxLength={160}
                        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="perfil-correo-clave"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Contraseña actual
                    </label>
                    <input
                      id="perfil-correo-clave"
                      type="password"
                      value={claveCorreo}
                      onChange={(e) => setClaveCorreo(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
                    />
                    <p className="mt-1 text-[11px] text-gray-400">
                      La pedimos para confirmar el cambio de correo.
                    </p>
                  </div>

                  {errorCorreo && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                      {errorCorreo}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={guardandoCorreo}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Mail className="h-4 w-4" />
                    {guardandoCorreo ? "Guardando…" : "Actualizar correo"}
                  </button>
                </form>

                <form onSubmit={(evento) => void guardarClave(evento)} className="mt-5 space-y-4">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">
                    <KeyRound className="h-3.5 w-3.5" />
                    Cambiar contraseña
                  </h3>

                  <div>
                    <label htmlFor="perfil-clave-actual" className="text-xs font-semibold text-slate-700">
                      Contraseña actual
                    </label>
                    <input
                      id="perfil-clave-actual"
                      type="password"
                      value={claveActual}
                      onChange={(e) => setClaveActual(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="perfil-clave-nueva"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Nueva contraseña
                      </label>
                      <input
                        id="perfil-clave-nueva"
                        type="password"
                        value={claveNueva}
                        onChange={(e) => setClaveNueva(e.target.value)}
                        required
                        minLength={8}
                        maxLength={72}
                        autoComplete="new-password"
                        className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="perfil-clave-repite"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Repite la nueva
                      </label>
                      <input
                        id="perfil-clave-repite"
                        type="password"
                        value={claveRepite}
                        onChange={(e) => setClaveRepite(e.target.value)}
                        required
                        minLength={8}
                        maxLength={72}
                        autoComplete="new-password"
                        className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
                      />
                    </div>
                  </div>

                  {errorClave && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                      {errorClave}
                    </p>
                  )}

                  <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] text-gray-400">Mínimo 8 caracteres.</p>
                    <button
                      type="submit"
                      disabled={guardandoClave}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <KeyRound className="h-4 w-4" />
                      {guardandoClave ? "Guardando…" : "Cambiar contraseña"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <p className="mt-5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs leading-relaxed text-[#9A3412]">
                Tu cuenta ingresa con Google, así que el correo y la contraseña se administran desde tu
                cuenta de Google.
              </p>
            )}

            <div className="mt-6 border-t border-gray-100 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verificación en dos pasos
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                    Pide un código temporal de tu aplicación autenticadora (Google Authenticator,
                    Authy, 1Password) cada vez que inicies sesión.
                  </p>
                </div>
                {estado2fa && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      estado2fa.habilitado
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-slate-200 bg-slate-100 text-slate-500"
                    }`}
                  >
                    {estado2fa.habilitado ? "Activa" : "Inactiva"}
                  </span>
                )}
              </div>

              {codigosNuevos && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold text-amber-800">
                      Guarda estos códigos de respaldo. Cada uno sirve una sola vez y no se volverán a
                      mostrar.
                    </p>
                    <button
                      type="button"
                      onClick={() => void copiar(codigosNuevos.join("\n"), "codigos")}
                      className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-amber-300 px-2 py-1 text-[10px] font-bold text-amber-800 transition hover:bg-amber-100"
                    >
                      {copiado === "codigos" ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {copiado === "codigos" ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-xs text-amber-900">
                    {codigosNuevos.map((item) => (
                      <span key={item} className="rounded bg-white/70 px-2 py-1">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!estado2fa ? (
                <p className="mt-3 text-[11px] text-gray-400">Consultando estado…</p>
              ) : estado2fa.habilitado ? (
                <div className="mt-4 space-y-3">
                  <p className="text-[11px] text-gray-500">
                    {estado2fa.codigosRestantes} código
                    {estado2fa.codigosRestantes === 1 ? "" : "s"} de respaldo disponible
                    {estado2fa.codigosRestantes === 1 ? "" : "s"}.
                  </p>

                  {modo2fa === "inactivo" ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setError2fa(null);
                          setCodigosNuevos(null);
                          setModo2fa("regenerar");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Regenerar códigos
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setError2fa(null);
                          setCodigosNuevos(null);
                          setModo2fa("desactivar");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        <ShieldOff className="h-3.5 w-3.5" />
                        Desactivar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                      <p className="text-[11px] font-semibold text-gray-600">
                        {modo2fa === "desactivar"
                          ? "Confirma con tu contraseña y un código actual."
                          : "Confirma con tu contraseña y un código actual para generar códigos nuevos."}
                      </p>
                      {usuario.proveedor === "local" && (
                        <input
                          type="password"
                          value={clave2fa}
                          onChange={(e) => setClave2fa(e.target.value)}
                          placeholder="Contraseña actual"
                          autoComplete="current-password"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
                        />
                      )}
                      <input
                        value={codigo2fa}
                        onChange={(e) =>
                          setCodigo2fa(e.target.value.replace(/[^0-9A-Za-z-]/g, ""))
                        }
                        placeholder="Código de 6 dígitos o código de respaldo"
                        maxLength={12}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-sm tracking-widest text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
                      />
                      {error2fa && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                          {error2fa}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={ocupado2fa || codigo2fa.trim().length < 6}
                          onClick={() => void (modo2fa === "desactivar" ? desactivar2fa() : regenerarCodigos())}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            modo2fa === "desactivar"
                              ? "bg-red-600 hover:bg-red-700"
                              : "bg-[#C2410C] hover:bg-[#9A3412]"
                          }`}
                        >
                          {ocupado2fa
                            ? "Procesando…"
                            : modo2fa === "desactivar"
                              ? "Desactivar 2FA"
                              : "Generar códigos"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModo2fa("inactivo");
                            setClave2fa("");
                            setCodigo2fa("");
                            setError2fa(null);
                          }}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : config2fa ? (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <img
                      src={config2fa.qr}
                      alt="Código QR para configurar la verificación en dos pasos"
                      className="h-40 w-40 flex-shrink-0 rounded-lg border border-gray-200 bg-white p-1"
                    />
                    <div className="min-w-0 space-y-2">
                      <p className="text-[11px] leading-relaxed text-gray-500">
                        Escanea el código con tu aplicación autenticadora. Si no puedes escanearlo,
                        agrega esta clave manualmente:
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 font-mono text-[11px] text-gray-700">
                          {config2fa.secreto}
                        </code>
                        <button
                          type="button"
                          onClick={() => void copiar(config2fa.secreto, "secreto")}
                          className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-[10px] font-bold text-gray-600 transition hover:bg-gray-50"
                        >
                          {copiado === "secreto" ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {copiado === "secreto" ? "Copiada" : "Copiar"}
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        Después de escanear, escribe el código actual que muestra la aplicación.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={codigo2fa}
                      onChange={(e) => setCodigo2fa(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Código de 6 dígitos"
                      inputMode="numeric"
                      maxLength={6}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-sm tracking-widest text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10 sm:max-w-[220px]"
                    />
                    <button
                      type="button"
                      disabled={ocupado2fa || codigo2fa.length < 6}
                      onClick={() => void activar2fa()}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#C2410C] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {ocupado2fa ? "Activando…" : "Activar 2FA"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfig2fa(null);
                        setCodigo2fa("");
                        setError2fa(null);
                      }}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  </div>

                  {error2fa && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                      {error2fa}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {usuario.proveedor === "local" && (
                    <input
                      type="password"
                      value={clave2fa}
                      onChange={(e) => setClave2fa(e.target.value)}
                      placeholder="Contraseña actual"
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10 sm:max-w-sm"
                    />
                  )}
                  {error2fa && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                      {error2fa}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={ocupado2fa}
                    onClick={() => void iniciar2fa()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#C2410C] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    {ocupado2fa ? "Preparando…" : "Configurar verificación en dos pasos"}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
