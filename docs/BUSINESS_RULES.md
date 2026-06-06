# Reglas de negocio

## Leads

- Todo telefono desconocido que escriba por WhatsApp se convierte en lead.
- Estado inicial: `NEW`.
- Si se agenda una cita: `SCHEDULED`.
- Si se crea una atencion desde el lead: `WON`.
- Un lead se cierra como `WON` o `LOST` con motivo obligatorio y fecha de cierre.
- Si el profesional marca como no interesado: `LOST`.

## Contactos

- Un contacto se identifica principalmente por telefono.
- Un contacto puede tener muchos leads, citas, atenciones, ingresos, gastos y evidencias.

## Atenciones

- Toda atencion puede generar ingreso.
- Toda atencion puede tener evidencias.
- Toda atencion puede tener gastos asociados.
- Una atencion tiene estado: `DRAFT`, `DONE`, `CANCELLED`.
- Una cita completada desde Agenda crea una sola atencion y su ingreso asociado; no puede convertirse dos veces.
- Reprogramar una cita conserva su identidad e historial. Una cita con atencion o evidencias se cancela, no se elimina.
- La utilidad estimada se calcula como `ingreso asociado - gastos asociados`.
- El detalle de atencion debe mostrar ingreso, gastos, utilidad, evidencias y cliente.

## Ingresos

- Estados de pago: `PAID`, `PENDING`, `PARTIAL`.
- Medio de pago: `CASH`, `TRANSFER`, `CARD`, `OTHER`.
- Si el ingreso esta vinculado a una atencion y se edita el monto, se sincroniza `Attendance.amount`.
- Editar monto, cliente o datos de pago desde la atencion sincroniza su `IncomeRecord`.
- Una atencion con gastos o evidencias no puede eliminarse; puede marcarse `CANCELLED`.

## Cotizaciones

- Una cotizacion en borrador, fallida o cancelada se puede eliminar.
- Una cotizacion enviada o convertida conserva trazabilidad y debe cancelarse en lugar de eliminarse.
- Una cotizacion convertida no se puede editar.

## Gastos

- Un gasto puede ser general o estar asociado a contacto, lead o atencion.
- Los gastos asociados a atencion se descuentan de la utilidad estimada de esa atencion.

## Evidencias

- Las evidencias pueden venir desde WhatsApp o desde la web.
- Categorias: `GENERAL`, `BEFORE`, `AFTER`, `PAYMENT_PROOF`, `PRESCRIPTION`, `DAMAGE`, `PART_INSTALLED`, `SPARE_PART`.
- Acceso privado por defecto.
- Desde el detalle de atencion se pueden subir evidencias vinculadas a esa atencion.

## Salud

- En MVP evitar guardar diagnosticos clinicos complejos.
- Incluir consentimiento y politica de privacidad antes de guardar documentos sensibles.
