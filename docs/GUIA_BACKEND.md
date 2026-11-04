# Guía · Backend (Node + Express + TypeScript)

## 1. Arranque
```bash
cd backend && cp .env.example .env && npm install && npm run dev
curl http://localhost:4000/api/salud        # {"ok":true}
```
`.env`: `DATABASE_URL`, `PORT`, `CORS_ORIGIN` (URL del frontend; varias separadas por coma).

## 2. Estructura
```
src/
  index.ts            arranque
  app.ts              middlewares, catálogos y montaje de rutas
  db.ts               pool de pg, withTx() y usuario institucional
  http.ts             HttpError, manejo de errores (Zod → 400, único → 409, FK → 409, check → 400)
  routes/
    proyectos.ts      CRUD de proyecto, dashboard, avance técnico
    ficha.ts          Ficha FR-019 (todas las secciones)
    seguimiento.ts    actividades/Gantt, presupuesto, antecedentes, auditoría, documentos, informes
```

## 3. Convenciones que ya sigue el código
1. **Toda escritura va dentro de `withTx(req, …)`**: abre transacción y fija `app.usuario`, que lee el trigger de auditoría. Si olvidas `withTx` en una escritura nueva, el cambio queda auditado como "sistema".
2. **Validación con Zod en el borde** (`schema.parse(req.body)`); el mensaje llega listo para mostrarlo bajo el campo.
3. **El cálculo vive en la BD** (vistas `v_presupuesto`, `v_kpis_proyecto`); el backend solo las lee.
4. Respuestas en `camelCase` donde se hizo `AS "camelCase"`; las vistas devuelven `snake_case`. Elige una convención y unifícala antes de conectar el frontend (recomendado: camelCase en todo).

## 4. Autenticación: no se crea
El módulo se integra a la plataforma. Elige una de estas opciones para producción:
- **Gateway/SSO** (recomendado): el proxy de la universidad valida la sesión e inyecta `X-Usuario-Institucional`. Configura el servidor para **rechazar** esa cabecera si llega desde fuera del gateway.
- **JWT institucional**: añade un middleware que verifique el token y llame a `req.headers['x-usuario-institucional'] = payload.email`.
Permisos por rol (admin, investigador…) son decisión de la plataforma; hoy no se aplican.

## 5. Endpoints
Ver el mapa por Frame en el `README.md` raíz. Todos cuelgan de `/api/proyectos/:codigo/…`.

## 6. Documentos (Frame 12): por implementar
Hoy `GET /documentos` lista; falta cargar archivos. Plan:
1. `npm i multer` y guardar en disco/S3/MinIO (no en la BD); calcula `sha256`.
2. `POST /proyectos/:codigo/documentos` (multipart): crea `documentos` si no existe y siempre una fila en `documento_versiones` con `version = max + 1`.
3. `GET /documentos/:id/versiones/:v/descarga`: valida pertenencia al proyecto y entrega el archivo.
4. Antecedentes **no** copian archivos: ya se resuelven por relación.

## 7. Informes PDF / Word (Frame 13): por implementar
`POST /informes` ya guarda una foto JSON con los datos vigentes al generar. Falta renderizarla:
- PDF: `pdfkit` o `puppeteer` (HTML → PDF, más fácil para igualar el diseño).
- Word: paquete `docx`.
- Añade `GET /informes/:id/pdf` y `/word` que lean `informes.datos` (así el informe es reproducible).
Informe diario/semanal/proyecto = misma foto, distinta plantilla y período.

## 7.1 "Actualizado hace X segundos"
Basta con `actualizado_en` del dashboard. Para refresco automático: polling cada 15–30 s al
endpoint de dashboard (simple) o SSE/WebSocket si lo necesitas en tiempo real.

## 8. Pruebas manuales rápidas
```bash
H='-H Content-Type:application/json -H X-Usuario-Institucional:tu.correo@universidad.edu.co'
curl -X POST localhost:4000/api/proyectos $H -d '{"codigo":"PRY-2026-010","nombre":"Prueba","lineaId":1,"estado":"Estructuración"}'
curl -X POST localhost:4000/api/proyectos/PRY-2026-001/avance $H -d '{"porcentaje":80,"descripcion":"ok"}'
curl localhost:4000/api/proyectos/PRY-2026-001/auditoria
```
Siguiente: pruebas automáticas con `vitest` + `supertest` contra una BD de pruebas.

## 9. Despliegue (checklist)
- [ ] Rol de BD sin SUPERUSER y contraseña fuerte · [ ] `CORS_ORIGIN` solo con el dominio real
- [ ] `npm run build && npm start` detrás de HTTPS · [ ] `helmet` y límite de peticiones (`express-rate-limit`)
- [ ] Logs estructurados (`pino`) · [ ] Respaldos y migraciones
