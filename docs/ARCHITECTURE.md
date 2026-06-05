# Arquitectura - Fluxio Light

## Vista general

```txt
WhatsApp
  ↓
Kapso
  ↓ webhook HTTPS
Fluxio Light Backend
  ↓
PostgreSQL + Storage
  ↓
React Web Admin
```

## Backend

- NestJS modular.
- Prisma como ORM.
- PostgreSQL.
- JWT para login.
- Kapso como gateway WhatsApp.
- Storage local en MVP, con interfaz para S3/MinIO.

## Frontend

- React + Vite.
- Tailwind CSS.
- Panel de profesional independiente.
- Dashboard con métricas de negocio.
- Páginas CRUD simples.

## Módulos backend

- `auth`
- `professionals`
- `contacts`
- `leads`
- `appointments`
- `attendances`
- `income`
- `expenses`
- `evidence`
- `storage`
- `dashboard`
- `kapso`
- `whatsapp`
- `conversations`
- `messages`
- `reports`

## Multi-tenant simple

Cada registro se asocia a `professionalId`. En MVP se asume un usuario por profesional.
En fase futura se puede extender a equipos.
