import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from "lucide-react";
import logoSei from "../../../assets/brand/logo-sei.png";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";

const MENSAJES_ERROR: Record<string, string> = {
  google_no_configurado:
    "El acceso con Google aún no está configurado. Usa el acceso administrativo.",
  oauth_state: "La sesión de Google expiró. Inténtalo de nuevo.",
  dominio: "Esta cuenta de Google no está autorizada para ingresar.",
  google: "No se pudo completar el inicio de sesión con Google.",
  pendiente:
    "Tu solicitud está pendiente de aprobación. Un administrador debe habilitar la cuenta.",
  inactivo: "Tu cuenta está inactiva. Contacta a un administrador.",
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

const campoCls =
  "w-full rounded-lg border border-[#E4E4E4] bg-[#FAFAFA] py-2.5 pl-10 pr-3 text-sm text-[#1B1B1B] outline-none transition placeholder:text-[#B3B2B2] focus:border-[#F39200] focus:bg-white focus:ring-4 focus:ring-[#F39200]/15";

export function LoginView() {
  const { iniciarSesion, verificar2fa } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [paso, setPaso] = useState<"credenciales" | "codigo">(() =>
    params.get("paso") === "2fa" ? "codigo" : "credenciales",
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [codigo, setCodigo] = useState("");
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
      const resultado = await iniciarSesion(email, password);
      if (resultado.requiere2fa) {
        setCodigo("");
        setPaso("codigo");
        return;
      }
      navigate("/", { replace: true });
    } catch (e) {
      setErrorLocal(
        e instanceof ApiError ? e.message : "No se pudo iniciar sesión. Inténtalo de nuevo.",
      );
    } finally {
      setEnviando(false);
    }
  }

  async function onVerificar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorLocal(null);
    setEnviando(true);

    try {
      await verificar2fa(codigo);
      navigate("/", { replace: true });
    } catch (e) {
      setErrorLocal(
        e instanceof ApiError ? e.message : "No se pudo verificar el código. Inténtalo de nuevo.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F4] lg:grid lg:grid-cols-[45%_55%]">
      {/* Panel de marca */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#1B1B1B] px-10 py-12 lg:flex">
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[22px] border-[#F39200]/15"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full border-[26px] border-white/5"
        />

        <div className="relative">
          <div className="inline-flex rounded-2xl bg-white px-5 py-4 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.65)]">
            <img
              src={logoSei}
              alt="Sebastián Escandón · Ingeniero Civil"
              className="h-24 w-auto"
            />
          </div>

          <h1 className="mt-9 text-4xl font-black leading-[1.05] tracking-tight text-white">
            Ingeniería
            <span className="ml-2 text-[#F39200]">SEI</span>
          </h1>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
            Planificación, contratación, supervisión y control de proyectos de ingeniería civil.
          </p>
        </div>

        <div className="relative space-y-4">
          <div className="h-1 w-16 rounded-full bg-[#F39200]" />
          <div className="flex flex-wrap gap-2">
            {["Proyectos", "EDT", "Presupuesto", "Tableros", "Documentos"].map((modulo) => (
              <span
                key={modulo}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/60"
              >
                {modulo}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-white/35">
            Sebastián Escandón Ingeniero Civil · Pasto, Nariño
          </p>
        </div>
      </aside>

      {/* Formulario */}
      <main className="flex min-h-screen items-center justify-center bg-white px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <img
              src={logoSei}
              alt="Sebastián Escandón · Ingeniero Civil"
              className="h-16 w-auto"
            />
            <span className="rounded-full bg-[#FFF3E2] px-3 py-1 text-[11px] font-black tracking-wide text-[#B45309]">
              SEI
            </span>
          </div>

          {paso === "codigo" ? (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF3E2] text-[#B45309]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-[#1B1B1B]">
                Verificación en dos pasos
              </h2>
              <p className="mt-1.5 text-sm text-[#706F6F]">
                Escribe el código de 6 dígitos de tu aplicación autenticadora. También puedes usar
                uno de tus códigos de respaldo.
              </p>

              <form className="mt-8 space-y-4" onSubmit={onVerificar}>
                <div className="space-y-1.5">
                  <label htmlFor="codigo" className="text-xs font-semibold text-[#3F3F3F]">
                    Código de verificación
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B3B2B2]" />
                    <input
                      id="codigo"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      required
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value.replace(/[^0-9A-Za-z-]/g, ""))}
                      placeholder="123 456"
                      maxLength={12}
                      className={`${campoCls} tracking-[0.35em]`}
                    />
                  </div>
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
                  disabled={enviando || codigo.trim().length < 6}
                  className="w-full rounded-lg bg-[#F39200] py-2.5 text-sm font-bold text-[#1B1B1B] shadow-sm transition hover:bg-[#DE8500] focus:outline-none focus:ring-4 focus:ring-[#F39200]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {enviando ? "Verificando…" : "Verificar e ingresar"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setErrorLocal(null);
                  setCodigo("");
                  setPaso("credenciales");
                }}
                className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#706F6F] transition hover:text-[#1B1B1B]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver al inicio de sesión
              </button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold tracking-tight text-[#1B1B1B]">Iniciar sesión</h2>
              <p className="mt-1.5 text-sm text-[#706F6F]">
                Ingresa con tus credenciales para continuar.
              </p>

              <form className="mt-8 space-y-4" onSubmit={onSubmit}>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-semibold text-[#3F3F3F]">
                    Correo
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B3B2B2]" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="username"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="usuario@gmail.com"
                      className={campoCls}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-xs font-semibold text-[#3F3F3F]">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B3B2B2]" />
                    <input
                      id="password"
                      type={verPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••"
                      className={`${campoCls} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setVerPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#B3B2B2] transition hover:bg-[#F1F1F1] hover:text-[#706F6F]"
                      aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <a
                    href="mailto:soporte@unicesmag.edu.co"
                    className="font-semibold text-[#B45309] hover:text-[#92400E] hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#B3B2B2]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#F39200]" />
                    Acceso protegido
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
                  className="w-full rounded-lg bg-[#F39200] py-2.5 text-sm font-bold text-[#1B1B1B] shadow-sm transition hover:bg-[#DE8500] focus:outline-none focus:ring-4 focus:ring-[#F39200]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {enviando ? "Ingresando…" : "Iniciar sesión"}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#ECECEC]" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-[#B3B2B2]">
                  o
                </span>
                <div className="h-px flex-1 bg-[#ECECEC]" />
              </div>

              <button
                type="button"
                onClick={() => {
                  window.location.href = api.urlGoogle;
                }}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#E4E4E4] bg-white py-2.5 text-sm font-semibold text-[#3F3F3F] transition hover:bg-[#FAFAFA] focus:outline-none focus:ring-4 focus:ring-[#F39200]/15"
              >
                <GoogleIcon />
                Acceder con Google
              </button>

              <p className="mt-6 text-center text-xs text-[#706F6F]">
                ¿No tienes cuenta?{" "}
                <Link to="/registro" className="font-semibold text-[#B45309] hover:underline">
                  Solicita acceso
                </Link>
              </p>

              <p className="mt-3 text-center text-[11px] leading-relaxed text-[#B3B2B2]">
                ¿Necesitas ayuda? Contacta a la oficina de software.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
