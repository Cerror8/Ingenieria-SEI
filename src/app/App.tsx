import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Briefcase, BookOpen, FileText, FolderOpen,
  Activity, ChevronRight, ChevronDown, ChevronUp,
  Plus, Search, Download, Eye, Edit2, Bell, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, DollarSign, ArrowLeft, X, Upload,
  Link2, MoreHorizontal, ChevronLeft, Filter, Tag, Paperclip,
  Clock, BarChart2, Percent, Check, Trash2, Save, FileDown, Sliders
} from "lucide-react";
import { ViewType } from "./types";
import { Crumb } from "./components/shared";
import { DashboardView } from "./features/dashboard/DashboardView";
import { ProjectsListView } from "./features/projects/pages/ProjectsListView";
import { CreateProjectView } from "./features/projects/pages/CreateProjectView";
import { ProjectDetailView } from "./features/projects/pages/ProjectDetailView";
import { AntecedentesView } from "./features/antecedentes/AntecedentesView";
import { InformesView } from "./features/informes/InformesView";
import { SeguimientoView } from "./features/seguimiento/SeguimientoView";
import { DocumentosView } from "./features/documentos/DocumentosView";
import { PDFModal } from "./components/PDFModal";
import { Toast } from "./components/Toast";
import { Sidebar } from "./layout/Sidebar";

export default function App() {
  const [view, setView] = useState<ViewType>("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showPDF, setShowPDF] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState("hace 1 min");
  const countRef = useRef(0);

  useEffect(() => {
    const msgs = [
      "Proyecto PRY-2026-001 actualizado. El avance técnico cambió de 55% a 68%.",
      "Indicador IND-003 actualizado. Docentes capacitados: 60 → 65.",
      "Presupuesto PRY-2026-005 ejecutado actualizado: 72% → 75%.",
    ];
    const interval = setInterval(() => {
      countRef.current += 1;
      setLastUpdate("hace unos segundos");
      if (countRef.current % 2 === 0) {
        setToast(msgs[countRef.current % msgs.length]);
      }
      const restore = setTimeout(() => setLastUpdate("hace 1 min"), 8000);
      return () => clearTimeout(restore);
    }, 18000);
    return () => clearInterval(interval);
  }, []);

  const navigate = (v: string) => {
    setView(v as ViewType);
    if (v !== "project-detail") setSelectedProjectId(null);
  };

  const selectProject = (id: string) => {
    setSelectedProjectId(id);
    setView("project-detail");
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setLastUpdate("hace 5 segundos");
    setTimeout(() => setLastUpdate("hace 1 min"), 8000);
  };

  const getBreadcrumb = () => {
    const base = [{ label: "Plataforma Institucional" }, { label: "Gestión de Proyectos" }];
    const map: Record<string, string> = { dashboard: "Dashboard", projects: "Proyectos", antecedentes: "Antecedentes", informes: "Informes", documentos: "Documentos", seguimiento: "Seguimiento" };
    if (view === "create-project") return [...base, { label: "Proyectos" }, { label: "Nuevo proyecto" }];
    if (view === "project-detail" && selectedProjectId) return [...base, { label: "Proyectos" }, { label: selectedProjectId }];
    if (map[view]) return [...base, { label: map[view] }];
    return base;
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <Sidebar currentView={view} onNavigate={navigate} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-sm z-10">
          <Crumb items={getBreadcrumb()} />
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Actualizado {lastUpdate}
            </div>
            <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="w-4 h-4 text-gray-400" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
            <div className="w-8 h-8 bg-[#C2410C]/10 rounded-full flex items-center justify-center">
              <span className="text-xs font-black text-[#C2410C]">CL</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {view === "dashboard" && (
            <DashboardView onProjectSelect={selectProject} onGenerateReport={() => setShowPDF(true)} />
          )}
          {view === "projects" && (
            <ProjectsListView onSelectProject={selectProject} onCreateProject={() => setView("create-project")} />
          )}
          {view === "create-project" && (
            <CreateProjectView onBack={() => setView("projects")} onSave={() => { setView("projects"); showToast("Proyecto guardado correctamente."); }} />
          )}
          {view === "project-detail" && selectedProjectId && (
            <ProjectDetailView
              projectId={selectedProjectId}
              onBack={() => setView("projects")}
              onGenerateReport={() => setShowPDF(true)}
              onShowToast={showToast}
            />
          )}
          {view === "antecedentes" && <AntecedentesView />}
          {view === "informes" && <InformesView onGenerate={() => setShowPDF(true)} />}
          {view === "documentos" && <DocumentosView />}
          {view === "seguimiento" && <SeguimientoView onSelectProject={selectProject} />}
        </main>
      </div>

      {showPDF && (
        <PDFModal onClose={() => setShowPDF(false)} onGenerate={() => showToast("Informe generado correctamente.")} />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
