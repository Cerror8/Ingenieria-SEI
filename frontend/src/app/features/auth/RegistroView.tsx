import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck, UserRound } from "lucide-react";
import { api, ApiError } from "../../api/client";

const campoCls =
  "w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#F39200] focus:ring-4 focus:ring-[#F39200]/15";

export function RegistroView() {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);

  async function solicitar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setEnviando(true);
    try {
      await api.registrar({ nombre: nombre.trim(), email: email.trim(), password });
      setEnviada(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo enviar la solicitud.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[42%_58%]">
      <aside className="sei-blueprint relative hidden flex-col justify-between overflow-hidden bg-[#1B1B1B] px-10 py-12 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(243,146,0,0.18),transparent_60%)]"
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-[#F39200] via-[#F39200]/70 to-transparent" />
        <div className="pointer-events-none absolute left-4 top-4 h-4 w-4 border-l border-t border-white/25" />
        <div className="pointer-events-none absolute right-4 top-4 h-4 w-4 border-r border-t border-white/25" />
        <div className="pointer-events-none absolute bottom-4 left-4 h-4 w-4 border-b border-l border-white/15" />
        <div className="pointer-events-none absolute bottom-4 right-4 h-4 w-4 border-b border-r border-white/15" />

        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-sm border border-white/15 bg-white/5 font-mono text-sm font-medium tracking-[0.14em] text-[#FDBA74]">
            SEI
          </div>
          <p className="sei-label mt-8 text-[#FDBA74]">Solicitud de acceso</p>
          <h1 className="mt-2 text-4xl font-bold leading-[1.05] tracking-[-0.02em]">
            Ingeniería
            <br />
            <span className="text-[#F39200]">SEI</span>
          </h1>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/55">
            Solicita tu acceso al sistema de planificación, contratación, supervisión y control.
          </p>
        </div>

        <div className="relative space-y-4">
          <div className="sei-rule w-40" />
          <p className="sei-label text-white/80">Ingeniería civil</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
            Sebastián Escandón · Pasto, Nariño
          </p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 py-10 sm:px-12 sm:py-14">
        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mb-6 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500 transition hover:text-[#9A3412]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al inicio de sesión
          </button>

          {enviada ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
              <h2 className="mt-3 text-lg font-bold text-slate-800">Solicitud enviada</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Tu solicitud quedó registrada. Un administrador revisará la cuenta y asignará el rol
                correspondiente antes de que puedas ingresar.
              </p>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="mt-5 w-full rounded-md bg-[#F39200] py-2.5 text-sm font-semibold text-[#1B1B1B] transition hover:bg-[#FFAA2B]"
              >
                Ir al inicio de sesión
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-center gap-3 lg:hidden">
                <div className="flex h-12 w-12 items-center justify-center border border-[#F39200]/30 bg-[#F39200]/10 font-mono text-[11px] font-medium tracking-[0.12em] text-[#9A3412]">
                  SEI
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight text-slate-800">Ingeniería SEI</p>
                  <p className="sei-label mt-0.5 text-slate-500">Solicitud de acceso</p>
                </div>
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Solicitar acceso</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Regístrate con tu correo. La cuenta quedará pendiente hasta que un administrador la
                apruebe.
              </p>

              <form className="mt-7 space-y-4" onSubmit={solicitar}>
                <div className="space-y-1.5">
                  <label htmlFor="registro-nombre" className="sei-label text-slate-500">
                    Nombre completo
                  </label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="registro-nombre"
                      required
                      minLength={2}
                      maxLength={120}
                      autoComplete="name"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej. María Fernanda López"
                      className={campoCls}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="registro-email" className="sei-label text-slate-500">
                    Correo
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="registro-email"
                      type="email"
                      required
                      maxLength={160}
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="persona@correo.com"
                      className={campoCls}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="registro-password" className="sei-label text-slate-500">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="registro-password"
                      type={verPassword ? "text" : "password"}
                      required
                      minLength={8}
                      maxLength={72}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className={`${campoCls} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setVerPassword((valor) => !valor)}
                      aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    >
                      {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="registro-confirmacion"
                    className="sei-label text-slate-500"
                  >
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="registro-confirmacion"
                      type={verPassword ? "text" : "password"}
                      required
                      minLength={8}
                      maxLength={72}
                      autoComplete="new-password"
                      value={confirmacion}
                      onChange={(e) => setConfirmacion(e.target.value)}
                      placeholder="Repite la contraseña"
                      className={campoCls}
                    />
                  </div>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full rounded-md bg-[#F39200] py-2.5 text-sm font-semibold text-[#1B1B1B] transition hover:bg-[#FFAA2B] focus:outline-none focus:ring-4 focus:ring-[#F39200]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {enviando ? "Enviando solicitud…" : "Enviar solicitud"}
                </button>
              </form>

              <p className="mt-6 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
                También puedes solicitar acceso con Google desde el inicio de sesión. Si tu cuenta de
                Google no está registrada, quedará en la misma bandeja de aprobación.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
