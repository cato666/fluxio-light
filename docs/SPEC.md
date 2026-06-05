# SPEC - Fluxio Light

## Proposito

Fluxio Light es un asistente por WhatsApp para profesionales independientes. Permite ordenar leads, clientes, agenda, atenciones, ingresos, gastos, evidencias y seguimiento mensual sin depender de planillas o software complejo.

## Usuarios objetivo

- TENS independientes
- Enfermeros/as y cuidadores
- Mecanicos independientes
- Electricistas
- Gasfiters
- Tecnicos de climatizacion
- Maestros y servicios a domicilio
- Kinesiologos, entrenadores y profesionales similares

## Propuesta de valor

Trabaja desde WhatsApp. Fluxio ordena tus clientes, leads, agenda, atenciones, ingresos y evidencias automaticamente.

## Alcance funcional

### MVP

- Login web.
- Perfil profesional.
- Dashboard mensual.
- Gestion de clientes/contactos.
- Creacion y edicion web de clientes/contactos.
- Gestion de leads.
- Agenda.
- Atenciones.
- Ingresos.
- Gastos.
- Evidencias: imagenes, videos, audios y documentos.
- Conexion WhatsApp via Kapso.
- Webhook Kapso.
- Creacion automatica de leads desde mensajes WhatsApp.
- Comandos WhatsApp basicos.
- Edicion web de leads, ingresos y gastos.
- Respuesta manual desde conversaciones WhatsApp.
- Envio de cotizacion por WhatsApp desde leads.
- Conversion de lead en atencion con ingreso asociado.
- Detalle de atencion con gastos asociados y utilidad estimada.
- Evidencias asociadas y subidas desde detalle de atencion.
- Dashboard mensual con cobrados, pendientes, leads abiertos, margen y atenciones recientes.

### Fase 2

- Setup link Kapso por profesional.
- Deteccion de numero conectado.
- Flujos conversacionales con botones/listas.
- Reporte mensual PDF.
- Plantillas por rubro.
- Asociar gastos a leads o clientes desde vistas dedicadas.

### Fase 3

- Campanas simples.
- IA para interpretar mensajes libres.
- Exportacion Excel.
- Integracion con pagos.
- Upgrade hacia Fluxio Pro.

## Reglas clave

1. Si llega un mensaje de un telefono desconocido, crear lead.
2. Si el telefono existe como contacto, asociar conversacion al contacto.
3. Si el mensaje contiene una imagen/documento/audio/video, crear evidencia.
4. Si se crea una atencion desde lead, crear tambien ingreso asociado.
5. Si se edita el monto de un ingreso vinculado a una atencion, sincronizar el monto de la atencion.
6. No guardar datos clinicos sensibles por defecto. Usar notas simples y consentimiento si corresponde.
