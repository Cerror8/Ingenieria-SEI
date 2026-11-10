# Recordatorios por WhatsApp (opcional)

SEI puede enviar los recordatorios diarios de tareas por correo y, si se configura, también por WhatsApp usando la API oficial de Meta (WhatsApp Business Cloud API). El canal es opcional: sin credenciales, todo sigue funcionando solo con correo.

## Requisitos

1. Una cuenta de WhatsApp Business (WABA) y un número dedicado aprobado en Meta.
2. Un token de acceso permanente de la app de Meta con permiso `whatsapp_business_messaging`.
3. Una **plantilla de utilidad** aprobada con dos variables en el cuerpo:
   - `{{1}}`: nombre del responsable.
   - `{{2}}`: resumen de tareas próximas a vencer.
4. El personal debe registrar su teléfono y activar el consentimiento en **Mi perfil → Teléfono para WhatsApp**. El envío solo se hace a teléfonos con consentimiento.

## Variables de entorno (backend y Vercel)

| Variable | Ejemplo | Uso |
|---|---|---|
| `WHATSAPP_TOKEN` | `EAA...` | Token permanente de Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | `123456789012345` | ID del número emisor (no el teléfono) |
| `WHATSAPP_TEMPLATE_RECORDATORIO` | `recordatorio_tareas` | Nombre exacto de la plantilla aprobada |
| `WHATSAPP_TEMPLATE_IDIOMA` | `es` | Código de idioma de la plantilla |
| `WHATSAPP_PAIS` | `57` | Prefijo que se agrega a números de 10 dígitos |
| `WHATSAPP_API_VERSION` | `v23.0` | Versión de Graph API |

Si faltan `WHATSAPP_TOKEN` o `WHATSAPP_PHONE_NUMBER_ID`, el canal queda desactivado y no se intenta ningún envío.

## Funcionamiento

- El cron diario `/api/cron/recordatorios` (12:00 UTC) calcula las tareas que vencen en los próximos 7 días o ya vencidas.
- Si el correo está configurado, envía el resumen por correo.
- Si WhatsApp está configurado, envía la plantilla a cada responsable que tenga teléfono y consentimiento.
- La respuesta del cron incluye `correosEnviados` y `whatsappEnviados`.
- Los errores de Meta se registran en los logs (`[whatsapp] ...`) sin exponer el token.

## Costos y límites

- Meta cobra por conversación/plantilla de utilidad según el país; revisa la tarifa vigente.
- Fuera de la ventana de 24 horas de servicio al cliente solo se pueden enviar **plantillas aprobadas**.
- Los recordatorios salen una vez al día; no hay envíos inmediatos por cambio de estado de tarea.
- Un teléfono mal registrado o sin consentimiento se omite, no bloquea al resto.

## Verificación local

Con las variables definidas en `backend/.env`, el cron se puede invocar con el secreto configurado:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:4000/api/cron/recordatorios
```

Sin WhatsApp configurado debe responder igual (solo correo) o `503` si tampoco hay SMTP. No se deben imprimir los valores del token en la consola.
