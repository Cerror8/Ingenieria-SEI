import { app } from "../backend/dist/app.js";

let preparacion = null;

async function preparar() {
  if (!preparacion) {
    preparacion = (async () => {
      try {
        const { asegurarAdmin } = await import("../backend/dist/auth/admin.js");
        await asegurarAdmin();
      } catch (error) {
        console.error("[vercel] No se pudo preparar el administrador:", error.message);
        preparacion = null;
      }
    })();
  }
  return preparacion;
}

export default async function handler(req, res) {
  await preparar();
  return app(req, res);
}
