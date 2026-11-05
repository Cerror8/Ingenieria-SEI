import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, GraduationCap, Lock, Mail, ShieldCheck } from "lucide-react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";

const MENSAJES_ERROR: Record<string, string> = {
  google_no_configurado:
    "El acceso con Google aún no está configurado. Usa el acceso administrativo.",
  oauth_state: "La sesión de Google expiró. Inténtalo de nuevo.",
  dominio: "Debes ingresar con tu correo institucional de la universidad.",
  google: "No se pudo completar el inicio de sesión con Google.",
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function Escudo() {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/25 bg-white/10">
        <GraduationCap className="h-10 w-10 text-white" />
      </div>
    );
  }

  return (
    <img
      src="/escudo-cesmag.png"
      alt="Escudo Universidad CESMAG"
      className="h-20 w-20 object-contain"
      onError={() => setError(true)}
    />
  );
}

export function LoginView() {
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const errorQuery = params.get("error");
  const mensajeError =
    errorLocal ??
    (errorQuery ? (MENSAJES_ERROR[errorQuery] ?? "No se pudo iniciar sesión.") : null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorLocal(null);
    setEnviando(true);

    try {
      await iniciarSesion(email, password);
      navigate("/", { replace: true });
    } catch (e) {
      setErrorLocal(
        e instanceof ApiError ? e.message : "No se pudo iniciar sesión. Inténtalo de nuevo.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-4 sm:px-6 sm:py-6">
      <p className="mx-auto mb-3 max-w-6xl text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
        Ingeniería SEI · Acceso RAP
      </p>

      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl lg:grid-cols-[42%_58%]">
        {/* Panel institucional */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#1F2937] px-10 py-12 text-white lg:flex">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#EA580C]/10" />
          <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-white/5" />

          <div className="relative">
            <Escudo />
            <h1 className="mt-8 text-4xl font-black leading-[1.05] tracking-tight">
              Ingeniería
              <br />
              <span className="text-[#EA580C]">SEI</span>
            </h1>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/60">
              Gestión de Resultados de Aprendizaje · Acceso RAP
            </p>
          </div>

          <div className="relative space-y-4">
            <div className="h-px w-14 bg-[#EA580C]" />
            <p className="text-sm font-semibold text-white/90">Programa de Ingeniería Civil</p>
            <p className="text-xs text-white/45">Seguimiento y evaluación académica</p>
          </div>

          <p className="relative text-[11px] text-white/35">Universidad CESMAG · Pasto, Nariño</p>
        </aside>

        {/* Formulario */}
        <main className="px-6 py-10 sm:px-12 sm:py-14">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1F2937]">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-black leading-tight text-slate-800">Ingeniería SEI</p>
                <p className="text-[11px] text-slate-500">Acceso RAP · Universidad CESMAG</p>
              </div>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Iniciar sesión</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Ingresa con tus credenciales institucionales para continuar.
            </p>

            <form className="mt-8 space-y-4" onSubmit={onSubmit}>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  Correo administrativo
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@cesmag.edu.co"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={verPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-11 text-sm text-slate-800 outline-none transition focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <a
                  href="mailto:soporte@unicesmag.edu.co"
                  className="font-semibold text-[#C2410C] hover:text-[#9A3412] hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </a>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#EA580C]" />
                  Acceso administrativo
                </span>
              </div>

              {mensajeError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                >
                  {mensajeError}
                </p>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-lg bg-[#C2410C] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9A3412] focus:outline-none focus:ring-4 focus:ring-orange-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enviando ? "Ingresando…" : "Iniciar sesión"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">o</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.href = api.urlGoogle;
              }}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-orange-500/10"
            >
              <GoogleIcon />
              Acceder con Google
            </button>

            <p className="mt-8 text-center text-[11px] leading-relaxed text-slate-400">
              ¿Necesitas ayuda? Contacta a la oficina de TIC de la universidad.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
