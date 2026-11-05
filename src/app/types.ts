export type Rol = "admin" | "docente" | "estudiante" | "usuario";

export type Proveedor = "google" | "local";

export type Usuario = {
  id: string;
  email: string;
  nombre: string;
  fotoUrl: string | null;
  proveedor: Proveedor;
  rol: Rol;
  ultimoAcceso: string | null;
};
