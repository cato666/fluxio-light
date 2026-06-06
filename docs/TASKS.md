# TASKS para Codex

## Fase 0 - Bootstrap

- [x] Instalar dependencias backend y frontend.
- [x] Crear `.env` desde `.env.example`.
- [x] Levantar PostgreSQL.
- [x] Ejecutar migracion Prisma.
- [x] Ejecutar seed.
- [x] Validar login demo.

## Fase 1 - Backend MVP

- [x] Revisar Prisma schema.
- [x] Completar guards JWT.
- [x] Completar CRUD base de contacts, leads, appointments, attendances, income, expenses.
- [x] Completar dashboard monthly summary.
- [x] Completar evidence upload y storage local.
- [x] Completar Kapso webhook sandbox.
- [x] Completar parser de comandos WhatsApp basicos.
- [x] Completar canal privado Fluxio Assistant para comandos del profesional.
- [x] Agregar confirmaciones y resolucion de clientes ambiguos en Fluxio Assistant.
- [x] Mejorar contexto de clientes ambiguos y agregar comando para actualizar telefono.
- [x] Agregar creacion y consulta de agenda por WhatsApp Assistant.
- [x] Agregar cotizaciones por WhatsApp Assistant con confirmacion antes de enviar.
- [x] Crear entidad y vista de cotizaciones conectada a leads, WhatsApp y atenciones.
- [x] Detectar respuestas de clientes a cotizaciones y marcar aceptadas/rechazadas.
- [x] Consultar cotizaciones desde WhatsApp Assistant.
- [x] Convertir cotizacion aceptada en atencion desde WhatsApp Assistant.
- [x] Dashboard comercial con metricas de cotizaciones.
- [x] Enviar cotizaciones desde leads.
- [x] Crear atenciones desde leads.
- [x] Configuracion del profesional desde frontend.
- [x] Plantillas de mensajes editables.
- [x] Comandos de pagos y pendientes de cobro por WhatsApp Assistant.
- [x] Onboarding de profesionales con pasos no tecnicos.
- [x] Registro de profesionales con aprobacion manual de cuenta.

## Fase 2 - Frontend MVP

- [x] Login.
- [x] Layout principal.
- [x] Dashboard.
- [x] Leads con edicion, cotizacion y crear atencion.
- [x] Cotizaciones con estados y conversion a atencion.
- [x] Cotizaciones PDF versionadas con descarga y envio a cliente/profesional.
- [x] Contactos con creacion y edicion web.
- [x] Detalle 360 del cliente con leads, cotizaciones, atenciones, finanzas, evidencias y WhatsApp.
- [x] Agenda.
- [x] Atenciones.
- [x] Ingresos editables.
- [x] Gastos editables.
- [x] Evidencias.
- [x] Conectar WhatsApp.
- [x] Conversaciones WhatsApp con respuesta manual.
- [x] Eventos/Auditoria de webhooks Kapso y anti-loop.
- [x] Vista Configuracion para profesional y plantillas.
- [x] Vista Primeros pasos para guiar uso del numero Fluxio/Kapso.

## Fase 3 - Kapso

- [ ] Configurar API key real.
- [x] Crear setup link sandbox.
- [x] Configurar webhook.
- [x] Probar evento `whatsapp.message.received`.
- [x] Probar envio de respuesta simulada.
- [x] Probar recepcion de imagen/documento.
- [x] Implementar documento outbound con trazabilidad.

## Fase 4 - Hardening

- [ ] Rate limiting.
- [ ] Validacion de firma webhook con contrato Kapso definitivo.
- [x] Auditoria de webhooks.
- [x] Anti-loop robusto para eventos salientes y respuestas generadas por Fluxio.
- [x] Docker Compose sin seed destructivo en cada reinicio.
- [x] Scripts de prueba para anti-loop y flujo WhatsApp Assistant.
- [ ] Manejo de errores usuario-final mas consistente.
- [ ] Admin MVP para aprobar cuentas desde interfaz interna.
- [ ] Logs estructurados.
- [ ] Tests basicos automatizados.
