import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";

export function CargandoModule({ mensaje = "Cargando información…" }: { mensaje?: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-gray-100 bg-white shadow-sm">
      <Loader2 className="h-6 w-6 animate-spin text-[#C2410C]" />
      <p className="text-sm font-medium text-gray-500">{mensaje}</p>
    </div>
  );
}

export function ErrorModule({
  mensaje,
  onRetry,
}: {
  mensaje: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-xl border border-red-100 bg-white px-6 text-center shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>
      <div>
        <p className="text-sm font-bold text-gray-800">No se pudo cargar la información</p>
        <p className="mt-1 max-w-md text-xs text-gray-500">{mensaje}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9A3412]"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      )}
    </div>
  );
}
