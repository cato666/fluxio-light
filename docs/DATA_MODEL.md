# Modelo de datos

Entidades principales:

- User: usuario de login.
- Professional: perfil profesional independiente.
- Contact: cliente o potencial cliente.
- Lead: oportunidad comercial.
- Appointment: cita.
- Attendance: atencion realizada.
- IncomeRecord: ingreso, manual o vinculado a una atencion.
- Expense: gasto general o asociado a contacto, lead o atencion.
- Campaign: campana o fuente de captacion.
- WhatsAppConnection: numero conectado via Kapso.
- WhatsAppConversation: conversacion.
- WhatsAppMessage: mensaje.
- EvidenceFile: archivo o evidencia.
- AuditLog: trazabilidad.

Relaciones operativas clave:

- `Attendance` puede tener `IncomeRecord`, `EvidenceFile[]` y `Expense[]`.
- `Expense` puede apuntar opcionalmente a `attendanceId`, `contactId` y `leadId`.
- La utilidad estimada de una atencion se calcula como ingreso asociado menos gastos asociados.
