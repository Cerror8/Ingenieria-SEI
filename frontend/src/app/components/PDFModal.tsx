import { useEffect, useState } from "react";
import {
  LayoutDashboard, Briefcase, BookOpen, FileText, FolderOpen,
  Activity, ChevronRight, ChevronDown, ChevronUp,
  Plus, Search, Download, Eye, Edit2, Bell, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, DollarSign, ArrowLeft, X, Upload,
  Link2, MoreHorizontal, ChevronLeft, Filter, Tag, Paperclip,
  Clock, BarChart2, Percent, Check, Trash2, Save, FileDown, Sliders
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend
} from "recharts";
import { api, type ProyectoApi } from "../api/client";

export function PDFModal({ onClose, onGenerate }: { onClose: () => void; onGenerate: () => void }) {
  const [generated, setGenerated] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proyectos, setProyectos] = useState<ProyectoApi[]>([]);
  const [tipo, setTipo] = useState("Informe ejecutivo");
  const [proyecto, setProyecto] = useState("Todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [sections, setSections] = useState({
    resumen: true, kpis: true, avance: true, presupuesto: true,
    indicadores: true, alertas: true, documentos: false, antecedentes: false,
  });

  useEffect(() => {
    let activo = true;
    api.proyectos()
      .then(({ proyectos: datos }) => {
        if (activo) setProyectos(datos);
      })
      .catch(() => undefined);
    return () => { activo = false; };
  }, []);

  const handleGen = async () => {
    setGenerando(true);
    setError(null);
    try {
      const periodo = desde && hasta ? `${desde} – ${hasta}` : "Período actual";
      await api.crearInforme({ tipo, periodo, proyecto });
      setGenerated(true);
      onGenerate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el informe.");
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Generar informe</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {!generated ? (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-700">Tipo de informe</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                  {["Informe ejecutivo", "Informe mensual", "Informe semanal"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-700">Proyecto</label>
                <select value={proyecto} onChange={e => setProyecto(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                  <option value="Todos">Todos los proyectos</option>
                  {proyectos.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-700">Período desde</label>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-700">Período hasta</label>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Secciones a incluir</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "resumen", label: "Resumen ejecutivo" },
                  { key: "kpis", label: "KPIs" },
                  { key: "avance", label: "Avance técnico" },
                  { key: "presupuesto", label: "Ejecución presupuestal" },
                  { key: "indicadores", label: "Indicadores" },
                  { key: "alertas", label: "Alertas" },
                  { key: "documentos", label: "Documentos" },
                  { key: "antecedentes", label: "Antecedentes" },
                ] as const).map(s => (
                  <label key={s.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={sections[s.key]} onChange={() => setSections(p => ({ ...p, [s.key]: !p[s.key] }))} className="w-4 h-4 accent-orange-600 rounded" />
                    <span className="text-sm text-gray-700">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {error}
              </div>
            )}
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
              <button onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50">Cancelar</button>
              <button onClick={() => void handleGen()} disabled={generando} className="flex-1 rounded-lg bg-[#C2410C] py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9A3412] disabled:opacity-60">
                {generando ? "Generando…" : "Generar"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Informe generado correctamente</h3>
            <p className="text-sm text-gray-400 mb-6">El informe está listo para visualizar y descargar.</p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                <Eye className="w-4 h-4" />Ver PDF
              </button>
              <button onClick={onClose} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-[#C2410C] text-white rounded-lg hover:bg-[#9A3412] transition-colors">
                <Download className="w-4 h-4" />Descargar PDF
              </button>
              <button onClick={onClose} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors">
                <FileDown className="w-4 h-4" />Word
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
