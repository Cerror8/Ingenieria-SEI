import { useState } from "react";
import { Bell } from "lucide-react";
import type { ViewType } from "../types";
import { Crumb } from "../components/shared";
import { PDFModal } from "../components/PDFModal";
import { Toast } from "../components/Toast";
import { Sidebar } from "./Sidebar";
import { useAuth } from "../auth/AuthProvider";
import { DashboardView } from "../features/dashboard/DashboardView";
import { TablerosView } from "../features/tableros/TablerosView";
import { ProjectsListView } from "../features/projects/pages/ProjectsListView";
import { CreateProjectView } from "../features/projects/pages/CreateProjectView";
import { ProjectDetailView } from "../features/projects/pages/ProjectDetailView";
import { AntecedentesView } from "../features/antecedentes/AntecedentesView";
import { InformesView } from "../features/informes/InformesView";
import { SeguimientoView } from "../features/seguimiento/SeguimientoView";
import { DocumentosView } from "../features/documentos/DocumentosView";

const ETIQUETAS_VISTA: Record<string, string> = {
  dashboard: "Dashboard",
  tableros: "Tableros",
  projects: "Proyectos",
  antecedentes: "Antecedentes",
  informes: "Informes",
  documentos: "Documentos",
  seguimiento: "Seguimiento",
};

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppShell() {
  const { usuario } = useAuth();
  const [view, setView] = useState<ViewType>("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showPDF, setShowPDF] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const navigate = (v: string) => {
    setView(v as ViewType);
    if (v !== "project-detail") setSelectedProjectId(null);
  };

  const selectProject = (id: string) => {
    setSelectedProjectId(id);
    setView("project-detail");
  };

  const showToast = (msg: string) => setToast(msg);

  const getBreadcrumb = () => {
    const base = [{ label: "Ingeniería SEI" }, { label: "Plataforma institucional" }];
    if (view === "create-project") {
      return [...base, { label: "Proyectos" }, { label: "Nuevo proyecto" }];
    }
    if (view === "project-detail" && selectedProjectId) {
      return [...base, { label: "Proyectos" }, { label: selectedProjectId }];
    }
    const etiqueta = ETIQUETAS_VISTA[view];
    return etiqueta ? [...base, { label: etiqueta }] : base;
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
              Sesión activa
            </div>
            <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="w-4 h-4 text-gray-400" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
            <div className="flex items-center gap-2">
              {usuario?.fotoUrl ? (
                <img
                  src={usuario.fotoUrl}
                  alt={usuario.nombre}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="w-8 h-8 bg-[#C2410C]/10 rounded-full flex items-center justify-center">
                  <span className="text-xs font-black text-[#C2410C]">
                    {usuario ? iniciales(usuario.nombre) : "SE"}
                  </span>
                </div>
              )}
              <div className="hidden md:block min-w-0">
                <p className="text-xs font-bold text-gray-700 leading-tight truncate max-w-[160px]">
                  {usuario?.nombre}
                </p>
                <p className="text-[10px] text-gray-400 truncate max-w-[160px]">
                  {usuario?.email}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {view === "dashboard" && (
            <DashboardView
              onProjectSelect={selectProject}
              onGenerateReport={() => setShowPDF(true)}
            />
          )}
          {view === "tableros" && <TablerosView />}
          {view === "projects" && (
            <ProjectsListView
              onSelectProject={selectProject}
              onCreateProject={() => setView("create-project")}
            />
          )}
          {view === "create-project" && (
            <CreateProjectView
              onBack={() => setView("projects")}
              onSave={() => {
                setView("projects");
                showToast("Proyecto guardado correctamente.");
              }}
            />
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
        <PDFModal
          onClose={() => setShowPDF(false)}
          onGenerate={() => showToast("Informe generado correctamente.")}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
