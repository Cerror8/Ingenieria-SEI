import { pool } from "./db.js";

type EntradaAuditoria = {
  usuario: string;
  accion: string;
  entidad: string;
  registro: string;
  previo?: string;
  nuevo?: string;
};

export async function registrarAuditoria(entrada: EntradaAuditoria): Promise<void> {
  await pool.query(
    `INSERT INTO auditoria (usuario, accion, entidad, registro, valor_previo, valor_nuevo)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      entrada.usuario,
      entrada.accion,
      entrada.entidad,
      entrada.registro,
      entrada.previo ?? "—",
      entrada.nuevo ?? "—",
    ],
  );
}
