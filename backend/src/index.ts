import "dotenv/config";
import { app } from "./app.js";
import { asegurarAdmin } from "./auth/admin.js";

const port = Number(process.env.PORT ?? 4000);

asegurarAdmin()
  .then(() => {
    app.listen(port, () => {
      console.log(`API RAP-16 escuchando en http://localhost:${port}/api`);
    });
  })
  .catch((err) => {
    console.error("No se pudo inicializar la base de datos. ¿Está Docker arriba?", err);
    process.exit(1);
  });
