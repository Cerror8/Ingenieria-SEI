import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import type { ViewType } from "../types";
import { Crumb } from "../components/shared";
import { Toast } from "../components/Toast";
import { Sidebar } from "./Sidebar";
import { ProfileMenu } from "./ProfileMenu";
import { NotificationsMenu } from "./NotificationsMenu";
import { DashboardView } from "../features/dashboard/DashboardView";
import { TablerosView } from "../features/tableros/TablerosView";
import { MiTableroView } from "../features/mi-tablero/MiTableroView";
import { ProjectsListView } from "../features/projects/pages/ProjectsListView";
import { CreateProjectView } from "../features/projects/pages/CreateProjectView";
import { ProjectDetailView } from "../features/projects/pages/ProjectDetailView";
import { AntecedentesView } from "../features/antecedentes/AntecedentesView";
import { InformesView } from "../features/informes/InformesView";
import { SeguimientoView } from "../features/seguimiento/SeguimientoView";
import { DocumentosView } from "../features/documentos/DocumentosView";
import { CalendarView } from "../features/calendario/CalendarView";
import { FormatosView } from "../features/formatos/FormatosView";
import { ProfileView } from "../features/perfil/ProfileView";
import { UsuariosView } from "../features/usuarios/UsuariosView";

const ETIQUETAS_VISTA: Record<string, string> = {
  dashboard: "Dashboard",
  "mi-tablero": "Mi tablero",
  tableros: "Tableros",
  projects: "Proyectos",
  antecedentes: "Antecedentes",
  informes: "Informes",
  documentos: "Documentos",
  seguimiento: "Seguimiento",
  calendario: "Calendario",
  formatos: "Formatos",
  usuarios: "Usuarios",
  perfil: "Mi perfil",
};

const CLAVE_SIDEBAR = "sei-sidebar-colapsado";

export function AppShell() {
  const [view, setView] = useState<ViewType>("dashboard");
  const [sidebarColapsado, setSidebarColapsado] = useState(
    () => window.localStorage.getItem(CLAVE_SIDEBAR) === "1",
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectTab, setProjectTab] = useState("resumen");
  const [toast, setToast] = useState<string | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const navigate = (v: string) => {
    setView(v as ViewType);
    if (v !== "project-detail") setSelectedProjectId(null);
    setMenuAbierto(false);
  };

  const selectProject = (id: string, tab = "resumen") => {
    setSelectedProjectId(id);
    setProjectTab(tab);
    setView("project-detail");
    setMenuAbierto(false);
  };

  const editProject = (id: string) => {
    setSelectedProjectId(id);
    setView("edit-project");
    setMenuAbierto(false);
  };

  const showToast = (msg: string) => setToast(msg);

  useEffect(() => {
    window.localStorage.setItem(CLAVE_SIDEBAR, sidebarColapsado ? "1" : "0");
  }, [sidebarColapsado]);

  const getBreadcrumb = () => {
    if (view === "create-project" || view === "edit-project") {
      return [{ label: "Proyectos" }, { label: view === "edit-project" ? "Editar proyecto" : "Nuevo proyecto" }];
    }
    if (view === "project-detail" && selectedProjectId) {
      return [{ label: "Proyectos" }, { label: selectedProjectId }];
    }
    const etiqueta = ETIQUETAS_VISTA[view];
    return etiqueta ? [{ label: etiqueta }] : [];
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar
        currentView={view}
        onNavigate={navigate}
        open={menuAbierto}
        onClose={() => setMenuAbierto(false)}
        collapsed={sidebarColapsado}
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
            <button
              type="button"
              onClick={() => setSidebarColapsado((valor) => !valor)}
              aria-label={sidebarColapsado ? "Expandir barra lateral" : "Retraer barra lateral"}
              aria-pressed={sidebarColapsado}
              title={sidebarColapsado ? "Expandir barra lateral" : "Retraer barra lateral"}
              className="hidden rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 lg:inline-flex"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden min-w-0 overflow-hidden sm:block">
              <Crumb items={getBreadcrumb()} />
            </div>
            <div className="min-w-0 overflow-hidden sm:hidden">
              <Crumb items={[{ label: getBreadcrumb().slice(-1)[0]?.label ?? "Panel" }]} />
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-1.5 text-[11px] font-medium text-gray-400 sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              Sesión activa
            </div>
            <NotificationsMenu onNavigate={navigate} />
            <ProfileMenu onNavigate={navigate} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {view === "dashboard" && (
            <DashboardView
              onProjectSelect={selectProject}
              onOpenReports={() => navigate("informes")}
            />
          )}
          {view === "mi-tablero" && <MiTableroView onNavigate={navigate} />}
          {view === "tableros" && <TablerosView onNavigate={navigate} />}
          {view === "projects" && (
            <ProjectsListView
              onSelectProject={selectProject}
              onEditProject={editProject}
              onDocumentsProject={(id) => selectProject(id, "documentos")}
              onCreateProject={() => { setSelectedProjectId(null); setView("create-project"); }}
            />
          )}
          {(view === "create-project" || (view === "edit-project" && selectedProjectId)) && (
            <CreateProjectView
              key={view === "edit-project" ? selectedProjectId : "nuevo"}
              proyectoId={view === "edit-project" ? selectedProjectId ?? undefined : undefined}
              onBack={() => setView("projects")}
              onSave={(id) => {
                selectProject(id);
                showToast(view === "edit-project" ? "Proyecto actualizado correctamente." : "Proyecto creado correctamente.");
              }}
            />
          )}
          {view === "project-detail" && selectedProjectId && (
            <ProjectDetailView
              key={`${selectedProjectId}-${projectTab}`}
              projectId={selectedProjectId}
              initialTab={projectTab}
              onBack={() => setView("projects")}
              onEdit={() => editProject(selectedProjectId)}
              onShowToast={showToast}
            />
          )}
          {view === "antecedentes" && <AntecedentesView />}
          {view === "informes" && <InformesView />}
          {view === "documentos" && <DocumentosView />}
          {view === "seguimiento" && <SeguimientoView onSelectProject={selectProject} />}
          {view === "calendario" && <CalendarView />}
          {view === "formatos" && <FormatosView />}
          {view === "usuarios" && <UsuariosView onShowToast={showToast} />}
          {view === "perfil" && <ProfileView onShowToast={showToast} />}
        </main>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
