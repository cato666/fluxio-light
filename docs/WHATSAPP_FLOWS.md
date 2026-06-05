# Flujos WhatsApp - Fluxio Light

## Menu principal

Usuario escribe:

```txt
menu
```

Respuesta:

```txt
Hola, que quieres hacer?

1. Registrar atencion
2. Ver agenda de hoy
3. Ver leads pendientes
4. Ver ingresos del mes
5. Registrar gasto
6. Ver pendientes de cobro
```

## Registro de atencion por comando

El comando debe enviarse al chat privado con Fluxio/Kapso, no al chat visible del cliente.

Comando:

```txt
Registrar atencion: Maria Perez, curacion simple, $25000, transferencia
```

Tambien se acepta con tilde y separador chileno de miles:

```txt
Registrar atención: Maria Perez, curación simple, $25.000, transferencia
```

Acciones:

- Buscar o crear contacto.
- Crear atencion.
- Crear ingreso.
- Marcar lead como atendido si existe.
- Puede existir sin cotizacion previa.

En modo Fluxio Assistant, si el remitente esta autorizado en `KAPSO_ASSISTANT_ALLOWED_PHONES`, el cliente se busca por `Maria Perez` o por el telefono indicado en el comando. El numero del profesional no se crea como cliente.

Si no hay cliente con ese nombre, Fluxio pide confirmacion antes de crearlo. Si hay varios clientes posibles, Fluxio responde con una lista numerada y espera la siguiente respuesta del profesional.

Si hay dos clientes con el mismo nombre, Fluxio muestra telefono, comuna y origen cuando existan:

```txt
1. Paola Morales | +56912345678 | comuna: Maipu | origen: WhatsApp
2. Paola Morales | sin telefono | origen: WhatsApp Assistant
```

Para evitar ambiguedad puedes usar el telefono directamente:

```txt
Registrar atencion: +56912345678, curacion simple, $25000, transferencia
```

## Actualizar telefono de cliente

Comando:

```txt
Agregar telefono a Paola Morales: +56912345678
```

Tambien se acepta:

```txt
Actualizar telefono a Paola Morales: +56912345678
```

Acciones:

- Buscar cliente por nombre.
- Si hay un solo match, actualizar telefono.
- Si hay varios matches, pedir seleccionar con lista numerada.
- Guardar telefono normalizado con prefijo `+`.

## Nuevo lead

Comando:

```txt
Nuevo lead: Carolina, cuidado adulto mayor, Instagram
```

Acciones:

- Crear contacto si no existe.
- Crear lead con origen.
- Estado: `NEW`.

## Cotizacion y conversion a atencion

Desde Fluxio Assistant:

```txt
Cotizar: Juan Soto, inyeccion a domicilio, $30000
```

Fluxio prepara la cotizacion y pide confirmacion antes de enviarla al cliente:

```txt
Cotizacion lista para Juan Soto:
inyeccion a domicilio
Valor: $30.000

Enviar al cliente?
Responde "si" para enviar o "no" para cancelar.
```

Al responder `si`, Fluxio envia la cotizacion al telefono del cliente, registra el mensaje saliente, crea/actualiza un lead como `CONTACTED` y guarda una `Quote` con estado `SENT`.

Al responder `no` o `cancelar`, la cotizacion queda como `CANCELLED`.

Si el cliente no tiene telefono, Fluxio responde que primero se debe completar:

```txt
Agregar telefono a Juan Soto: +56912345678
```

Flujo desde la interfaz web:

1. Mensaje WhatsApp entrante crea `Contact` y `Lead`.
2. En Leads, el profesional edita datos de contacto, descripcion y valor estimado.
3. El profesional envia cotizacion por WhatsApp o la genera desde Fluxio Assistant.
4. La cotizacion aparece en la vista `Cotizaciones`.
5. Si el cliente acepta, el profesional marca `Aceptada` y usa `Crear atencion`.
6. Fluxio crea `Attendance`, crea `IncomeRecord` asociado, marca la `Quote` como `CONVERTED` y marca el lead como `WON`.

