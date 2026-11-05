import { useState } from "react";
import { Bell, Menu } from "lucide-react";
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
  const [menuAbierto, setMenuAbierto] = useState(false);

  const navigate = (v: string) => {
    setView(v as ViewType);
    if (v !== "project-detail") setSelectedProjectId(null);
    setMenuAbierto(false);
  };

  const selectProject = (id: string) => {
    setSelectedProjectId(id);
    setView("project-detail");
    setMenuAbierto(false);
  };

  const showToast = (msg: string) => setToast(msg);

  const getBreadcrumb = () => {
    const base = [{ label: "Ingeniería SEI" }];
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
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar
        currentView={view}
        onNavigate={navigate}
        open={menuAbierto}
        onClose={() => setMenuAbierto(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-10 flex flex-shrink-0 items-center justify-between gap-2 border-b border-gray-100 bg-white px-4 py-3 shadow-sm sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuAbierto(true)}
              aria-label="Abrir menú"
              aria-expanded={menuAbierto}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden min-w-0 overflow-hidden sm:block">
              <Crumb items={getBreadcrumb()} />
            </div>
            <div className="min-w-0 overflow-hidden sm:hidden">
              <Crumb items={[{ label: getBreadcrumb().slice(-1)[0].label }]} />
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-1.5 text-[11px] font-medium text-gray-400 sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              Sesión activa
            </div>
            <button className="relative rounded-lg p-2 transition-colors hover:bg-gray-100" aria-label="Notificaciones">
              <Bell className="h-4 w-4 text-gray-400" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>
            <div className="flex items-center gap-2">
              {usuario?.fotoUrl ? (
                <img
                  src={usuario.fotoUrl}
                  alt={usuario.nombre}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full border border-gray-200 object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C2410C]/10">
                  <span className="text-xs font-black text-[#C2410C]">
                    {usuario ? iniciales(usuario.nombre) : "SE"}
                  </span>
                </div>
              )}
              <div className="hidden min-w-0 md:block">
                <p className="max-w-[160px] truncate text-xs font-bold leading-tight text-gray-700">
                  {usuario?.nombre}
                </p>
                <p className="max-w-[160px] truncate text-[10px] text-gray-400">
                  {usuario?.email}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
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
              onSave={(id) => {
                setSelectedProjectId(id);
                setView("project-detail");
                showToast("Proyecto creado correctamente.");
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
