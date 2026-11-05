import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck, UserRound } from "lucide-react";
import { api, ApiError } from "../../api/client";

const campoCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10";

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
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#1F2937] px-10 py-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#EA580C]/10" />
        <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-white/5" />

        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-black tracking-tight text-[#FDBA74] shadow-sm">
            SEI
          </div>
          <h1 className="mt-8 text-4xl font-black leading-[1.05] tracking-tight">
            Ingeniería
            <br />
            <span className="text-[#EA580C]">SEI</span>
          </h1>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/60">
            Solicita tu acceso al sistema de planificación, contratación, supervisión y control.
          </p>
        </div>

        <div className="relative space-y-4">
          <div className="h-px w-14 bg-[#EA580C]" />
          <p className="text-sm font-semibold text-white/90">Ingeniería Civil</p>
          <p className="text-xs text-white/45">Sebastian Escandon · Pasto, Nariño</p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 py-10 sm:px-12 sm:py-14">
        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-[#C2410C]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al inicio de sesión
          </button>

          {enviada ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
              <h2 className="mt-3 text-lg font-bold text-slate-800">Solicitud enviada</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Tu solicitud quedó registrada. Un administrador revisará la cuenta y asignará el rol
                correspondiente antes de que puedas ingresar.
              </p>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="mt-5 w-full rounded-lg bg-[#C2410C] py-2.5 text-sm font-semibold text-white transition hover:bg-[#9A3412]"
              >
                Ir al inicio de sesión
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-center gap-3 lg:hidden">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-[11px] font-black tracking-tight text-[#C2410C]">
                  SEI
                </div>
                <div>
                  <p className="text-sm font-black leading-tight text-slate-800">Ingeniería SEI</p>
                  <p className="text-[11px] text-slate-500">Solicitud de acceso</p>
                </div>
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Solicitar acceso</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Regístrate con tu correo. La cuenta quedará pendiente hasta que un administrador la
                apruebe.
              </p>

              <form className="mt-7 space-y-4" onSubmit={solicitar}>
                <div className="space-y-1.5">
                  <label htmlFor="registro-nombre" className="text-xs font-semibold text-slate-700">
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
                  <label htmlFor="registro-email" className="text-xs font-semibold text-slate-700">
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
                  <label htmlFor="registro-password" className="text-xs font-semibold text-slate-700">
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
                    className="text-xs font-semibold text-slate-700"
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
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full rounded-lg bg-[#C2410C] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9A3412] focus:outline-none focus:ring-4 focus:ring-orange-500/25 disabled:cursor-not-allowed disabled:opacity-60"
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