Reglas iniciales:

- Si el lead tiene `estimatedValue`, se usa como monto sugerido.
- Una atencion puede existir sin cotizacion.
- Una cotizacion puede quedar en `DRAFT`, `PENDING_CONFIRMATION`, `SENT`, `ACCEPTED`, `REJECTED`, `CONVERTED`, `FAILED` o `CANCELLED`.
- Si el cliente responde al chat con frases como `acepto`, `confirmo`, `de acuerdo`, `dale` o `me sirve`, Fluxio marca la ultima cotizacion enviada como `ACCEPTED`.
- Si responde `no gracias`, `no acepto`, `no me sirve`, `muy caro` o `por ahora no`, Fluxio marca la ultima cotizacion enviada como `REJECTED`.
- Si el pago queda `PENDING`, el ingreso queda pendiente de cobro.
- Si el pago queda `PAID` o `PARTIAL`, el ingreso guarda fecha de pago inicial.

Consultar cotizaciones desde WhatsApp Assistant:

```txt
Cotizaciones pendientes
Cotizaciones aceptadas
Cotizaciones rechazadas
Cotizaciones de Juan Soto
```

Convertir la ultima cotizacion aceptada de un cliente en atencion:

```txt
Crear atencion desde cotizacion de Juan Soto
```

Acciones:

- Busca la ultima `Quote` aceptada del cliente.
- Crea `Attendance`.
- Crea `IncomeRecord` pendiente.
- Marca la cotizacion como `CONVERTED`.
- Marca el lead asociado como `WON` si existe.

Si no existe una cotizacion aceptada, Fluxio responde indicando que no encontro una cotizacion convertible.

## Agenda

Comando:

```txt
Agendar: Juan Soto, 2026-05-29 10:00, control presion, domicilio
```

Acciones:

- Buscar contacto por nombre o telefono.
- Si el contacto no existe, pedir confirmacion antes de crearlo.
- Si hay varios contactos posibles, pedir seleccion con lista numerada.
- Crear appointment.
- Estado: `SCHEDULED`.

Tambien se aceptan fechas relativas con hora:

```txt
Agendar: Juan Soto, manana 10:00, control presion, domicilio
Agendar: Juan Soto, hoy 16:30, curacion, domicilio
```

Consultar agenda:

```txt
Agenda hoy
Agenda manana
Que tengo hoy
Que tengo manana
```

Respuesta esperada:

```txt
Agenda hoy:

10:00 - Juan Soto - Control presion - domicilio
15:30 - Ana Perez - Curacion - Maipu
```

## Ingresos

Comando:

```txt
Cuanto llevo este mes?
```

Respuesta:

```txt
Este mes llevas $580.000, 23 atenciones, $45.000 pendientes de cobro y $82.000 en gastos.
```

Reglas web:

- Los ingresos pueden ser manuales o estar vinculados a una atencion.
- Si el ingreso esta vinculado a una atencion, la tabla muestra atencion y cliente.
- Al editar el monto de un ingreso vinculado, Fluxio actualiza tambien `Attendance.amount`.

## Evidencias

Cuando llega imagen/documento:

```txt
Recibi un archivo.
Quedo guardado como evidencia general.
```

Acciones:

- Crear `EvidenceFile`.
- Asociar a conversacion, contacto, lead y mensaje cuando sea posible.
- Permitir clasificacion posterior.

## Detalle 360 del cliente

La interfaz web permite abrir `Clientes > Ver detalle` para revisar toda la historia de un contacto en una sola ficha:

- resumen financiero: ingresos, pendientes, gastos y utilidad estimada;
- leads y cotizaciones con estado;
- atenciones realizadas y gastos asociados;
- agenda del cliente;
- evidencias;
- conversaciones WhatsApp y ultimos mensajes.
