# Prompt maestro para Codex - Fluxio Light

Necesito que trabajes sobre este proyecto separado llamado `fluxio-light`, sin modificar ningún repositorio de Fluxio principal.

Objetivo: construir un MVP funcional de Fluxio Light, un asistente por WhatsApp para profesionales independientes que permita registrar leads, clientes, agenda, atenciones, ingresos, gastos y evidencias, usando Kapso como gateway de WhatsApp.

Prioridades:
1. Hacer que backend compile.
2. Hacer que frontend compile.
3. Ejecutar migraciones Prisma.
4. Validar login demo.
5. Completar CRUDs faltantes.
6. Completar integración Kapso real reemplazando stubs.
7. Completar webhook de mensajes entrantes.
8. Guardar imágenes/documentos como evidencias.
9. Mejorar UI mobile-first.
10. Preparar despliegue en EasyPanel.

Restricciones:
- No tocar Fluxio actual.
- Mantener arquitectura modular.
- Usar PostgreSQL + Prisma.
- Usar variables de entorno.
- No hardcodear credenciales.
- Mantener `professionalId` en todos los datos operativos.
- Evitar guardar datos clínicos sensibles por defecto.

Primero revisa:
- `docs/SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/KAPSO_INTEGRATION.md`
- `docs/WHATSAPP_FLOWS.md`
- `docs/TASKS.md`
