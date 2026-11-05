import { useEffect, useState, type FormEvent } from "react";
import { BadgeCheck, Image as ImageIcon, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import type { Rol } from "../../types";

const ROL_ETIQUETA: Record<Rol, string> = {
  admin: "Administrador",
  docente: "Docente",
  estudiante: "Estudiante",
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
  const { usuario, actualizarPerfil } = useAuth();
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [fotoUrl, setFotoUrl] = useState(usuario?.fotoUrl ?? "");
  const [fotoRota, setFotoRota] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNombre(usuario?.nombre ?? "");
    setFotoUrl(usuario?.fotoUrl ?? "");
  }, [usuario?.nombre, usuario?.fotoUrl]);

  useEffect(() => {
    setFotoRota(false);
  }, [fotoUrl]);

  if (!usuario) return null;

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await actualizarPerfil({ nombre: nombre.trim(), fotoUrl: fotoUrl.trim() || null });
      onShowToast("Perfil actualizado correctamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el perfil");
    } finally {
      setGuardando(false);
    }
  };

  const mostrarFoto = Boolean(fotoUrl) && !fotoRota;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Mi perfil</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Personaliza cómo apareces en Ingeniería SEI y revisa los datos de tu cuenta.
        </p>
      </div>

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
              <label htmlFor="perfil-email" className="text-xs font-semibold text-slate-700">
                Correo
              </label>
              <input
                id="perfil-email"
                value={usuario.email}
                readOnly
                disabled
                className="mt-1.5 w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                El correo queda ligado a tu cuenta y no se puede cambiar desde aquí.
              </p>
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
      </div>
    </div>
  );
}
