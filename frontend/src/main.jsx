import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, Calendar, Camera, CheckCircle, Clipboard, DollarSign, FileText, Home, LogOut, MessageCircle, MoreHorizontal, Plus, Send, Settings, ShieldCheck, TrendingUp, Users, WalletCards, X } from 'lucide-react';
import './styles/index.css';

const API_URL = window.__FLUXIO_CONFIG__?.VITE_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const isFormData = options.body instanceof FormData;
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  }).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const STATUS_LABELS = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  SCHEDULED: 'Agendado',
  WON: 'Ganado',
  LOST: 'Perdido',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'No asistio',
  DRAFT: 'Borrador',
  DONE: 'Realizada',
  PAID: 'Pagado',
  PENDING: 'Pendiente',
  PARTIAL: 'Pago parcial',
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
  OTHER: 'Otro',
  PENDING_CONFIRMATION: 'Por confirmar',
  SENT: 'Enviada',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  CONVERTED: 'Convertida',
  FAILED: 'Fallida',
  ACTIVE: 'Activa',
  SUSPENDED: 'Suspendida',
  PENDING_APPROVAL: 'Pendiente de aprobacion',
  INBOUND: 'Entrante',
  OUTBOUND: 'Saliente'
};

function statusLabel(value) {
  return STATUS_LABELS[value] || String(value || '-').replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function isDemoRow(row) {
  if (!row) return false;
  const text = [
    row.source,
    row.title,
    row.description,
    row.caption,
    row.outboundSource,
    row.kapsoMessageId,
    row.contactName,
    row.contactPhone,
    row.phone,
    row.contact?.source,
    row.contact?.phone,
    row.contact?.notes,
    row.lead?.source,
    row.lead?.title,
    row.attendance?.title,
    row.attendance?.description,
    row.quote?.title,
    row.quote?.description,
    row.incomeRecord?.description
  ].filter(Boolean).join(' ').toLowerCase();
  return text.includes('fluxio demo') || text.includes('demo - curacion simple') || text.includes('cotizacion demo') || text.includes('ingreso demo') || text.includes('insumos demo') || text.includes('+56922222222') || text.includes('56922222222') || text.includes('admin_demo');
}

function filterDemoRows(rows, filter) {
  if (filter === 'demo') return rows.filter(isDemoRow);
  if (filter === 'real') return rows.filter((row) => !isDemoRow(row));
  return rows;
}

function DemoBadge({ row }) {
  if (!isDemoRow(row)) return null;
  return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Demo</span>;
}

function DemoFilter({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
      {[
        ['all', 'Todos'],
        ['real', 'Reales'],
        ['demo', 'Demo']
      ].map(([key, label]) => (
        <button
          key={key}
          className={`rounded-md px-3 py-2 ${value === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => onChange(key)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Login({ onLogin }) {
  const inviteToken = new URLSearchParams(window.location.search).get('invite') || '';
  const [mode, setMode] = useState(inviteToken ? 'register' : 'login');
  const [email, setEmail] = useState(inviteToken ? '' : 'admin@fluxiolight.local');
  const [password, setPassword] = useState(inviteToken ? '' : 'admin123');
  const [displayName, setDisplayName] = useState('');
  const [profession, setProfession] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      const text = err?.message || '';
      setError(text.includes('pendiente') ? 'Tu cuenta esta pendiente de aprobacion por Fluxio.' : 'No se pudo iniciar sesion');
    }
  }

  async function register(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      const data = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName, profession, phone, invitationToken: inviteToken || undefined })
      });
      setNotice(data.message || 'Cuenta creada. Fluxio revisara tu solicitud.');
      setMode('login');
      setPassword('');
    } catch (err) {
      const text = err?.message || '';
      setError(text.includes('existe') ? 'Ya existe una cuenta con ese email.' : 'No se pudo crear la cuenta.');
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-950 p-4">
      <form onSubmit={mode === 'login' ? submit : register} className="w-full max-w-md rounded-lg bg-white p-8 shadow-2xl">
        <div className="mb-6">
          <div className="text-sm font-semibold text-emerald-600">Fluxio Light</div>
          <h1 className="text-3xl font-bold text-slate-900">Asistente WhatsApp para independientes</h1>
          <p className="mt-2 text-slate-500">Ordena leads, atenciones, ingresos y evidencias.</p>
        </div>

        {inviteToken && (
          <div className="mb-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            Estas usando una invitacion de Fluxio. Completa tus datos para solicitar la habilitacion.
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
          <button type="button" className={`rounded-md px-3 py-2 ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`} onClick={() => setMode('login')}>
            Ingresar
          </button>
          <button type="button" className={`rounded-md px-3 py-2 ${mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`} onClick={() => setMode('register')}>
            Crear cuenta
          </button>
        </div>

        {mode === 'register' && (
          <>
            <label className="block text-sm font-medium text-slate-700">Nombre profesional</label>
            <input className="mt-1 mb-4 w-full rounded-lg border p-3" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />

            <label className="block text-sm font-medium text-slate-700">Profesion</label>
            <input className="mt-1 mb-4 w-full rounded-lg border p-3" value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="TENS, kinesionlogo, enfermera..." />

            <label className="block text-sm font-medium text-slate-700">WhatsApp de trabajo</label>
            <input className="mt-1 mb-4 w-full rounded-lg border p-3" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+569..." />
          </>
        )}

        <label className="block text-sm font-medium text-slate-700">Email</label>
        <input className="mt-1 mb-4 w-full rounded-lg border p-3" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className="block text-sm font-medium text-slate-700">Contrasena</label>
        <input className="mt-1 mb-4 w-full rounded-lg border p-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />

        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
        {mode === 'register' && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Tu cuenta quedara pendiente. Fluxio la revisara y habilitara manualmente antes del primer ingreso.
          </div>
        )}

        <button className="w-full rounded-lg bg-emerald-600 p-3 font-semibold text-white hover:bg-emerald-700">
          {mode === 'login' ? 'Ingresar' : 'Enviar solicitud'}
        </button>
      </form>
    </div>
  );
}

function Sidebar({ page, setPage, user }) {
  const [showMore, setShowMore] = useState(false);
  const primaryItems = [
    ['dashboard', Home, 'Dashboard'],
    ['contacts', Users, 'Clientes'],
    ['appointments', Calendar, 'Agenda'],
    ['attendances', WalletCards, 'Atenciones'],
    ['whatsapp', MessageCircle, 'WhatsApp']
  ];
  const secondaryItems = [
    ['onboarding', CheckCircle, 'Primeros pasos'],
    ['demo', Clipboard, 'Modo demo'],
    ['leads', TrendingUp, 'Leads'],
    ['quotes', FileText, 'Cotizaciones'],
    ['income', DollarSign, 'Ingresos'],
    ['expenses', WalletCards, 'Gastos'],
    ['evidence', Camera, 'Evidencias'],
    ['events', Activity, 'Eventos'],
    ['settings', Settings, 'Configuracion']
  ];

  if (user?.isPlatformAdmin) {
    secondaryItems.push(['admin', ShieldCheck, 'Admin plataforma']);
  }

  function navigate(key) {
    setPage(key);
    setShowMore(false);
  }

  return (
    <aside className="w-full border-b bg-white p-3 md:sticky md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between px-2 md:block">
        <div>
          <div className="text-xl font-bold text-slate-900">Fluxio Light</div>
          <div className="text-sm text-slate-500">Tu operacion diaria</div>
        </div>
        <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden" onClick={() => setShowMore((value) => !value)} title={showMore ? 'Cerrar menu' : 'Ver mas opciones'}>
          {showMore ? <X size={20} /> : <MoreHorizontal size={20} />}
        </button>
      </div>
      <nav className="mt-4 grid grid-cols-3 gap-1 md:grid-cols-1 md:gap-1">
        {primaryItems.map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => navigate(key)}
            className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-2 py-2 text-center text-xs font-medium md:flex-row md:gap-3 md:px-3 md:py-3 md:text-left md:text-sm ${
              page === key ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon size={18} />
            <span className="truncate">{label}</span>
          </button>
        ))}
        <button
          onClick={() => setShowMore((value) => !value)}
          className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-2 py-2 text-center text-xs font-medium md:flex-row md:gap-3 md:px-3 md:py-3 md:text-left md:text-sm ${
            secondaryItems.some(([key]) => key === page) ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <MoreHorizontal size={18} />
          <span>Mas</span>
        </button>
      </nav>
      {showMore && (
        <div className="mt-3 grid grid-cols-2 gap-1 border-t border-slate-100 pt-3 md:grid-cols-1">
          {secondaryItems.map(([key, Icon, label]) => (
            <button key={key} onClick={() => navigate(key)} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium ${page === key ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Icon size={18} />
              {label}
            </button>
          ))}
          <button
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.reload();
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <LogOut size={18} />
            Cerrar sesion
          </button>
        </div>
      )}
    </aside>
  );
}

function Card({ title, value, subtitle }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
      {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
    </div>
  );
}

function Dashboard({ setPage, onQuickAction }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api('/dashboard/summary').then(setSummary).catch(console.error);
  }, []);

  if (!summary) return <div>Cargando...</div>;

  const todayAppointments = summary.today?.appointments || [];
  const conversationsToReply = summary.today?.conversationsToReply || [];
  const pendingQuotes = summary.today?.pendingQuotes || [];

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Hoy</h1>
          <p className="mt-1 text-slate-500">Lo importante para avanzar tu jornada.</p>
        </div>
        <button className="inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700" onClick={() => onQuickAction('attendance')}>
          <Plus size={18} />
          Registrar atencion
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <button className="text-left" onClick={() => setPage('appointments')}><Card title="Atenciones de hoy" value={todayAppointments.length} subtitle={todayAppointments.length ? 'Ver agenda del dia' : 'Sin servicios agendados'} /></button>
        <button className="text-left" onClick={() => setPage('whatsapp')}><Card title="Por responder" value={conversationsToReply.length} subtitle="Conversaciones con ultimo mensaje entrante" /></button>
        <button className="text-left" onClick={() => setPage('quotes')}><Card title="Cotizaciones pendientes" value={pendingQuotes.length} subtitle="Borradores, por confirmar o enviadas" /></button>
        <button className="text-left" onClick={() => setPage('income')}><Card title="Pendiente de cobro" value={`$${summary.pendingPaymentTotal.toLocaleString('es-CL')}`} subtitle={`${summary.pendingPaymentCount} pagos pendientes`} /></button>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Agenda de hoy</h2>
            <button className="text-sm font-semibold text-emerald-700" onClick={() => setPage('appointments')}>Ver agenda</button>
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            {todayAppointments.map((item) => (
              <div key={item.id} className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-800">{item.title}</span>
                  <span className="text-xs font-semibold text-emerald-700">{new Date(item.startsAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="mt-1 text-slate-500">{item.contactName || item.contactPhone || 'Sin cliente'}{item.location ? ` - ${item.location}` : ''}</div>
              </div>
            ))}
            {todayAppointments.length === 0 && <div className="rounded-lg bg-slate-50 p-4 text-slate-500">No tienes servicios agendados para hoy.</div>}
          </div>
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Mensajes por responder</h2>
            <button className="text-sm font-semibold text-emerald-700" onClick={() => setPage('whatsapp')}>Ir a WhatsApp</button>
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            {conversationsToReply.map((item) => (
              <button key={item.id} className="rounded-lg bg-slate-50 p-3 text-left hover:bg-slate-100" onClick={() => setPage('whatsapp')}>
                <div className="font-semibold text-slate-800">{item.contactName || item.contactPhone}</div>
                <div className="mt-1 line-clamp-2 text-slate-500">{item.text || statusLabel(item.type)}</div>
              </button>
            ))}
            {conversationsToReply.length === 0 && (
              <div className="rounded-lg bg-emerald-50 p-4 text-emerald-800">
                No tienes conversaciones pendientes de respuesta.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Cotizaciones pendientes</h2>
            <button className="text-sm font-semibold text-emerald-700" onClick={() => setPage('quotes')}>Ver todas</button>
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            {pendingQuotes.map((row) => (
              <div key={row.id} className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-800">{row.contactName || row.contactPhone || 'Sin cliente'}</div>
                    <div className="mt-1 text-slate-500">{row.title}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-800">${Number(row.amount || 0).toLocaleString('es-CL')}</div>
                    <div className="text-xs text-slate-500">{statusLabel(row.status)}</div>
                  </div>
                </div>
              </div>
            ))}
            {pendingQuotes.length === 0 && <div className="rounded-lg bg-slate-50 p-4 text-slate-500">No tienes cotizaciones pendientes.</div>}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900">Resumen del mes</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card title="Ingresos" value={`$${summary.incomeTotal.toLocaleString('es-CL')}`} subtitle={`${summary.incomeCount} registros`} />
          <Card title="Gastos" value={`$${summary.expensesTotal.toLocaleString('es-CL')}`} subtitle={`${summary.expensesCount} registros`} />
          <Card title="Utilidad estimada" value={`$${summary.profitEstimate.toLocaleString('es-CL')}`} subtitle={`${summary.profitMarginPercent}% de margen`} />
          <Card title="Atenciones" value={summary.attendancesCount} subtitle={`${summary.openLeadsCount} oportunidades abiertas`} />
        </div>
      </div>
    </div>
  );
}

function DemoModePage({ setPage }) {
  const [demo, setDemo] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api('/professionals/demo-mode').then(setDemo).catch(console.error);
  }, []);

  function copyCommand(text) {
    navigator.clipboard?.writeText(text);
    setMessage(`Comando copiado: ${text}`);
  }

  if (!demo) return <div>Cargando modo demo...</div>;

  const contact = demo.demo?.contact;
  const quote = demo.demo?.quote;
  const attendance = demo.demo?.attendance;
  const appointment = demo.demo?.appointment;
  const conversation = demo.demo?.conversation;

  return (
    <div>
      <div className="rounded-lg bg-emerald-700 p-5 text-white shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-wide text-emerald-100">Modo demo</div>
        <h1 className="mt-1 text-3xl font-bold">Practica Fluxio con datos de ejemplo</h1>
        <p className="mt-2 max-w-3xl text-emerald-50">
          Estos datos estan marcados como Fluxio Demo. Puedes probar WhatsApp, cotizaciones, atenciones y cobros sin mezclarlos con clientes reales.
        </p>
      </div>

      {!demo.enabled && (
        <div className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          Tu demo aun no esta preparado. Pide al equipo Fluxio activar o restablecer el demo desde Admin plataforma.
        </div>
      )}

      {message && <div className="mt-4 rounded-lg bg-slate-900 p-3 text-sm text-white">{message}</div>}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Cliente demo" value={contact?.fullName || 'Sin demo'} subtitle={contact?.phone || 'Pendiente'} />
        <Card title="Cotizacion" value={quote ? `$${Number(quote.amount || 0).toLocaleString('es-CL')}` : '-'} subtitle={quote?.status || 'Sin cotizacion'} />
        <Card title="Atencion" value={attendance?.status || '-'} subtitle={attendance?.title || 'Sin atencion'} />
        <Card title="Chat demo" value={conversation?.messages?.length || 0} subtitle="mensajes base" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-xl font-semibold text-slate-900">Caso Ana Perez</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="font-semibold text-slate-900">{contact?.fullName || 'Ana Perez'}</div>
              <div className="text-slate-500">{contact?.phone || '+56922222222'} {contact?.commune ? `- ${contact.commune}` : ''}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="font-semibold text-slate-900">{quote?.title || 'Cotizacion demo'}</div>
              <div className="text-slate-500">{quote?.status || '-'} - ${Number(quote?.amount || 0).toLocaleString('es-CL')}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="font-semibold text-slate-900">{appointment?.title || 'Agenda demo'}</div>
              <div className="text-slate-500">{appointment?.startsAt ? formatDate(appointment.startsAt) : '-'}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="font-semibold text-slate-900">{attendance?.title || 'Atencion demo'}</div>
              <div className="text-slate-500">
                Ingreso ${Number(attendance?.incomeRecord?.amount || attendance?.amount || 0).toLocaleString('es-CL')} / Gastos ${Number((attendance?.expenses || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)).toLocaleString('es-CL')}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800" onClick={() => setPage('contacts')}>Ver clientes</button>
            <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setPage('quotes')}>Ver cotizaciones</button>
            <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setPage('attendances')}>Ver atenciones</button>
            <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setPage('whatsapp')}>Ver WhatsApp</button>
          </div>
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-xl font-semibold text-slate-900">Comandos para probar</h2>
          <p className="mt-1 text-sm text-slate-500">Envia estos mensajes desde tu WhatsApp autorizado al numero Fluxio: {demo.fluxioPhone}</p>
          <div className="mt-4 grid gap-2">
            {(demo.commands || []).map((command) => (
              <button key={command.text} className="rounded-lg bg-slate-50 p-3 text-left text-sm hover:bg-slate-100" onClick={() => copyCommand(command.text)}>
                <div className="font-semibold text-slate-900">{command.label}</div>
                <div className="mt-1 break-words text-slate-500">{command.text}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <h2 className="text-xl font-semibold text-slate-900">Conversacion demo</h2>
        <div className="mt-4 grid gap-2">
          {(conversation?.messages || []).map((row) => (
            <div key={row.id} className={`max-w-3xl rounded-lg p-3 text-sm ${row.direction === 'OUTBOUND' ? 'ml-auto bg-emerald-50 text-emerald-900' : 'bg-slate-50 text-slate-700'}`}>
              <div className="text-xs font-semibold">{row.direction === 'OUTBOUND' ? 'Fluxio' : contact?.fullName || 'Ana Perez'}</div>
              <div className="mt-1">{row.text || row.type}</div>
            </div>
          ))}
          {conversation?.messages?.length === 0 && <div className="text-sm text-slate-500">Sin mensajes demo.</div>}
        </div>
      </div>
    </div>
  );
}

function ListPage({ title, endpoint, fields }) {
  const [rows, setRows] = useState([]);
  const [demoFilter, setDemoFilter] = useState('all');
  useEffect(() => { api(endpoint).then(setRows).catch(console.error); }, [endpoint]);
  const visibleRows = filterDemoRows(rows, demoFilter);

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <DemoFilter value={demoFilter} onChange={setDemoFilter} />
      </div>
      <div className="mt-6 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr><th className="p-4">Tipo</th>{fields.map(f => <th key={f.key} className="p-4">{f.label}</th>)}</tr>
          </thead>
          <tbody>
            {visibleRows.map(row => (
              <tr key={row.id} className="border-t">
                <td className="p-4"><DemoBadge row={row} /></td>
                {fields.map(f => <td key={f.key} className="p-4">{String(f.render ? f.render(row) : f.key === 'status' ? statusLabel(row[f.key]) : row[f.key] ?? '-')}</td>)}
              </tr>
            ))}
            {visibleRows.length === 0 && <tr><td className="p-6 text-slate-500" colSpan={fields.length + 1}>Sin registros.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AppointmentsPage({ createRequest = 0 }) {
  const [rows, setRows] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ contactId: '', title: '', startsAt: '', endsAt: '', location: '', description: '' });

  async function load() {
    const [appointmentRows, contactRows] = await Promise.all([api('/appointments'), api('/contacts')]);
    setRows(appointmentRows);
    setContacts(contactRows);
  }

  useEffect(() => { load().catch(console.error); }, []);
  useEffect(() => { if (createRequest > 0) setCreating(true); }, [createRequest]);

  async function createAppointment(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined
        })
      });
      setForm({ contactId: '', title: '', startsAt: '', endsAt: '', location: '', description: '' });
      setCreating(false);
      await load();
      setMessage('Servicio agendado.');
    } catch (err) {
      setMessage('No se pudo agendar el servicio.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div><h1 className="text-3xl font-bold text-slate-900">Agenda</h1><p className="mt-1 text-slate-500">Servicios programados con fecha, cliente y lugar.</p></div>
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => setCreating(true)}>Agendar servicio</button>
      </div>
      {message && <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
      {creating && (
        <form className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100" onSubmit={createAppointment}>
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Nuevo servicio agendado</h2><button type="button" className="text-sm font-semibold text-slate-500" onClick={() => setCreating(false)}>Cancelar</button></div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">Cliente<select className="mt-1 w-full rounded-lg border p-3" value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}><option value="">Sin cliente asociado</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.fullName || contact.phone}</option>)}</select></label>
            <label className="text-sm font-medium">Servicio<input className="mt-1 w-full rounded-lg border p-3" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
            <label className="text-sm font-medium">Inicio<input type="datetime-local" className="mt-1 w-full rounded-lg border p-3" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} required /></label>
            <label className="text-sm font-medium">Termino<input type="datetime-local" className="mt-1 w-full rounded-lg border p-3" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></label>
            <label className="text-sm font-medium">Lugar<input className="mt-1 w-full rounded-lg border p-3" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
            <label className="text-sm font-medium md:col-span-2">Detalle<textarea className="mt-1 min-h-24 w-full rounded-lg border p-3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          </div>
          <button className="mt-4 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-400" disabled={saving}>{saving ? 'Agendando...' : 'Guardar en agenda'}</button>
        </form>
      )}
      <div className="mt-6 overflow-auto rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
        <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4">Fecha</th><th className="p-4">Servicio</th><th className="p-4">Lugar</th><th className="p-4">Estado</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td className="p-4">{formatDate(row.startsAt)}</td><td className="p-4 font-medium">{row.title}</td><td className="p-4">{row.location || '-'}</td><td className="p-4">{statusLabel(row.status)}</td></tr>)}{rows.length === 0 && <tr><td colSpan={4} className="p-6 text-slate-500">No tienes servicios agendados.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}

function LeadsPage({ createRequest = 0 }) {
  const [rows, setRows] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [demoFilter, setDemoFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ contactId: '', title: '', description: '', source: 'Manual', estimatedValue: '' });
  const [form, setForm] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [attendanceLead, setAttendanceLead] = useState(null);
  const [attendanceForm, setAttendanceForm] = useState({});
  const [creatingAttendance, setCreatingAttendance] = useState(false);

  async function load() {
    const [data, contactRows] = await Promise.all([api('/leads'), api('/contacts')]);
    setRows(data);
    setContacts(contactRows);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);
  useEffect(() => {
    if (createRequest > 0) setCreating(true);
  }, [createRequest]);
  const visibleRows = filterDemoRows(rows, demoFilter);

  async function createLead(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api('/leads', {
        method: 'POST',
        body: JSON.stringify({
          ...createForm,
          estimatedValue: createForm.estimatedValue === '' ? undefined : Number(createForm.estimatedValue)
        })
      });
      setCreateForm({ contactId: '', title: '', description: '', source: 'Manual', estimatedValue: '' });
      setCreating(false);
      await load();
      setMessage('Lead creado.');
    } catch (err) {
      setMessage('No se pudo crear el lead. Selecciona un cliente y revisa los datos.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row) {
    setMessage('');
    setEditing(row);
    setForm({
      title: row.title || '',
      description: row.description || '',
      status: row.status || 'NEW',
      estimatedValue: row.estimatedValue ?? '',
      contactName: row.contact?.fullName || '',
      contactPhone: row.contact?.phone || ''
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setMessage('');

    try {
      await api(`/leads/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          estimatedValue: form.estimatedValue === '' ? null : Number(form.estimatedValue)
        })
      });
      setEditing(null);
      await load();
      setMessage('Lead actualizado.');
    } catch (err) {
      setMessage('No se pudo guardar el lead.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function sendQuote(row) {
    setSendingId(row.id);
    setMessage('');

    try {
      const result = await api(`/leads/${row.id}/send-quote`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      setMessage(result.simulated ? 'Cotizacion simulada y guardada en WhatsApp.' : 'Cotizacion enviada por WhatsApp.');
    } catch (err) {
      setMessage('No se pudo enviar la cotizacion. Revisa telefono y conexion WhatsApp.');
      console.error(err);
    } finally {
      setSendingId(null);
    }
  }

  function startAttendance(row) {
    setMessage('');
    setAttendanceLead(row);
    setAttendanceForm({
      title: row.title || '',
      description: row.description || '',
      amount: row.estimatedValue ?? 0,
      paymentStatus: 'PENDING',
      paymentMethod: 'OTHER'
    });
  }

  async function createAttendance(e) {
    e.preventDefault();
    if (!attendanceLead) return;
    setCreatingAttendance(true);
    setMessage('');

    try {
      await api(`/leads/${attendanceLead.id}/create-attendance`, {
        method: 'POST',
        body: JSON.stringify({
          ...attendanceForm,
          amount: Number(attendanceForm.amount || 0)
        })
      });
      setAttendanceLead(null);
      await load();
      setMessage('Atencion creada desde el lead. Tambien se registro el ingreso asociado.');
    } catch (err) {
      setMessage('No se pudo crear la atencion desde el lead.');
      console.error(err);
    } finally {
      setCreatingAttendance(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Leads</h1>
          <p className="mt-1 text-slate-500">Edita datos de contacto y envia cotizaciones por WhatsApp.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DemoFilter value={demoFilter} onChange={setDemoFilter} />
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700" onClick={() => setCreating(true)}>
            Nuevo lead
          </button>
        </div>
      </div>

      {message && <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}

      {creating && (
        <form className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100" onSubmit={createLead}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Nuevo lead</h2>
            <button type="button" className="text-sm font-semibold text-slate-500" onClick={() => setCreating(false)}>Cancelar</button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Cliente
              <select className="mt-1 w-full rounded-lg border p-3" value={createForm.contactId} onChange={(e) => setCreateForm({ ...createForm, contactId: e.target.value })} required>
                <option value="">Seleccionar cliente</option>
                {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.fullName || contact.phone || 'Sin nombre'}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Servicio o necesidad
              <input className="mt-1 w-full rounded-lg border p-3" value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} required />
            </label>
            <label className="text-sm font-medium text-slate-700">Valor estimado
              <input type="number" min="0" className="mt-1 w-full rounded-lg border p-3" value={createForm.estimatedValue} onChange={(e) => setCreateForm({ ...createForm, estimatedValue: e.target.value })} />
            </label>
            <label className="text-sm font-medium text-slate-700">Origen
              <input className="mt-1 w-full rounded-lg border p-3" value={createForm.source} onChange={(e) => setCreateForm({ ...createForm, source: e.target.value })} />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">Detalle
              <textarea className="mt-1 min-h-24 w-full rounded-lg border p-3" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
            </label>
          </div>
          <button className="mt-4 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-400" disabled={saving}>{saving ? 'Guardando...' : 'Crear lead'}</button>
        </form>
      )}

      <div className="mt-6 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4">Titulo</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Contacto</th>
              <th className="p-4">Telefono</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Valor</th>
              <th className="p-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-4">{row.title}</td>
                <td className="p-4"><DemoBadge row={row} /></td>
                <td className="p-4">{row.contact?.fullName || '-'}</td>
                <td className="p-4">{row.contact?.phone || '-'}</td>
                <td className="p-4">{statusLabel(row.status)}</td>
                <td className="p-4">{row.estimatedValue ? `$${Number(row.estimatedValue).toLocaleString('es-CL')}` : '-'}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => startEdit(row)}>
                      Editar
                    </button>
                    <button
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                      onClick={() => sendQuote(row)}
                      disabled={sendingId === row.id || !row.contact?.phone}
                    >
                      {sendingId === row.id ? 'Enviando...' : 'Enviar cotizacion'}
                    </button>
                    <button
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                      onClick={() => startAttendance(row)}
                      disabled={!row.contactId || row.status === 'WON'}
                    >
                      Crear atencion
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && <tr><td className="p-6 text-slate-500" colSpan={7}>Sin registros.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Editar lead</h2>
            <button className="text-sm font-semibold text-slate-500 hover:text-slate-700" onClick={() => setEditing(null)}>Cancelar</button>
          </div>
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={saveEdit}>
            <label className="block text-sm font-medium text-slate-700">
              Titulo
              <input className="mt-1 w-full rounded-lg border p-3" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Estado
              <select className="mt-1 w-full rounded-lg border p-3" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['NEW', 'CONTACTED', 'SCHEDULED', 'WON', 'LOST'].map((option) => <option key={option} value={option}>{statusLabel(option)}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Nombre contacto
              <input className="mt-1 w-full rounded-lg border p-3" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Telefono
              <input className="mt-1 w-full rounded-lg border p-3" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Valor estimado
              <input className="mt-1 w-full rounded-lg border p-3" type="number" value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} />
            </label>
            <label className="block text-sm font-medium text-slate-700 md:col-span-2">
              Descripcion
              <textarea className="mt-1 min-h-28 w-full rounded-lg border p-3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <div className="md:col-span-2">
              <button className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

      {attendanceLead && (
        <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Crear atencion desde lead</h2>
            <button className="text-sm font-semibold text-slate-500 hover:text-slate-700" onClick={() => setAttendanceLead(null)}>Cancelar</button>
          </div>
          <div className="mt-1 text-sm text-slate-500">{attendanceLead.contact?.fullName || attendanceLead.contact?.phone || 'Sin contacto'}</div>
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={createAttendance}>
            <label className="block text-sm font-medium text-slate-700">
              Servicio
              <input className="mt-1 w-full rounded-lg border p-3" value={attendanceForm.title} onChange={(e) => setAttendanceForm({ ...attendanceForm, title: e.target.value })} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Monto
              <input className="mt-1 w-full rounded-lg border p-3" type="number" value={attendanceForm.amount} onChange={(e) => setAttendanceForm({ ...attendanceForm, amount: e.target.value })} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Estado de pago
              <select className="mt-1 w-full rounded-lg border p-3" value={attendanceForm.paymentStatus} onChange={(e) => setAttendanceForm({ ...attendanceForm, paymentStatus: e.target.value })}>
                {['PENDING', 'PAID', 'PARTIAL'].map((option) => <option key={option} value={option}>{statusLabel(option)}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Metodo de pago
              <select className="mt-1 w-full rounded-lg border p-3" value={attendanceForm.paymentMethod} onChange={(e) => setAttendanceForm({ ...attendanceForm, paymentMethod: e.target.value })}>
                {['OTHER', 'CASH', 'TRANSFER', 'CARD'].map((option) => <option key={option} value={option}>{statusLabel(option)}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700 md:col-span-2">
              Descripcion
              <textarea className="mt-1 min-h-28 w-full rounded-lg border p-3" value={attendanceForm.description} onChange={(e) => setAttendanceForm({ ...attendanceForm, description: e.target.value })} />
            </label>
            <div className="md:col-span-2">
              <button className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400" disabled={creatingAttendance}>
                {creatingAttendance ? 'Creando...' : 'Crear atencion e ingreso'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function EditableRecordsPage({ title, endpoint, fields, refreshKey = 0 }) {
  const [rows, setRows] = useState([]);
  const [demoFilter, setDemoFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await api(endpoint);
    setRows(data);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [endpoint, refreshKey]);
  const visibleRows = filterDemoRows(rows, demoFilter);

  function startEdit(row) {
    setMessage('');
    setEditing(row);
    const next = {};
    fields.forEach((field) => {
      if (field.editable) next[field.key] = row[field.key] ?? '';
    });
    setForm(next);
  }

  async function save(e) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setMessage('');

    try {
      const payload = {};
      fields.forEach((field) => {
        if (!field.editable) return;
        const value = form[field.key];
        payload[field.key] = field.type === 'number' ? Number(value || 0) : value;
      });

      await api(`${endpoint}/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setEditing(null);
      await load();
      setMessage(`${title} actualizado.`);
    } catch (err) {
      setMessage(`No se pudo guardar ${title.toLowerCase()}.`);
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <DemoFilter value={demoFilter} onChange={setDemoFilter} />
      </div>
      {message && <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
      <div className="mt-6 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4">Tipo</th>
              {fields.map((field) => <th key={field.key} className="p-4">{field.label}</th>)}
              <th className="p-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-4"><DemoBadge row={row} /></td>
                {fields.map((field) => (
                  <td key={field.key} className="p-4">{String(field.render ? field.render(row) : row[field.key] ?? '-')}</td>
                ))}
                <td className="p-4">
                  <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => startEdit(row)}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && <tr><td className="p-6 text-slate-500" colSpan={fields.length + 2}>Sin registros.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Editar {title.toLowerCase()}</h2>
            <button className="text-sm font-semibold text-slate-500 hover:text-slate-700" onClick={() => setEditing(null)}>Cancelar</button>
          </div>
          {editing.attendanceId && (
            <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Este ingreso esta vinculado a una atencion. Si cambias el monto, tambien se actualizara el monto de la atencion.
            </div>
          )}
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={save}>
            {fields.filter((field) => field.editable).map((field) => (
              <label key={field.key} className="block text-sm font-medium text-slate-700">
                {field.label}
                {field.options ? (
                  <select className="mt-1 w-full rounded-lg border p-3" value={form[field.key]} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}>
                    {field.options.map((option) => <option key={option} value={option}>{statusLabel(option)}</option>)}
                  </select>
                ) : (
                  <input
                    className="mt-1 w-full rounded-lg border p-3"
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={form[field.key]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  />
                )}
              </label>
            ))}
            <div className="md:col-span-2">
              <button className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ExpensesPage({ createRequest = 0 }) {
  const fields = [
    { key: 'description', label: 'Descripcion', editable: true },
    { key: 'category', label: 'Categoria', editable: true },
    { key: 'amount', label: 'Monto', type: 'number', editable: true, render: (row) => `$${Number(row.amount || 0).toLocaleString('es-CL')}` },
    { key: 'spentAt', label: 'Fecha', render: (row) => formatDate(row.spentAt || row.createdAt) }
  ];
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ description: '', amount: '', category: 'Insumos' });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { if (createRequest > 0) setCreating(true); }, [createRequest]);

  async function createExpense(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api('/expenses', { method: 'POST', body: JSON.stringify({ ...form, amount: Number(form.amount || 0) }) });
      setForm({ description: '', amount: '', category: 'Insumos' });
      setCreating(false);
      setMessage('Gasto registrado.');
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setMessage('No se pudo registrar el gasto.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gastos</h1>
          <p className="mt-1 text-slate-500">Registra y edita gastos operativos del profesional.</p>
        </div>
        <button className="w-fit rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => setCreating(true)}>Nuevo gasto</button>
      </div>
      {message && <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
      {creating && (
        <form className="mt-4 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100" onSubmit={createExpense}>
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Registrar gasto</h2><button type="button" className="text-sm font-semibold text-slate-500" onClick={() => setCreating(false)}>Cancelar</button></div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium">Descripcion<input className="mt-1 w-full rounded-lg border p-3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></label>
            <label className="text-sm font-medium">Monto<input type="number" min="0" className="mt-1 w-full rounded-lg border p-3" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></label>
            <label className="text-sm font-medium">Categoria<input className="mt-1 w-full rounded-lg border p-3" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
          </div>
          <button className="mt-4 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-400" disabled={saving}>{saving ? 'Guardando...' : 'Registrar gasto'}</button>
        </form>
      )}
      <EditableRecordsPage title="Historial de gastos" endpoint="/expenses" fields={fields} refreshKey={refreshKey} />
    </div>
  );
}

function AttendancesPage({ createRequest = 0 }) {
  const [rows, setRows] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [demoFilter, setDemoFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ contactId: '', title: '', description: '', amount: '', paymentStatus: 'PAID', paymentMethod: 'TRANSFER' });
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', category: 'Insumos' });
  const [evidenceForm, setEvidenceForm] = useState({ file: null, category: 'GENERAL', caption: '' });
  const [message, setMessage] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  async function load() {
    const [data, contactRows] = await Promise.all([api('/attendances'), api('/contacts')]);
    setRows(data);
    setContacts(contactRows);
  }

  async function openDetail(id) {
    setMessage('');
    const data = await api(`/attendances/${id}`);
    setSelected(data);
    setExpenseForm({ description: '', amount: '', category: 'Insumos' });
    setEvidenceForm({ file: null, category: 'GENERAL', caption: '' });
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);
  useEffect(() => { if (createRequest > 0) setCreating(true); }, [createRequest]);
  const visibleRows = filterDemoRows(rows, demoFilter);

  async function createAttendanceDirect(e) {
    e.preventDefault();
    setMessage('');
    setSavingExpense(true);
    try {
      await api('/attendances', {
        method: 'POST',
        body: JSON.stringify({ ...createForm, amount: Number(createForm.amount || 0), contactId: createForm.contactId || undefined })
      });
      setCreateForm({ contactId: '', title: '', description: '', amount: '', paymentStatus: 'PAID', paymentMethod: 'TRANSFER' });
      setCreating(false);
      await load();
      setMessage('Atencion e ingreso registrados.');
    } catch (err) {
      setMessage('No se pudo registrar la atencion.');
      console.error(err);
    } finally {
      setSavingExpense(false);
    }
  }

  async function addExpense(e) {
    e.preventDefault();
    if (!selected) return;
    setSavingExpense(true);
    setMessage('');

    try {
      const result = await api(`/attendances/${selected.id}/expenses`, {
        method: 'POST',
        body: JSON.stringify({
          description: expenseForm.description,
          amount: Number(expenseForm.amount || 0),
          category: expenseForm.category
        })
      });
      setSelected(result.attendance);
      await load();
      setExpenseForm({ description: '', amount: '', category: 'Insumos' });
      setMessage('Gasto asociado a la atencion.');
    } catch (err) {
      setMessage('No se pudo registrar el gasto.');
      console.error(err);
    } finally {
      setSavingExpense(false);
    }
  }

  async function uploadEvidence(e) {
    e.preventDefault();
    if (!selected || !evidenceForm.file) return;
    setUploadingEvidence(true);
    setMessage('');

    try {
      const body = new FormData();
      body.append('file', evidenceForm.file);
      body.append('attendanceId', selected.id);
      if (selected.contactId) body.append('contactId', selected.contactId);
      body.append('category', evidenceForm.category);
      if (evidenceForm.caption) body.append('caption', evidenceForm.caption);

      await api('/evidence/upload', {
        method: 'POST',
        body
      });
      await openDetail(selected.id);
      setMessage('Evidencia asociada a la atencion.');
    } catch (err) {
      setMessage('No se pudo subir la evidencia.');
      console.error(err);
    } finally {
      setUploadingEvidence(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Atenciones</h1>
          <p className="mt-1 text-slate-500">Revisa clientes, ingresos, gastos asociados y utilidad estimada.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DemoFilter value={demoFilter} onChange={setDemoFilter} />
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => setCreating(true)}>Registrar atencion</button>
        </div>
      </div>

      {message && <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}

      {creating && (
        <form className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100" onSubmit={createAttendanceDirect}>
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Registrar atencion</h2><button type="button" className="text-sm font-semibold text-slate-500" onClick={() => setCreating(false)}>Cancelar</button></div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">Cliente<select className="mt-1 w-full rounded-lg border p-3" value={createForm.contactId} onChange={(e) => setCreateForm({ ...createForm, contactId: e.target.value })}><option value="">Sin cliente asociado</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.fullName || contact.phone}</option>)}</select></label>
            <label className="text-sm font-medium">Servicio<input className="mt-1 w-full rounded-lg border p-3" value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} required /></label>
            <label className="text-sm font-medium">Monto<input type="number" min="0" className="mt-1 w-full rounded-lg border p-3" value={createForm.amount} onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })} required /></label>
            <label className="text-sm font-medium">Estado de pago<select className="mt-1 w-full rounded-lg border p-3" value={createForm.paymentStatus} onChange={(e) => setCreateForm({ ...createForm, paymentStatus: e.target.value })}>{['PAID', 'PENDING', 'PARTIAL'].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
            <label className="text-sm font-medium">Metodo de pago<select className="mt-1 w-full rounded-lg border p-3" value={createForm.paymentMethod} onChange={(e) => setCreateForm({ ...createForm, paymentMethod: e.target.value })}>{['TRANSFER', 'CASH', 'CARD', 'OTHER'].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
            <label className="text-sm font-medium md:col-span-2">Diagnostico o detalle<textarea className="mt-1 min-h-24 w-full rounded-lg border p-3" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} /></label>
          </div>
          <button className="mt-4 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-400" disabled={savingExpense}>{savingExpense ? 'Registrando...' : 'Registrar atencion e ingreso'}</button>
        </form>
      )}

      <div className="mt-6 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4">Servicio</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Cliente</th>
              <th className="p-4">Telefono</th>
              <th className="p-4">Monto</th>
              <th className="p-4">Gastos</th>
              <th className="p-4">Fecha</th>
              <th className="p-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const expensesTotal = (row.expenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
              return (
                <tr key={row.id} className="border-t">
                  <td className="p-4">{row.title}</td>
                  <td className="p-4"><DemoBadge row={row} /></td>
                  <td className="p-4">{row.contact?.fullName || row.contact?.phone || '-'}</td>
                  <td className="p-4">{row.contact?.phone || '-'}</td>
                  <td className="p-4">${Number(row.amount || 0).toLocaleString('es-CL')}</td>
                  <td className="p-4">${expensesTotal.toLocaleString('es-CL')}</td>
                  <td className="p-4">{formatDate(row.performedAt)}</td>
                  <td className="p-4">
                    <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => openDetail(row.id)}>
                      Ver detalle
                    </button>
                  </td>
                </tr>
              );
            })}
            {visibleRows.length === 0 && <tr><td className="p-6 text-slate-500" colSpan={8}>Sin registros.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{selected.title}</h2>
                <div className="mt-1 text-sm text-slate-500">{selected.contact?.fullName || 'Sin cliente'} - {selected.contact?.phone || 'Sin telefono'}</div>
              </div>
              <button className="text-sm font-semibold text-slate-500 hover:text-slate-700" onClick={() => setSelected(null)}>Cerrar</button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Card title="Ingreso" value={`$${Number(selected.incomeRecord?.amount ?? selected.amount ?? 0).toLocaleString('es-CL')}`} subtitle={selected.incomeRecord?.paymentStatus || selected.status} />
              <Card title="Gastos" value={`$${Number(selected.expensesTotal || 0).toLocaleString('es-CL')}`} subtitle={`${selected.expenses?.length || 0} registros`} />
              <Card title="Utilidad" value={`$${Number(selected.profitEstimate || 0).toLocaleString('es-CL')}`} />
            </div>

            <div className="mt-5 rounded-lg bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Descripcion</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{selected.description || '-'}</div>
            </div>

            <div className="mt-5">
              <div className="text-sm font-semibold text-slate-900">Evidencias</div>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                {(selected.evidenceFiles || []).map((file) => (
                  <div key={file.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    {file.type === 'IMAGE' && file.publicUrl ? (
                      <img className="mb-2 aspect-video w-full rounded-lg object-cover" src={file.publicUrl} alt={file.originalFileName || file.category} />
                    ) : null}
                    <a className="font-medium text-emerald-700 underline" href={file.publicUrl} target="_blank">
                      {file.originalFileName || file.type}
                    </a>
                    <div className="mt-1 text-xs text-slate-500">{file.category} - {file.caption || 'Sin nota'}</div>
                  </div>
                ))}
                {selected.evidenceFiles?.length === 0 && <div className="text-sm text-slate-500">Sin evidencias asociadas.</div>}
              </div>

              <form className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4" onSubmit={uploadEvidence}>
                <div className="text-sm font-semibold text-slate-900">Agregar evidencia</div>
                <input
                  className="rounded-lg border bg-white p-3 text-sm"
                  type="file"
                  onChange={(e) => setEvidenceForm({ ...evidenceForm, file: e.target.files?.[0] || null })}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Categoria
                    <select className="mt-1 w-full rounded-lg border bg-white p-3" value={evidenceForm.category} onChange={(e) => setEvidenceForm({ ...evidenceForm, category: e.target.value })}>
                      <option value="GENERAL">GENERAL</option>
                      <option value="BEFORE">BEFORE</option>
                      <option value="AFTER">AFTER</option>
                      <option value="PAYMENT_PROOF">PAYMENT_PROOF</option>
                      <option value="DAMAGE">DAMAGE</option>
                      <option value="SPARE_PART">SPARE_PART</option>
                      <option value="PRESCRIPTION">PRESCRIPTION</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Nota
                    <input className="mt-1 w-full rounded-lg border bg-white p-3" value={evidenceForm.caption} onChange={(e) => setEvidenceForm({ ...evidenceForm, caption: e.target.value })} />
                  </label>
                </div>
                <button className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400" disabled={uploadingEvidence || !evidenceForm.file}>
                  {uploadingEvidence ? 'Subiendo...' : 'Subir evidencia'}
                </button>
              </form>
            </div>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Gastos de esta atencion</h2>
            <div className="mt-4 space-y-3">
              {(selected.expenses || []).map((expense) => (
                <div key={expense.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{expense.description}</div>
                      <div className="text-xs text-slate-500">{expense.category || 'Sin categoria'} - {formatDate(expense.spentAt)}</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">${Number(expense.amount || 0).toLocaleString('es-CL')}</div>
                  </div>
                </div>
              ))}
              {selected.expenses?.length === 0 && <div className="text-sm text-slate-500">Sin gastos asociados.</div>}
            </div>

            <form className="mt-5 grid gap-3" onSubmit={addExpense}>
              <label className="block text-sm font-medium text-slate-700">
                Descripcion
                <input className="mt-1 w-full rounded-lg border p-3" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Categoria
                <input className="mt-1 w-full rounded-lg border p-3" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Monto
                <input className="mt-1 w-full rounded-lg border p-3" type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
              </label>
              <button className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400" disabled={savingExpense || !expenseForm.description || !expenseForm.amount}>
                {savingExpense ? 'Guardando...' : 'Agregar gasto'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactsPage({ createRequest = 0 }) {
  const [rows, setRows] = useState([]);
  const [demoFilter, setDemoFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function load() {
    const data = await api('/contacts');
    setRows(data);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  useEffect(() => {
    if (createRequest > 0) startCreate();
  }, [createRequest]);
  const visibleRows = filterDemoRows(rows, demoFilter);

  function emptyForm() {
    return {
      fullName: '',
      phone: '',
      email: '',
      commune: '',
      address: '',
      source: 'Manual',
      notes: ''
    };
  }

  function startCreate() {
    setMessage('');
    setEditing({ id: null });
    setForm(emptyForm());
  }

  function startEdit(row) {
    setMessage('');
    setEditing(row);
    setForm({
      fullName: row.fullName || '',
      phone: row.phone || '',
      email: row.email || '',
      commune: row.commune || '',
      address: row.address || '',
      source: row.source || '',
      notes: row.notes || ''
    });
  }

  async function openDetail(row) {
    setMessage('');
    setLoadingDetail(true);

    try {
      const data = await api(`/contacts/${row.id}/360`);
      setDetail(data);
    } catch (err) {
      setMessage('No se pudo cargar el detalle del cliente.');
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      if (editing?.id) {
        await api(`/contacts/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form)
        });
        setMessage('Cliente actualizado.');
      } else {
        await api('/contacts', {
          method: 'POST',
          body: JSON.stringify(form)
        });
        setMessage('Cliente creado.');
      }
      setEditing(null);
      await load();
    } catch (err) {
      setMessage('No se pudo guardar el cliente.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Clientes</h1>
          <p className="mt-1 text-slate-500">Crea y edita contactos para leads, atenciones e ingresos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DemoFilter value={demoFilter} onChange={setDemoFilter} />
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700" onClick={startCreate}>
            Nuevo cliente
          </button>
        </div>
      </div>

      {message && <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}

      <div className="mt-6 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4">Nombre</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Telefono</th>
              <th className="p-4">Email</th>
              <th className="p-4">Comuna</th>
              <th className="p-4">Origen</th>
              <th className="p-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-4">{row.fullName || '-'}</td>
                <td className="p-4"><DemoBadge row={row} /></td>
                <td className="p-4">{row.phone || '-'}</td>
                <td className="p-4">{row.email || '-'}</td>
                <td className="p-4">{row.commune || '-'}</td>
                <td className="p-4">{row.source || '-'}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => openDetail(row)}>
                      Ver detalle
                    </button>
                    <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => startEdit(row)}>
                      Editar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && <tr><td className="p-6 text-slate-500" colSpan={7}>Sin registros.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">{editing.id ? 'Editar cliente' : 'Nuevo cliente'}</h2>
            <button className="text-sm font-semibold text-slate-500 hover:text-slate-700" onClick={() => setEditing(null)}>Cancelar</button>
          </div>
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={save}>
            <label className="block text-sm font-medium text-slate-700">
              Nombre
              <input className="mt-1 w-full rounded-lg border p-3" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Telefono
              <input className="mt-1 w-full rounded-lg border p-3" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input className="mt-1 w-full rounded-lg border p-3" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Comuna
              <input className="mt-1 w-full rounded-lg border p-3" value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Direccion
              <input className="mt-1 w-full rounded-lg border p-3" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Origen
              <input className="mt-1 w-full rounded-lg border p-3" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            </label>
            <label className="block text-sm font-medium text-slate-700 md:col-span-2">
              Notas
              <textarea className="mt-1 min-h-28 w-full rounded-lg border p-3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <div className="md:col-span-2">
              <button className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cliente'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loadingDetail && <div className="mt-6 text-sm text-slate-500">Cargando detalle del cliente...</div>}

      {detail && (
        <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
          {isDemoRow(detail) && (
            <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
              Este cliente pertenece al modo demo. Puedes editarlo o probar flujos sin afectar clientes reales.
            </div>
          )}
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-900">{detail.fullName || detail.phone || 'Cliente sin nombre'}</h2>
                <DemoBadge row={detail} />
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {[detail.phone, detail.email, detail.commune, detail.source].filter(Boolean).join(' - ') || 'Sin datos de contacto'}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => startEdit(detail)}>
                Editar cliente
              </button>
              <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setDetail(null)}>
                Cerrar
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card title="Atenciones" value={detail.summary?.attendancesCount || 0} />
            <Card title="Cotizaciones" value={detail.summary?.quotesCount || 0} subtitle={`${detail.summary?.acceptedQuotesCount || 0} aceptadas`} />
            <Card title="Ingresos" value={`$${Number(detail.summary?.incomeTotal || 0).toLocaleString('es-CL')}`} subtitle={`Pendiente $${Number(detail.summary?.pendingIncomeTotal || 0).toLocaleString('es-CL')}`} />
            <Card title="Utilidad" value={`$${Number(detail.summary?.profitEstimate || 0).toLocaleString('es-CL')}`} subtitle={`Gastos $${Number(detail.summary?.expensesTotal || 0).toLocaleString('es-CL')}`} />
          </div>

          {detail.notes && (
            <div className="mt-5 rounded-lg bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Notas</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{detail.notes}</div>
            </div>
          )}

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <DetailSection title="Leads">
              {(detail.leads || []).map((lead) => (
                <CompactRow key={lead.id} title={lead.title} meta={`${lead.status} - ${lead.source || 'Sin origen'}`} amount={lead.estimatedValue} />
              ))}
              {detail.leads?.length === 0 && <EmptyDetail text="Sin leads." />}
            </DetailSection>

            <DetailSection title="Cotizaciones">
              {(detail.quotes || []).map((quote) => (
                <CompactRow key={quote.id} title={quote.title} meta={`${quote.status} - ${formatDate(quote.sentAt || quote.createdAt)}`} amount={quote.amount} />
              ))}
              {detail.quotes?.length === 0 && <EmptyDetail text="Sin cotizaciones." />}
            </DetailSection>

            <DetailSection title="Atenciones">
              {(detail.attendances || []).map((attendance) => {
                const expensesTotal = (attendance.expenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
                return (
                  <CompactRow
                    key={attendance.id}
                    title={attendance.title}
                    meta={`${formatDate(attendance.performedAt)} - gastos $${expensesTotal.toLocaleString('es-CL')}`}
                    amount={attendance.amount}
                  />
                );
              })}
              {detail.attendances?.length === 0 && <EmptyDetail text="Sin atenciones." />}
            </DetailSection>

            <DetailSection title="Agenda">
              {(detail.appointments || []).map((appointment) => (
                <CompactRow key={appointment.id} title={appointment.title} meta={`${appointment.status} - ${formatDate(appointment.startsAt)}${appointment.location ? ` - ${appointment.location}` : ''}`} />
              ))}
              {detail.appointments?.length === 0 && <EmptyDetail text="Sin citas." />}
            </DetailSection>

            <DetailSection title="Ingresos">
              {(detail.incomeRecords || []).map((income) => (
                <CompactRow key={income.id} title={income.description} meta={`${income.paymentStatus} - ${income.paymentMethod} - ${formatDate(income.paidAt || income.createdAt)}`} amount={income.amount} />
              ))}
              {detail.incomeRecords?.length === 0 && <EmptyDetail text="Sin ingresos." />}
            </DetailSection>

            <DetailSection title="Gastos">
              {(detail.expenses || []).map((expense) => (
                <CompactRow key={expense.id} title={expense.description} meta={`${expense.category || 'Sin categoria'} - ${formatDate(expense.spentAt || expense.createdAt)}`} amount={expense.amount} />
              ))}
              {detail.expenses?.length === 0 && <EmptyDetail text="Sin gastos." />}
            </DetailSection>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <DetailSection title="Evidencias">
              <div className="grid gap-3 md:grid-cols-2">
                {(detail.evidenceFiles || []).slice(0, 8).map((file) => (
                  <div key={file.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                    {file.type === 'IMAGE' && file.publicUrl ? (
                      <img className="mb-2 aspect-video w-full rounded-lg object-cover" src={file.publicUrl} alt={file.originalFileName || file.category} />
                    ) : null}
                    {file.publicUrl ? (
                      <a className="font-medium text-emerald-700 underline" href={file.publicUrl} target="_blank">
                        {file.originalFileName || file.type}
                      </a>
                    ) : (
                      <div className="font-medium text-slate-800">{file.originalFileName || file.type}</div>
                    )}
                    <div className="mt-1 text-xs text-slate-500">{file.category} - {formatDate(file.createdAt)}</div>
                  </div>
                ))}
              </div>
              {detail.evidenceFiles?.length === 0 && <EmptyDetail text="Sin evidencias." />}
            </DetailSection>

            <DetailSection title="WhatsApp">
              {(detail.conversations || []).map((conversation) => (
                <div key={conversation.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{conversation.contactName || conversation.contactPhone}</div>
                      <div className="mt-1 text-xs text-slate-500">{formatDate(conversation.lastMessageAt || conversation.updatedAt)}</div>
                    </div>
                    <div className="text-xs text-slate-400">{conversation.messages?.length || 0} mensajes</div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(conversation.messages || []).slice(0, 4).map((message) => (
                      <div key={message.id} className="rounded-lg bg-slate-50 p-2 text-sm">
                        <div className="text-xs font-semibold text-slate-500">{message.direction}</div>
                        <div className="mt-1 whitespace-pre-wrap text-slate-700">{message.text || message.type}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {detail.conversations?.length === 0 && <EmptyDetail text="Sin conversaciones WhatsApp asociadas." />}
            </DetailSection>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-100 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function CompactRow({ title, meta, amount }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">{title || '-'}</div>
        {meta && <div className="mt-1 text-xs text-slate-500">{meta}</div>}
      </div>
      {amount !== undefined && amount !== null && (
        <div className="shrink-0 text-sm font-semibold text-slate-900">${Number(amount || 0).toLocaleString('es-CL')}</div>
      )}
    </div>
  );
}

function EmptyDetail({ text }) {
  return <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">{text}</div>;
}

function EvidencePage() {
  const [rows, setRows] = useState([]);
  const [demoFilter, setDemoFilter] = useState('all');

  useEffect(() => {
    api('/evidence').then(setRows).catch(console.error);
  }, []);
  const visibleRows = filterDemoRows(rows, demoFilter);

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Evidencias</h1>
        <DemoFilter value={demoFilter} onChange={setDemoFilter} />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleRows.map((row) => (
          <div key={row.id} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="aspect-video overflow-hidden rounded-lg bg-slate-100">
              {row.type === 'IMAGE' && row.publicUrl ? (
                <img className="h-full w-full object-cover" src={row.publicUrl} alt={row.originalFileName || row.category} />
              ) : row.publicUrl ? (
                <a className="grid h-full place-items-center px-4 text-center text-sm font-medium text-emerald-700 underline" href={row.publicUrl} target="_blank">
                  Abrir archivo
                </a>
              ) : (
                <div className="grid h-full place-items-center text-sm text-slate-500">Sin vista previa</div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">{row.originalFileName || row.type}</div>
              <div className="flex items-center gap-2">
                <DemoBadge row={row} />
                <div className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{row.category}</div>
              </div>
            </div>
            {row.caption && <div className="mt-2 text-sm text-slate-500">{row.caption}</div>}
            <div className="mt-2 text-xs text-slate-400">{row.source} - {row.mimeType || row.storageProvider}</div>
          </div>
        ))}
        {visibleRows.length === 0 && <div className="text-slate-500">Sin evidencias.</div>}
      </div>
    </div>
  );
}

function QuotesPage({ createRequest = 0 }) {
  const [rows, setRows] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [demoFilter, setDemoFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [workingId, setWorkingId] = useState(null);
  const [converting, setConverting] = useState(null);
  const [convertForm, setConvertForm] = useState({});
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ contactId: '', title: '', description: '', amount: '' });

  async function load() {
    const [data, contactRows] = await Promise.all([api('/quotes'), api('/contacts')]);
    setRows(data);
    setContacts(contactRows);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);
  useEffect(() => {
    if (createRequest > 0) setCreating(true);
  }, [createRequest]);
  const visibleRows = filterDemoRows(rows, demoFilter);

  async function createQuote(e) {
    e.preventDefault();
    setWorkingId('create');
    setMessage('');
    try {
      await api('/quotes', {
        method: 'POST',
        body: JSON.stringify({ ...createForm, amount: Number(createForm.amount || 0) })
      });
      setCreateForm({ contactId: '', title: '', description: '', amount: '' });
      setCreating(false);
      await load();
      setMessage('Cotizacion creada como borrador.');
    } catch (err) {
      setMessage('No se pudo crear la cotizacion.');
      console.error(err);
    } finally {
      setWorkingId(null);
    }
  }

  async function sendQuote(row) {
    setWorkingId(row.id);
    setMessage('');

    try {
      const result = await api(`/quotes/${row.id}/send`, { method: 'POST', body: JSON.stringify({}) });
      await load();
      setMessage(result.simulated ? 'Cotizacion simulada y guardada en WhatsApp.' : 'Cotizacion enviada por WhatsApp.');
    } catch (err) {
      setMessage('No se pudo enviar la cotizacion. Revisa telefono y conexion WhatsApp.');
      console.error(err);
    } finally {
      setWorkingId(null);
    }
  }

  async function updateStatus(row, status) {
    setWorkingId(row.id);
    setMessage('');

    try {
      await api(`/quotes/${row.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      await load();
      setMessage(status === 'ACCEPTED' ? 'Cotizacion marcada como aceptada.' : 'Cotizacion marcada como rechazada.');
    } catch (err) {
      setMessage('No se pudo actualizar la cotizacion.');
      console.error(err);
    } finally {
      setWorkingId(null);
    }
  }

  function startConvert(row) {
    setMessage('');
    setConverting(row);
    setConvertForm({
      title: row.title || '',
      description: row.description || '',
      amount: row.amount ?? 0,
      paymentStatus: 'PENDING',
      paymentMethod: 'OTHER'
    });
  }

  async function convertToAttendance(e) {
    e.preventDefault();
    if (!converting) return;
    setWorkingId(converting.id);
    setMessage('');

    try {
      await api(`/quotes/${converting.id}/create-attendance`, {
        method: 'POST',
        body: JSON.stringify({
          ...convertForm,
          amount: Number(convertForm.amount || 0)
        })
      });
      setConverting(null);
      await load();
      setMessage('Atencion creada desde la cotizacion. Tambien se registro el ingreso asociado.');
    } catch (err) {
      setMessage('No se pudo convertir la cotizacion en atencion.');
      console.error(err);
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Cotizaciones</h1>
          <p className="mt-1 text-slate-500">Propuestas enviadas o preparadas desde WhatsApp Assistant y Leads.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DemoFilter value={demoFilter} onChange={setDemoFilter} />
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => setCreating(true)}>Nueva cotizacion</button>
        </div>
      </div>

      {message && <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}

      {creating && (
        <form className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100" onSubmit={createQuote}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Nueva cotizacion</h2>
            <button type="button" className="text-sm font-semibold text-slate-500" onClick={() => setCreating(false)}>Cancelar</button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Cliente
              <select className="mt-1 w-full rounded-lg border p-3" value={createForm.contactId} onChange={(e) => setCreateForm({ ...createForm, contactId: e.target.value })} required>
                <option value="">Seleccionar cliente</option>
                {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.fullName || contact.phone || 'Sin nombre'}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Servicio
              <input className="mt-1 w-full rounded-lg border p-3" value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} required />
            </label>
            <label className="text-sm font-medium text-slate-700">Monto
              <input type="number" min="0" className="mt-1 w-full rounded-lg border p-3" value={createForm.amount} onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })} required />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">Detalle
              <textarea className="mt-1 min-h-24 w-full rounded-lg border p-3" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
            </label>
          </div>
          <button className="mt-4 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-400" disabled={workingId === 'create'}>{workingId === 'create' ? 'Creando...' : 'Crear cotizacion'}</button>
        </form>
      )}

      <div className="mt-6 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4">Cliente</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Telefono</th>
              <th className="p-4">Servicio</th>
              <th className="p-4">Monto</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Fecha</th>
              <th className="p-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="p-4">{row.contact?.fullName || '-'}</td>
                <td className="p-4"><DemoBadge row={row} /></td>
                <td className="p-4">{row.contact?.phone || '-'}</td>
                <td className="p-4">
                  <div className="font-medium text-slate-800">{row.title}</div>
                  {row.lead && <div className="mt-1 text-xs text-slate-400">Lead: {row.lead.title}</div>}
                </td>
                <td className="p-4">{row.amount ? `$${Number(row.amount).toLocaleString('es-CL')}` : '-'}</td>
                <td className="p-4">{row.status}</td>
                <td className="p-4">{formatDate(row.sentAt || row.createdAt)}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                      onClick={() => sendQuote(row)}
                      disabled={workingId === row.id || !row.contact?.phone || ['SENT', 'ACCEPTED', 'CONVERTED'].includes(row.status)}
                    >
                      {workingId === row.id ? 'Procesando...' : 'Enviar'}
                    </button>
                    <button
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                      onClick={() => updateStatus(row, 'ACCEPTED')}
                      disabled={workingId === row.id || ['ACCEPTED', 'CONVERTED'].includes(row.status)}
                    >
                      Aceptada
                    </button>
                    <button
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                      onClick={() => updateStatus(row, 'REJECTED')}
                      disabled={workingId === row.id || ['REJECTED', 'CONVERTED'].includes(row.status)}
                    >
                      Rechazada
                    </button>
                    <button
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                      onClick={() => startConvert(row)}
                      disabled={workingId === row.id || row.status === 'CONVERTED'}
                    >
                      Crear atencion
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && <tr><td className="p-6 text-slate-500" colSpan={8}>Sin cotizaciones.</td></tr>}
          </tbody>
        </table>
      </div>

      {converting && (
        <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Crear atencion desde cotizacion</h2>
            <button className="text-sm font-semibold text-slate-500 hover:text-slate-700" onClick={() => setConverting(null)}>Cancelar</button>
          </div>
          <div className="mt-1 text-sm text-slate-500">{converting.contact?.fullName || converting.contact?.phone || 'Sin cliente'}</div>
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={convertToAttendance}>
            <label className="block text-sm font-medium text-slate-700">
              Servicio
              <input className="mt-1 w-full rounded-lg border p-3" value={convertForm.title} onChange={(e) => setConvertForm({ ...convertForm, title: e.target.value })} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Monto
              <input className="mt-1 w-full rounded-lg border p-3" type="number" value={convertForm.amount} onChange={(e) => setConvertForm({ ...convertForm, amount: e.target.value })} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Estado de pago
              <select className="mt-1 w-full rounded-lg border p-3" value={convertForm.paymentStatus} onChange={(e) => setConvertForm({ ...convertForm, paymentStatus: e.target.value })}>
                <option value="PENDING">PENDING</option>
                <option value="PAID">PAID</option>
                <option value="PARTIAL">PARTIAL</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Metodo de pago
              <select className="mt-1 w-full rounded-lg border p-3" value={convertForm.paymentMethod} onChange={(e) => setConvertForm({ ...convertForm, paymentMethod: e.target.value })}>
                <option value="OTHER">OTHER</option>
                <option value="TRANSFER">TRANSFER</option>
                <option value="CASH">CASH</option>
                <option value="CARD">CARD</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700 md:col-span-2">
              Descripcion
              <textarea className="mt-1 min-h-24 w-full rounded-lg border p-3" value={convertForm.description} onChange={(e) => setConvertForm({ ...convertForm, description: e.target.value })} />
            </label>
            <div className="md:col-span-2">
              <button className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400" disabled={workingId === converting.id}>
                {workingId === converting.id ? 'Creando...' : 'Crear atencion'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function WhatsAppPage() {
  const [link, setLink] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [demoFilter, setDemoFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyStatus, setReplyStatus] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  async function loadConversations() {
    setRefreshing(true);
    try {
      const rows = await api('/whatsapp/conversations');
      setConversations(rows);
      if (!selectedId && rows[0]) setSelectedId(rows[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    api(`/whatsapp/conversations/${selectedId}`).then(setSelected).catch(console.error);
    setReplyStatus('');
  }, [selectedId]);
  const visibleConversations = filterDemoRows(conversations, demoFilter);

  async function connect() {
    setLoading(true);
    setError('');
    setStatus('');
    setLink(null);

    try {
      const res = await api('/kapso/setup-link', { method: 'POST', body: JSON.stringify({}) });
      setLink(res.url);
      setStatus(res.status || 'pending');
      await loadConversations();
    } catch (err) {
      setError('No se pudo crear el setup link. Revisa la configuracion de Kapso en el backend.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function sendReply(e) {
    e.preventDefault();
    if (!selectedId || !replyBody.trim()) return;
    setSendingReply(true);
    setReplyStatus('');

    try {
      const result = await api(`/whatsapp/conversations/${selectedId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ body: replyBody })
      });
      setReplyBody('');
      setReplyStatus(result.simulated ? 'Respuesta simulada y guardada.' : 'Respuesta enviada.');
      const refreshed = await api(`/whatsapp/conversations/${selectedId}`);
      setSelected(refreshed);
      await loadConversations();
    } catch (err) {
      setReplyStatus('No se pudo enviar la respuesta.');
      console.error(err);
    } finally {
      setSendingReply(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">WhatsApp</h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Conversaciones recibidas desde Kapso Sandbox y estado de conexion.
          </p>
        </div>
        <div className="flex gap-2">
          <DemoFilter value={demoFilter} onChange={setDemoFilter} />
          <button
            onClick={loadConversations}
            disabled={refreshing}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button
            onClick={connect}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading ? 'Creando...' : 'Conectar WhatsApp'}
          </button>
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {link && (
        <div className="mt-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="text-sm text-slate-500">Setup link sandbox {status && `(${status})`}</div>
          <a className="break-all text-emerald-700 underline" href={link} target="_blank">{link}</a>
        </div>
      )}

      <div className="mt-6 grid min-h-[520px] overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-100 lg:grid-cols-[360px_1fr]">
        <div className="border-b border-slate-100 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-100 p-4">
            <div className="text-sm font-semibold text-slate-900">Conversaciones</div>
            <div className="text-xs text-slate-500">{visibleConversations.length} registros</div>
          </div>
          <div className="max-h-[620px] overflow-y-auto">
            {visibleConversations.map((conversation) => {
              const active = selectedId === conversation.id;
              const label = conversation.contactName || conversation.contactPhone || 'Sin contacto';
              const preview = conversation.lastMessage?.text || conversation.lastMessage?.type || 'Sin mensajes';
              return (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedId(conversation.id)}
                  className={`block w-full border-b border-slate-100 p-4 text-left hover:bg-slate-50 ${active ? 'bg-emerald-50' : 'bg-white'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="truncate text-sm font-semibold text-slate-900">{label}</div>
                      <DemoBadge row={conversation} />
                    </div>
                    <div className="shrink-0 text-xs text-slate-400">{formatDate(conversation.lastMessageAt || conversation.updatedAt)}</div>
                  </div>
                  <div className="mt-1 truncate text-sm text-slate-500">{preview}</div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <span>{conversation.contactPhone}</span>
                    {conversation.evidenceCount > 0 && <span>{conversation.evidenceCount} evidencias</span>}
                  </div>
                </button>
              );
            })}
            {visibleConversations.length === 0 && (
              <div className="p-6 text-sm text-slate-500">
                Sin conversaciones. Envia un webhook sandbox y presiona Actualizar.
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-[520px] flex-col">
          {selected ? (
            <>
              <div className="border-b border-slate-100 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-base font-semibold text-slate-900">{selected.contactName || selected.contactPhone}</div>
                  <DemoBadge row={selected} />
                </div>
                <div className="text-sm text-slate-500">{selected.contactPhone}</div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
                {selected.messages.map((message) => {
                  const inbound = message.direction === 'INBOUND';
                  const label = message.text || (message.type === 'text' ? 'Mensaje sin texto' : `Mensaje ${message.type}`);
                  return (
                    <div key={message.id} className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[78%] rounded-lg px-4 py-3 text-sm shadow-sm ${inbound ? 'bg-white text-slate-800' : 'bg-emerald-600 text-white'}`}>
                        <div className="whitespace-pre-wrap break-words">{label}</div>
                        {message.evidenceFiles?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {message.evidenceFiles.map((file) => (
                              <a key={file.id} className={`block underline ${inbound ? 'text-emerald-700' : 'text-emerald-50'}`} href={file.publicUrl} target="_blank">
                                {file.originalFileName || file.type}
                              </a>
                            ))}
                          </div>
                        )}
                        <div className={`mt-2 text-right text-[11px] ${inbound ? 'text-slate-400' : 'text-emerald-100'}`}>
                          {formatDate(message.createdAt)}
                          {!inbound && message.outboundStatus && (
                            <span> - {message.outboundStatus}</span>
                          )}
                        </div>
                        {!inbound && message.outboundError && (
                          <div className="mt-2 rounded bg-red-500/20 p-2 text-xs text-white">
                            {message.outboundError}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {selected.messages.length === 0 && <div className="text-sm text-slate-500">Sin mensajes.</div>}
              </div>
              <form className="border-t border-slate-100 bg-white p-4" onSubmit={sendReply}>
                {replyStatus && <div className="mb-3 text-sm text-slate-500">{replyStatus}</div>}
                <div className="flex flex-col gap-2 md:flex-row">
                  <textarea
                    className="min-h-20 flex-1 rounded-lg border p-3 text-sm"
                    placeholder="Escribe una respuesta..."
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                  />
                  <button
                    className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={sendingReply || !replyBody.trim()}
                  >
                    {sendingReply ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-center text-sm text-slate-500">
              Selecciona una conversacion para ver los mensajes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventsPage() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const data = await api('/audit-logs?take=120');
      setRows(data);
      setPage(1);
    } catch (err) {
      setMessage('No se pudieron cargar los eventos.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    load();
  }, []);

  function resultLabel(row) {
    const result = row.result || {};
    if (result.duplicate) return 'Duplicado';
    if (result.reason) return result.reason;
    if (result.command) return result.command;
    if (result.quoteResponse) return 'Respuesta cotizacion';
    if (result.media) return 'Media';
    if (result.processed === true) return 'Procesado';
    if (result.processed === false) return 'Ignorado';
    return '-';
  }

  function tone(row) {
    const label = resultLabel(row);
    if (['generated_reply_echo', 'outbound_echo', 'outbound_or_status_event', 'recent_text_echo'].includes(label)) return 'bg-amber-50 text-amber-800';
    if (label === 'Procesado' || row.result?.command || row.result?.quoteResponse) return 'bg-emerald-50 text-emerald-800';
    if (label === 'Ignorado' || row.result?.reason) return 'bg-slate-100 text-slate-700';
    return 'bg-slate-50 text-slate-600';
  }

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Eventos</h1>
          <p className="mt-1 text-slate-500">Auditoria de webhooks Kapso, anti-loop y procesamiento WhatsApp.</p>
        </div>
        <button
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
          onClick={load}
          disabled={loading}
        >
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {message && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</div>}

      <div className="mt-6 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-500">
            Mostrando {rows.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, rows.length)} de {rows.length} eventos
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <span className="text-sm text-slate-500">Pagina {page} de {totalPages}</span>
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={page >= totalPages}
            >
              Siguiente
            </button>
          </div>
        </div>
        <div className="max-h-[62vh] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 shadow-sm">
              <tr>
                <th className="p-4">Fecha</th>
                <th className="p-4">Evento</th>
                <th className="p-4">Telefono</th>
                <th className="p-4">Mensaje</th>
                <th className="p-4">Resultado</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.id} className="border-t align-top">
                  <td className="p-4 text-slate-500">{formatDate(row.createdAt)}</td>
                  <td className="p-4">
                    <div className="font-medium text-slate-800">{row.eventType || row.action}</div>
                    <div className="mt-1 max-w-[220px] truncate text-xs text-slate-400">{row.idempotencyKey || row.entityId || '-'}</div>
                  </td>
                  <td className="p-4">
                    <div>{row.fromPhone || '-'}</div>
                    <div className="mt-1 max-w-[180px] truncate text-xs text-slate-400">{row.phoneNumberId || '-'}</div>
                  </td>
                  <td className="max-w-md p-4">
                    <div className="line-clamp-2 whitespace-pre-wrap break-words text-slate-700">{row.text || row.messageType || '-'}</div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${tone(row)}`}>
                      {resultLabel(row)}
                    </span>
                  </td>
                  <td className="p-4">
                    <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setSelected(row)}>
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td className="p-6 text-slate-500" colSpan={6}>Sin eventos.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Detalle del evento</h2>
                <div className="mt-1 text-sm text-slate-500">{selected.eventType || selected.action} - {formatDate(selected.createdAt)}</div>
              </div>
              <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50" onClick={() => setSelected(null)}>Cerrar</button>
            </div>
            <div className="max-h-[calc(92vh-86px)] overflow-y-auto p-5">
              <div className="grid gap-3 md:grid-cols-3">
                <Card title="Resultado" value={resultLabel(selected)} />
                <Card title="Telefono" value={selected.fromPhone || '-'} />
                <Card title="Firma" value={selected.signatureChecked ? 'Validada' : 'No validada'} />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Mensaje</div>
                  <div className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{selected.text || selected.messageType || '-'}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Identificadores</div>
                  <div className="mt-2 break-all text-sm text-slate-700">
                    <div>Idempotency: {selected.idempotencyKey || '-'}</div>
                    <div>Phone number id: {selected.phoneNumberId || '-'}</div>
                  </div>
                </div>
              </div>
              <pre className="mt-4 max-h-[520px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(selected.raw || selected, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminDetailList({ title, rows, empty, render }) {
  return (
    <div className="rounded-lg border border-slate-100 p-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 max-h-72 overflow-auto">
        {rows.map((row) => (
          <div key={row.id} className="mb-2 rounded-lg bg-slate-50 p-3 text-sm">
            {render(row)}
          </div>
        ))}
        {rows.length === 0 && <div className="text-sm text-slate-500">{empty}</div>}
      </div>
    </div>
  );
}

function PlatformAdminPage() {
  const [overview, setOverview] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [routing, setRouting] = useState(null);
  const [outboundRows, setOutboundRows] = useState([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [phoneForm, setPhoneForm] = useState({ phone: '', assistantAllowedPhones: '' });
  const [adminNotesForm, setAdminNotesForm] = useState('');
  const [savingPhones, setSavingPhones] = useState(false);
  const [savingAdminNotes, setSavingAdminNotes] = useState(false);
  const [auditFilter, setAuditFilter] = useState('Todos');
  const [preparingDemo, setPreparingDemo] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [healthCheck, setHealthCheck] = useState(null);
  const [realPilotHealth, setRealPilotHealth] = useState(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [checkingRealPilot, setCheckingRealPilot] = useState(false);
  const [reassignPhone, setReassignPhone] = useState('');
  const [reassignPreview, setReassignPreview] = useState(null);
  const [targetProfessionalId, setTargetProfessionalId] = useState('');
  const [includeWhatsApp, setIncludeWhatsApp] = useState(true);
  const [includeContacts, setIncludeContacts] = useState(true);
  const [previewingReassignment, setPreviewingReassignment] = useState(false);
  const [executingReassignment, setExecutingReassignment] = useState(false);
  const [invitationForm, setInvitationForm] = useState({ displayName: '', email: '', profession: '', phone: '', note: '' });
  const [creatingInvitation, setCreatingInvitation] = useState(false);

  async function load(search = query) {
    setLoading(true);
    setMessage('');
    try {
      const [overviewData, professionalRows, routingData, invitationRows] = await Promise.all([
        api('/platform-admin/overview'),
        api(`/platform-admin/professionals${search ? `?q=${encodeURIComponent(search)}` : ''}`),
        api('/platform-admin/routing-validation'),
        api('/platform-admin/invitations')
      ]);
      const outboundData = await api('/platform-admin/outbound-messages?take=30');
      setOverview(overviewData);
      setProfessionals(professionalRows);
      setRouting(routingData);
      setInvitations(invitationRows);
      setOutboundRows(outboundData);
    } catch (err) {
      setMessage('No se pudo cargar el panel de administracion.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load('');
  }, []);

  async function changeStatus(row, status) {
    setWorkingId(row.id);
    setMessage('');
    try {
      await api(`/platform-admin/users/${row.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      await load();
      if (selectedDetail?.user?.id === row.id) {
        const detail = await api(`/platform-admin/professionals/${selectedDetail.id}`);
        setSelectedDetail(detail);
        setPhoneForm({
          phone: detail.phone || '',
          assistantAllowedPhones: detail.assistantAllowedPhones || ''
        });
        setAdminNotesForm(detail.adminNotes || '');
      }
      setMessage(status === 'ACTIVE' ? 'Cuenta aprobada.' : status === 'SUSPENDED' ? 'Cuenta suspendida.' : 'Cuenta devuelta a pendiente.');
    } catch (err) {
      const text = err?.message || '';
      setMessage(text.includes('duplicados') ? 'No se puede aprobar: corrige primero los telefonos duplicados.' : 'No se pudo actualizar el estado de la cuenta.');
      console.error(err);
    } finally {
      setWorkingId(null);
    }
  }

  async function openProfessionalDetail(professionalId) {
    if (!professionalId) return;
    setLoadingDetail(true);
    setMessage('');
    try {
      const detail = await api(`/platform-admin/professionals/${professionalId}`);
      setSelectedDetail(detail);
      setHealthCheck(null);
      setRealPilotHealth(null);
      setPhoneForm({
        phone: detail.phone || '',
        assistantAllowedPhones: detail.assistantAllowedPhones || ''
      });
      setAdminNotesForm(detail.adminNotes || '');
    } catch (err) {
      setMessage('No se pudo cargar el detalle del profesional.');
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function saveProfessionalPhones(e) {
    e.preventDefault();
    if (!selectedDetail) return;
    setSavingPhones(true);
    setMessage('');
    try {
      await api(`/platform-admin/professionals/${selectedDetail.id}/phones`, {
        method: 'PATCH',
        body: JSON.stringify(phoneForm)
      });
      const detail = await api(`/platform-admin/professionals/${selectedDetail.id}`);
      setSelectedDetail(detail);
      setPhoneForm({
        phone: detail.phone || '',
        assistantAllowedPhones: detail.assistantAllowedPhones || ''
      });
      setAdminNotesForm(detail.adminNotes || '');
      await load();
      setMessage('Telefonos del profesional actualizados.');
    } catch (err) {
      const text = err?.message || '';
      setMessage(text.includes('asignado') ? 'No se guardo: ese telefono ya esta asignado a otro profesional activo.' : 'No se pudieron actualizar los telefonos.');
      console.error(err);
    } finally {
      setSavingPhones(false);
    }
  }

  async function saveAdminNotes(e) {
    e.preventDefault();
    if (!selectedDetail) return;
    setSavingAdminNotes(true);
    setMessage('');
    try {
      await api(`/platform-admin/professionals/${selectedDetail.id}/admin-notes`, {
        method: 'PATCH',
        body: JSON.stringify({ adminNotes: adminNotesForm })
      });
      const detail = await api(`/platform-admin/professionals/${selectedDetail.id}`);
      setSelectedDetail(detail);
      setAdminNotesForm(detail.adminNotes || '');
      setMessage('Notas internas actualizadas.');
    } catch (err) {
      setMessage('No se pudieron guardar las notas internas.');
      console.error(err);
    } finally {
      setSavingAdminNotes(false);
    }
  }

  function scrollAdminDetailSection(id) {
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  async function prepareDemoData() {
    if (!selectedDetail) return;
    const confirmed = window.confirm(`Preparar datos demo para ${selectedDetail.displayName}?`);
    if (!confirmed) return;
    setPreparingDemo(true);
    setMessage('');
    try {
      const result = await api(`/platform-admin/professionals/${selectedDetail.id}/demo-data`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      const detail = await api(`/platform-admin/professionals/${selectedDetail.id}`);
      setSelectedDetail(detail);
      await load();
      setMessage(`Demo preparado: ${result.summary?.contact || 'cliente demo'}, cotizacion ${result.summary?.quoteStatus || 'lista'}.`);
    } catch (err) {
      setMessage('No se pudo preparar el demo del profesional.');
      console.error(err);
    } finally {
      setPreparingDemo(false);
    }
  }

  async function resetDemoData() {
    if (!selectedDetail) return;
    const confirmed = window.confirm(`Restablecer demo para ${selectedDetail.displayName}? Se borraran solo datos marcados como Fluxio Demo y se recreara el caso base.`);
    if (!confirmed) return;
    setResettingDemo(true);
    setMessage('');
    try {
      const result = await api(`/platform-admin/professionals/${selectedDetail.id}/demo-data/reset`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      const detail = await api(`/platform-admin/professionals/${selectedDetail.id}`);
      setSelectedDetail(detail);
      await load();
      setMessage(`Demo restablecido: ${result.prepared?.contact || 'cliente demo'}, ${result.prepared?.messages || 0} mensajes base.`);
    } catch (err) {
      setMessage('No se pudo restablecer el demo del profesional.');
      console.error(err);
    } finally {
      setResettingDemo(false);
    }
  }

  async function runDemoHealthCheck() {
    if (!selectedDetail) return;
    setCheckingHealth(true);
    setMessage('');
    try {
      const result = await api(`/platform-admin/professionals/${selectedDetail.id}/demo-health`);
      setHealthCheck(result);
      setMessage(result.ready ? 'Health check comercial OK: demo listo.' : 'Health check comercial con pendientes.');
    } catch (err) {
      setMessage('No se pudo validar el demo comercial.');
      console.error(err);
    } finally {
      setCheckingHealth(false);
    }
  }

  async function runRealPilotHealthCheck() {
    if (!selectedDetail) return;
    setCheckingRealPilot(true);
    setMessage('');
    try {
      const result = await api(`/platform-admin/professionals/${selectedDetail.id}/real-pilot-health`);
      setRealPilotHealth(result);
      setMessage(result.ready ? 'Piloto real listo.' : 'Piloto real con pendientes.');
    } catch (err) {
      setMessage('No se pudo validar el piloto real.');
      console.error(err);
    } finally {
      setCheckingRealPilot(false);
    }
  }

  async function createInvitation(e) {
    e.preventDefault();
    setCreatingInvitation(true);
    setMessage('');
    try {
      const result = await api('/platform-admin/invitations', {
        method: 'POST',
        body: JSON.stringify(invitationForm)
      });
      setInvitationForm({ displayName: '', email: '', profession: '', phone: '', note: '' });
      await load();
      await navigator.clipboard?.writeText(result.invitationMessage || result.inviteUrl);
      setMessage('Invitacion creada. Mensaje copiado al portapapeles.');
    } catch (err) {
      setMessage('No se pudo crear la invitacion.');
      console.error(err);
    } finally {
      setCreatingInvitation(false);
    }
  }

  async function copyInvitationMessage(invitation) {
    await navigator.clipboard?.writeText(invitation.invitationMessage || invitation.inviteUrl);
    setMessage('Mensaje de invitacion copiado al portapapeles.');
  }

  async function copyInvitationLink(invitation) {
    await navigator.clipboard?.writeText(invitation.inviteUrl);
    setMessage('Link de invitacion copiado al portapapeles.');
  }

  function approvalMessage(detail = selectedDetail) {
    if (!detail) return '';
    const appUrl = window.location.origin || 'http://localhost:5173';
    const fluxioPhone = overview?.platform?.phoneDisplay || detail.whatsappConnections?.[0]?.displayPhone || 'el numero WhatsApp de Fluxio';
    return [
      `Hola ${detail.displayName}, tu cuenta de Fluxio ya fue activada.`,
      '',
      `Puedes ingresar aqui: ${appUrl}`,
      '',
      'Para comenzar, revisa Primeros pasos y prueba el asistente enviando "menu" al WhatsApp de Fluxio.',
      `Numero Fluxio: ${fluxioPhone}`,
      '',
      'Despues de esa prueba podemos preparar tu demo o avanzar con tu primer cliente real.'
    ].join('\n');
  }

  async function copyApprovalMessage() {
    await navigator.clipboard?.writeText(approvalMessage());
    setMessage('Mensaje de bienvenida copiado al portapapeles.');
  }

  async function cancelInvitation(id) {
    setMessage('');
    try {
      await api(`/platform-admin/invitations/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({}) });
      await load();
      setMessage('Invitacion cancelada.');
    } catch (err) {
      setMessage('No se pudo cancelar la invitacion.');
      console.error(err);
    }
  }

  async function handleActivationAction(step) {
    if (!selectedDetail || !step?.action) return;
    if (step.action === 'approve_account') {
      await changeStatus({ id: selectedDetail.user.id, accountStatus: selectedDetail.user.accountStatus }, 'ACTIVE');
      return;
    }
    if (step.action === 'edit_command_phones' || step.action === 'open_professional_detail') {
      scrollAdminDetailSection('admin-command-phones');
      return;
    }
    if (step.action === 'prepare_demo') {
      await prepareDemoData();
      return;
    }
    if (step.action === 'review_templates') {
      setMessage('Las plantillas se revisan desde la cuenta del profesional en Configuracion > Plantillas.');
      return;
    }
    if (step.action === 'send_test_message') {
      setMessage('Pide al profesional enviar "menu" al numero Fluxio/Kapso desde su WhatsApp autorizado. Luego actualiza el detalle.');
      return;
    }
    if (step.action === 'review_kapso_config') {
      setMessage('Revisa KAPSO_PLATFORM_PHONE_DISPLAY o KAPSO_SANDBOX_PHONE_NUMBER_ID en la configuracion del backend.');
    }
  }

  function submitSearch(e) {
    e.preventDefault();
    load(query);
  }

  async function previewReassignment(e) {
    e.preventDefault();
    setPreviewingReassignment(true);
    setMessage('');
    setReassignPreview(null);
    try {
      const data = await api(`/platform-admin/data-reassignment/preview?phone=${encodeURIComponent(reassignPhone)}`);
      setReassignPreview(data);
      setTargetProfessionalId('');
      setMessage('Vista previa lista. Revisa los datos antes de ejecutar.');
    } catch (err) {
      setMessage('No se pudo preparar la vista previa. Revisa el telefono.');
      console.error(err);
    } finally {
      setPreviewingReassignment(false);
    }
  }

  async function executeReassignment() {
    if (!reassignPreview || !targetProfessionalId) {
      setMessage('Selecciona un profesional destino antes de reasignar.');
      return;
    }
    const target = professionals.find((row) => row.professional?.id === targetProfessionalId)?.professional?.displayName || 'el profesional destino';
    const ok = window.confirm(`Reasignar datos del telefono ${reassignPreview.phone} a ${target}? Esta accion quedara auditada.`);
    if (!ok) return;

    setExecutingReassignment(true);
    setMessage('');
    try {
      const result = await api('/platform-admin/data-reassignment/execute', {
        method: 'POST',
        body: JSON.stringify({
          phone: reassignPreview.phone,
          targetProfessionalId,
          includeWhatsApp,
          includeContacts
        })
      });
      await load();
      const refreshed = await api(`/platform-admin/data-reassignment/preview?phone=${encodeURIComponent(reassignPreview.phone)}`);
      setReassignPreview(refreshed);
      setMessage(`Reasignacion completada hacia ${result.targetDisplayName}.`);
    } catch (err) {
      setMessage('No se pudo ejecutar la reasignacion.');
      console.error(err);
    } finally {
      setExecutingReassignment(false);
    }
  }

  const pendingCount = overview?.users?.pending || 0;
  const pendingApprovals = professionals.filter((row) => row.accountStatus === 'PENDING_APPROVAL');
  const pilotRows = professionals.filter((row) => row.professional?.id).map((row) => {
    const professional = row.professional;
    const invited = invitations.find((item) => item.acceptedUser?.id === row.id || item.email === row.email);
    const stages = [
      { label: 'Invitado', done: Boolean(invited) },
      { label: 'Registrado', done: Boolean(row.createdAt) },
      { label: 'Aprobado', done: row.accountStatus === 'ACTIVE' },
      { label: 'Demo listo', done: Boolean(professional?.readyForDemo) },
      { label: 'WhatsApp probado', done: Boolean(professional?.lastInboundAt) },
      { label: 'Cliente creado', done: Number(professional?.counts?.contacts || 0) > 0 }
    ];
    return {
      ...row,
      pilotCompleted: stages.filter((stage) => stage.done).length,
      pilotTotal: stages.length,
      pilotStages: stages,
      pilotNext: stages.find((stage) => !stage.done)?.label || 'Listo para piloto'
    };
  });
  const conflicts = routing?.conflicts || [];
  const missingPhones = routing?.missingCommandPhones || [];
  const totalReassignmentRecords = reassignPreview
    ? Object.values(reassignPreview.totals || {}).reduce((sum, value) => sum + Number(value || 0), 0)
    : 0;

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin plataforma</h1>
          <p className="mt-1 text-slate-500">Aprobacion de profesionales, salud multi-profesional y actividad global.</p>
        </div>
        <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-400" onClick={() => load()} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {message && <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Profesionales" value={overview?.users?.total ?? '-'} subtitle={`${overview?.users?.active ?? 0} activos`} />
        <Card title="Pendientes" value={pendingCount} subtitle="Requieren aprobacion manual" />
        <Card title="Mensajes WhatsApp" value={overview?.whatsapp?.totalMessages ?? '-'} subtitle={`${overview?.whatsapp?.inboundMessages ?? 0} entrantes`} />
        <Card title="Outbound fallidos" value={overview?.whatsapp?.failedOutboundMessages ?? 0} subtitle={`${overview?.whatsapp?.outboundMessages ?? 0} salientes`} />
      </div>

      <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Pendientes de aprobacion</h2>
            <p className="mt-1 text-sm text-slate-500">Profesionales registrados que aun no pueden usar Fluxio hasta que Admin los valide.</p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">{pendingApprovals.length} pendientes</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {pendingApprovals.map((row) => {
            const invitation = invitations.find((item) => item.acceptedUser?.id === row.id || item.email === row.email);
            const professional = row.professional;
            return (
              <div key={row.id} className="rounded-lg border border-amber-100 bg-amber-50/40 p-4 text-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{professional?.displayName || row.name}</div>
                    <div className="mt-1 text-slate-600">{row.email}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {professional?.profession || 'Sin profesion'} - {professional?.phone || 'Sin telefono'}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Registro {formatDate(row.createdAt)}{invitation ? ` - Invitacion ${invitation.status}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400" disabled={workingId === row.id} onClick={() => changeStatus(row, 'ACTIVE')}>
                      Aprobar
                    </button>
                    <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-400" disabled={loadingDetail || !professional?.id} onClick={() => openProfessionalDetail(professional?.id)}>
                      Revisar
                    </button>
                    <button className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:text-slate-400" disabled={workingId === row.id} onClick={() => changeStatus(row, 'SUSPENDED')}>
                      Suspender
                    </button>
                  </div>
                </div>
                {invitation?.note && <div className="mt-3 rounded-lg bg-white/80 p-3 text-xs text-slate-600">{invitation.note}</div>}
              </div>
            );
          })}
          {pendingApprovals.length === 0 && <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500 lg:col-span-2">No hay profesionales esperando aprobacion.</div>}
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Checklist salida a piloto</h2>
            <p className="mt-1 text-sm text-slate-500">Seguimiento comercial para saber que profesional esta listo para probar con clientes.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{pilotRows.length} profesionales</span>
        </div>
        <div className="mt-4 max-h-80 overflow-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3">Profesional</th>
                <th className="p-3">Avance</th>
                <th className="p-3">Etapas</th>
                <th className="p-3">Siguiente</th>
                <th className="p-3">Accion</th>
              </tr>
            </thead>
            <tbody>
              {pilotRows.map((row) => (
                <tr key={row.id} className="border-t align-top">
                  <td className="p-3">
                    <div className="font-semibold text-slate-900">{row.professional?.displayName || row.name}</div>
                    <div className="text-xs text-slate-500">{row.email}</div>
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.pilotCompleted === row.pilotTotal ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                      {row.pilotCompleted}/{row.pilotTotal}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex max-w-xl flex-wrap gap-1">
                      {row.pilotStages.map((stage) => (
                        <span key={stage.label} className={`rounded-full px-2 py-1 text-[11px] font-semibold ${stage.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {stage.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-slate-600">{row.pilotNext}</td>
                  <td className="p-3">
                    <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => openProfessionalDetail(row.professional?.id)}>
                      Revisar
                    </button>
                  </td>
                </tr>
              ))}
              {pilotRows.length === 0 && <tr><td className="p-4 text-slate-500" colSpan={5}>Sin profesionales para seguimiento.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <form className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100" onSubmit={createInvitation}>
          <h2 className="text-xl font-semibold text-slate-900">Invitar profesional</h2>
          <p className="mt-1 text-sm text-slate-500">Crea un mensaje listo para enviar por WhatsApp o email.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input className="rounded-lg border p-3 text-sm" value={invitationForm.displayName} onChange={(e) => setInvitationForm({ ...invitationForm, displayName: e.target.value })} placeholder="Nombre" required />
            <input className="rounded-lg border p-3 text-sm" value={invitationForm.email} onChange={(e) => setInvitationForm({ ...invitationForm, email: e.target.value })} placeholder="Email" type="email" required />
            <input className="rounded-lg border p-3 text-sm" value={invitationForm.profession} onChange={(e) => setInvitationForm({ ...invitationForm, profession: e.target.value })} placeholder="Profesion" />
            <input className="rounded-lg border p-3 text-sm" value={invitationForm.phone} onChange={(e) => setInvitationForm({ ...invitationForm, phone: e.target.value })} placeholder="+569..." />
            <textarea className="min-h-20 rounded-lg border p-3 text-sm md:col-span-2" value={invitationForm.note} onChange={(e) => setInvitationForm({ ...invitationForm, note: e.target.value })} placeholder="Nota interna" />
          </div>
          <button className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400" disabled={creatingInvitation}>
            {creatingInvitation ? 'Creando...' : 'Crear y copiar mensaje'}
          </button>
        </form>

        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-xl font-semibold text-slate-900">Invitaciones recientes</h2>
          <div className="mt-4 max-h-80 overflow-auto">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="mb-3 rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{invitation.displayName}</div>
                    <div className="text-slate-500">{invitation.email} - {invitation.profession || 'sin profesion'}</div>
                    <div className="mt-1 text-xs text-slate-400">Expira {formatDate(invitation.expiresAt)}</div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${invitation.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : invitation.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                    {invitation.status}
                  </span>
                </div>
                {invitation.note && <div className="mt-2 text-xs text-slate-500">{invitation.note}</div>}
                {invitation.invitationMessage && (
                  <div className="mt-3 max-h-32 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                    <pre className="whitespace-pre-wrap font-sans">{invitation.invitationMessage}</pre>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800" onClick={() => copyInvitationMessage(invitation)}>
                    Copiar mensaje
                  </button>
                  <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => copyInvitationLink(invitation)}>
                    Copiar link
                  </button>
                  {invitation.status === 'PENDING' && (
                    <button className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50" onClick={() => cancelInvitation(invitation.id)}>
                      Cancelar
                    </button>
                  )}
                  {invitation.acceptedUser?.professional?.id && (
                    <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => openProfessionalDetail(invitation.acceptedUser.professional.id)}>
                      Ver profesional
                    </button>
                  )}
                </div>
              </div>
            ))}
            {invitations.length === 0 && <div className="text-sm text-slate-500">Sin invitaciones.</div>}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-xl font-semibold text-slate-900">Validacion multi-profesional</h2>
          <p className="mt-1 text-sm text-slate-500">Revisa si un numero de WhatsApp esta asignado a mas de un profesional.</p>
          <div className={`mt-4 rounded-lg p-4 text-sm ${routing?.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
            {routing?.ok ? 'Sin conflictos de ruteo detectados.' : `${conflicts.length} conflicto(s) de telefono autorizado.`}
          </div>
          <div className="mt-4 max-h-52 overflow-auto">
            {conflicts.map((conflict) => (
              <div key={conflict.phone} className="mb-3 rounded-lg border border-amber-100 p-3 text-sm">
                <div className="font-semibold text-slate-900">{conflict.phone}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {conflict.professionals.map((item) => (
                    <button key={item.professionalId} className="rounded-lg bg-white px-3 py-2 text-left text-xs font-semibold text-amber-800 ring-1 ring-amber-100 hover:bg-amber-50" onClick={() => openProfessionalDetail(item.professionalId)}>
                      {item.displayName} ({item.email})
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {conflicts.length === 0 && <div className="text-sm text-slate-500">Cada telefono autorizado apunta a un unico profesional.</div>}
          </div>
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-xl font-semibold text-slate-900">Telefonos por completar</h2>
          <p className="mt-1 text-sm text-slate-500">Profesionales sin numero principal ni telefono autorizado para comandos.</p>
          <div className="mt-4 max-h-64 overflow-auto">
            {missingPhones.map((row) => (
              <div key={row.professionalId} className="mb-3 rounded-lg bg-slate-50 p-3 text-sm">
                <div className="font-semibold text-slate-900">{row.displayName}</div>
                <div className="text-slate-500">{row.email} - {row.accountStatus}</div>
              </div>
            ))}
            {missingPhones.length === 0 && <div className="text-sm text-slate-500">Todos los profesionales tienen telefono de referencia.</div>}
          </div>
        </div>
      </div>

      <form className="mt-6 flex flex-col gap-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100 md:flex-row" onSubmit={submitSearch}>
        <input className="min-w-0 flex-1 rounded-lg border p-3" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, email o telefono" />
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Buscar</button>
      </form>

      <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Reasignacion por telefono</h2>
            <p className="mt-1 text-sm text-slate-500">Herramienta de soporte para mover datos creados bajo el profesional equivocado.</p>
          </div>
        </div>

        <form className="mt-4 flex flex-col gap-3 md:flex-row" onSubmit={previewReassignment}>
          <input className="min-w-0 flex-1 rounded-lg border p-3" value={reassignPhone} onChange={(e) => setReassignPhone(e.target.value)} placeholder="Telefono a buscar, por ejemplo 56921134579" />
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-400" disabled={previewingReassignment}>
            {previewingReassignment ? 'Buscando...' : 'Vista previa'}
          </button>
        </form>

        {reassignPreview && (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Telefono normalizado</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{reassignPreview.phone}</div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {Object.entries(reassignPreview.totals || {}).map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-white p-3 ring-1 ring-slate-100">
                    <div className="font-semibold text-slate-900">{value}</div>
                    <div className="text-xs text-slate-500">{key}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 p-4">
              <h3 className="font-semibold text-slate-900">Ejecutar reasignacion</h3>
              <div className="mt-3 grid gap-3">
                <label className="block text-sm font-medium text-slate-700">
                  Profesional destino
                  <select className="mt-1 w-full rounded-lg border p-3" value={targetProfessionalId} onChange={(e) => setTargetProfessionalId(e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {professionals.filter((row) => row.professional?.id).map((row) => (
                      <option key={row.professional.id} value={row.professional.id}>
                        {row.professional.displayName} - {row.email}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <input type="checkbox" checked={includeWhatsApp} onChange={(e) => setIncludeWhatsApp(e.target.checked)} />
                  Reasignar conversaciones, mensajes y evidencias WhatsApp
                </label>
                <label className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <input type="checkbox" checked={includeContacts} onChange={(e) => setIncludeContacts(e.target.checked)} />
                  Reasignar contactos y datos relacionados
                </label>
                <button
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-slate-400"
                  onClick={executeReassignment}
                  disabled={executingReassignment || !targetProfessionalId || totalReassignmentRecords === 0 || (!includeWhatsApp && !includeContacts)}
                >
                  {executingReassignment ? 'Reasignando...' : 'Reasignar datos'}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 p-4 lg:col-span-2">
              <h3 className="font-semibold text-slate-900">Datos encontrados por profesional</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {(reassignPreview.professionals || []).map((professional) => (
                  <div key={professional.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <div className="font-semibold text-slate-900">{professional.displayName}</div>
                    <div className="text-slate-500">{professional.email} - {professional.accountStatus}</div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
                      <span>{professional.counts.contacts} contactos</span>
                      <span>{professional.counts.conversations} chats</span>
                      <span>{professional.counts.messages} mensajes</span>
                      <span>{professional.counts.leads} leads</span>
                      <span>{professional.counts.quotes} cotiz.</span>
                      <span>{professional.counts.attendances} atenc.</span>
                    </div>
                  </div>
                ))}
                {reassignPreview.professionals?.length === 0 && <div className="text-sm text-slate-500">No hay datos asociados a ese telefono.</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Mensajes salientes Kapso</h2>
            <p className="mt-1 text-sm text-slate-500">Ultimos intentos de envio por WhatsApp desde Fluxio.</p>
          </div>
          <div className="text-sm text-slate-500">Ultimo webhook: {overview?.audit?.latestWebhookAt ? formatDate(overview.audit.latestWebhookAt) : '-'}</div>
        </div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="p-4">Fecha</th>
                <th className="p-4">Profesional</th>
                <th className="p-4">Destino</th>
                <th className="p-4">Origen</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Mensaje/Error</th>
              </tr>
            </thead>
            <tbody>
              {outboundRows.map((row) => (
                <tr key={row.id} className="border-t align-top">
                  <td className="p-4 text-slate-500">{formatDate(row.createdAt)}</td>
                  <td className="p-4">
                    <div className="font-semibold text-slate-900">{row.professionalName}</div>
                    <div className="text-xs text-slate-500">{row.professionalEmail}</div>
                  </td>
                  <td className="p-4">{row.contactName || row.toPhone || '-'}</td>
                  <td className="p-4">{row.outboundSource || '-'}</td>
                  <td className="p-4">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      row.outboundStatus === 'FAILED' ? 'bg-red-50 text-red-700' : row.outboundStatus === 'SENT' || row.outboundStatus === 'DELIVERED' || row.outboundStatus === 'READ' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {row.outboundStatus || 'sin estado'}
                    </span>
                  </td>
                  <td className="max-w-md p-4">
                    <div className="line-clamp-2 whitespace-pre-wrap break-words text-slate-700">{row.outboundError || row.text || '-'}</div>
                    {row.kapsoMessageId && <div className="mt-1 truncate text-xs text-slate-400">{row.kapsoMessageId}</div>}
                  </td>
                </tr>
              ))}
              {outboundRows.length === 0 && <tr><td className="p-6 text-slate-500" colSpan={6}>Sin mensajes salientes.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
        <div className="border-b border-slate-100 p-4 text-sm text-slate-500">
          {professionals.length} profesionales encontrados
        </div>
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 shadow-sm">
              <tr>
                <th className="p-4">Profesional</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Telefono comandos</th>
                <th className="p-4">Activacion</th>
                <th className="p-4">Actividad</th>
                <th className="p-4">Uso</th>
                <th className="p-4">Conexion</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {professionals.map((row) => {
                const professional = row.professional;
                const connection = professional?.whatsappConnections?.[0];
                return (
                  <tr key={row.id} className="border-t align-top">
                    <td className="p-4">
                      <div className="font-semibold text-slate-900">{professional?.displayName || row.name}</div>
                      <div className="mt-1 text-slate-500">{row.email}</div>
                      <div className="mt-1 text-xs text-slate-400">{professional?.profession || 'Sin profesion'}</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        row.accountStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : row.accountStatus === 'SUSPENDED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
                      }`}>
                        {row.accountStatus}
                      </span>
                      <div className="mt-2 text-xs text-slate-400">Creado {formatDate(row.createdAt)}</div>
                    </td>
                    <td className="p-4">
                      <div>{professional?.phone || '-'}</div>
                      <div className="mt-1 max-w-[220px] break-words text-xs text-slate-500">{professional?.assistantAllowedPhones || '-'}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${professional?.readyForDemo ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {professional?.readyForDemo ? 'Listo para demo' : 'Requiere accion'}
                        </span>
                        <span className="font-semibold text-slate-900">{professional?.activationCompleted || 0}/{professional?.activationTotal || 0}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {professional?.nextActivationStep?.title || 'Lista para demo'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div>{professional?.latestActivityAt ? formatDate(professional.latestActivityAt) : '-'}</div>
                      <div className="mt-1 text-xs text-slate-500">{professional?.latestActivity || 'Sin actividad'}</div>
                    </td>
                    <td className="p-4">
                      <div className="grid gap-1 text-xs text-slate-600">
                        <span>{professional?.counts?.contacts || 0} clientes</span>
                        <span>{professional?.counts?.attendances || 0} atenciones</span>
                        <span>{professional?.counts?.quotes || 0} cotizaciones</span>
                        <span>{professional?.counts?.messages || 0} mensajes</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>{connection?.status || 'sin conexion'}</div>
                      <div className="mt-1 max-w-[220px] break-words text-xs text-slate-500">{connection?.phoneNumberId || '-'}</div>
                      {connection?.lastError && <div className="mt-1 max-w-[220px] break-words text-xs text-red-600">{connection.lastError}</div>}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <button className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400" disabled={workingId === row.id || row.accountStatus === 'ACTIVE'} onClick={() => changeStatus(row, 'ACTIVE')}>
                          Aprobar
                        </button>
                        <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-400" disabled={loadingDetail || !professional?.id} onClick={() => openProfessionalDetail(professional?.id)}>
                          Ver detalle
                        </button>
                        <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-400" disabled={workingId === row.id || row.accountStatus === 'PENDING_APPROVAL'} onClick={() => changeStatus(row, 'PENDING_APPROVAL')}>
                          Pendiente
                        </button>
                        <button className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:bg-slate-400" disabled={workingId === row.id || row.accountStatus === 'SUSPENDED'} onClick={() => changeStatus(row, 'SUSPENDED')}>
                          Suspender
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {professionals.length === 0 && <tr><td className="p-6 text-slate-500" colSpan={8}>Sin profesionales.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {selectedDetail && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{selectedDetail.displayName}</h2>
                <div className="mt-1 text-sm text-slate-500">{selectedDetail.user?.email} - {selectedDetail.user?.accountStatus}</div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
                  onClick={prepareDemoData}
                  disabled={preparingDemo || resettingDemo}
                >
                  {preparingDemo ? 'Preparando...' : 'Preparar demo'}
                </button>
                <button
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:text-slate-400"
                  onClick={resetDemoData}
                  disabled={preparingDemo || resettingDemo}
                >
                  {resettingDemo ? 'Restableciendo...' : 'Restablecer demo'}
                </button>
                <button
                  className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:text-slate-400"
                  onClick={runDemoHealthCheck}
                  disabled={checkingHealth}
                >
                  {checkingHealth ? 'Validando...' : 'Validar demo'}
                </button>
                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:text-slate-400"
                  onClick={runRealPilotHealthCheck}
                  disabled={checkingRealPilot}
                >
                  {checkingRealPilot ? 'Validando...' : 'Validar piloto real'}
                </button>
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50" onClick={() => setSelectedDetail(null)}>
                  Cerrar
                </button>
              </div>
            </div>

            <div className="max-h-[calc(92vh-82px)] overflow-y-auto p-5">
              <div className="mb-5 rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">Revision de aprobacion</h3>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        selectedDetail.user?.accountStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : selectedDetail.user?.accountStatus === 'SUSPENDED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {selectedDetail.user?.accountStatus}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                      <div><span className="font-semibold text-slate-800">Email:</span> {selectedDetail.user?.email}</div>
                      <div><span className="font-semibold text-slate-800">Registro:</span> {formatDate(selectedDetail.user?.createdAt)}</div>
                      <div><span className="font-semibold text-slate-800">Profesion:</span> {selectedDetail.profession || 'Sin profesion'}</div>
                      <div><span className="font-semibold text-slate-800">Telefono:</span> {selectedDetail.phone || 'Sin telefono'}</div>
                      <div><span className="font-semibold text-slate-800">Origen:</span> {selectedDetail.invitation ? `Invitacion ${selectedDetail.invitation.status}` : 'Registro directo'}</div>
                      <div><span className="font-semibold text-slate-800">Activacion:</span> {selectedDetail.activationCompleted || 0}/{selectedDetail.activationTotal || 0} controles</div>
                    </div>
                    {selectedDetail.invitation?.note && (
                      <div className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-600 ring-1 ring-slate-100">
                        <span className="font-semibold text-slate-800">Nota interna:</span> {selectedDetail.invitation.note}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400" disabled={workingId === selectedDetail.user?.id || selectedDetail.user?.accountStatus === 'ACTIVE'} onClick={() => changeStatus({ id: selectedDetail.user.id, accountStatus: selectedDetail.user.accountStatus }, 'ACTIVE')}>
                      Aprobar cuenta
                    </button>
                    <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-400" disabled={selectedDetail.user?.accountStatus !== 'ACTIVE'} onClick={copyApprovalMessage}>
                      Copiar bienvenida
                    </button>
                    <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-400" disabled={workingId === selectedDetail.user?.id || selectedDetail.user?.accountStatus === 'PENDING_APPROVAL'} onClick={() => changeStatus({ id: selectedDetail.user.id, accountStatus: selectedDetail.user.accountStatus }, 'PENDING_APPROVAL')}>
                      Devolver a pendiente
                    </button>
                    <button className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:text-slate-400" disabled={workingId === selectedDetail.user?.id || selectedDetail.user?.accountStatus === 'SUSPENDED'} onClick={() => changeStatus({ id: selectedDetail.user.id, accountStatus: selectedDetail.user.accountStatus }, 'SUSPENDED')}>
                      Suspender
                    </button>
                  </div>
                </div>
                {selectedDetail.user?.accountStatus === 'ACTIVE' && (
                  <div className="mt-4 rounded-lg bg-white p-3 text-xs text-slate-600 ring-1 ring-slate-100">
                    <pre className="whitespace-pre-wrap font-sans">{approvalMessage(selectedDetail)}</pre>
                  </div>
                )}
              </div>

              <form className="mb-5 rounded-lg border border-slate-100 p-4" onSubmit={saveAdminNotes}>
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Notas internas</h3>
                    <p className="mt-1 text-sm text-slate-500">Apuntes comerciales o de soporte visibles solo para Admin plataforma.</p>
                  </div>
                  <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400" disabled={savingAdminNotes}>
                    {savingAdminNotes ? 'Guardando...' : 'Guardar nota'}
                  </button>
                </div>
                <textarea
                  className="mt-4 min-h-28 w-full rounded-lg border p-3 text-sm"
                  value={adminNotesForm}
                  onChange={(e) => setAdminNotesForm(e.target.value)}
                  placeholder="Ej: interesado en piloto, contactar el lunes, revisar telefono autorizado antes de aprobar..."
                />
              </form>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card title="Clientes" value={selectedDetail.counts?.contacts || 0} subtitle={`${selectedDetail.realCounts?.contacts || 0} reales / ${selectedDetail.demoCounts?.contacts || 0} demo`} />
                <Card title="Atenciones" value={selectedDetail.counts?.attendances || 0} subtitle={`${selectedDetail.realCounts?.attendances || 0} reales / ${selectedDetail.demoCounts?.attendances || 0} demo`} />
                <Card title="Mensajes" value={selectedDetail.counts?.messages || 0} subtitle={`${selectedDetail.realCounts?.messages || 0} reales / ${selectedDetail.demoCounts?.messages || 0} demo`} />
                <Card
                  title="Estado demo"
                  value={selectedDetail.readyForDemo ? 'Listo' : 'Pendiente'}
                  subtitle={selectedDetail.nextActivationStep?.title || `${selectedDetail.activationCompleted || 0}/${selectedDetail.activationTotal || 0} completo`}
                />
              </div>

              {healthCheck && (
                <div className={`mt-5 rounded-lg p-4 text-sm ${healthCheck.ready ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-lg font-semibold">Health check comercial</div>
                      <div className="mt-1">{healthCheck.passed}/{healthCheck.total} controles OK - {healthCheck.status}</div>
                    </div>
                    <button className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50" onClick={runDemoHealthCheck}>
                      Actualizar
                    </button>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {(healthCheck.checks || []).map((check) => (
                      <div key={check.key} className="rounded-lg bg-white/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{check.title}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${check.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {check.ok ? 'OK' : 'Pendiente'}
                          </span>
                        </div>
                        <div className="mt-1 break-words text-xs opacity-80">{String(check.detail || '-')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {realPilotHealth && (
                <div className={`mt-5 rounded-lg p-4 text-sm ${realPilotHealth.ready ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-lg font-semibold">Health check piloto real</div>
                      <div className="mt-1">{realPilotHealth.passed}/{realPilotHealth.total} controles OK - {realPilotHealth.status}</div>
                    </div>
                    <button className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50" onClick={runRealPilotHealthCheck}>
                      Actualizar
                    </button>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {(realPilotHealth.checks || []).map((check) => (
                      <div key={check.key} className="rounded-lg bg-white/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{check.title}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${check.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {check.ok ? 'OK' : 'Pendiente'}
                          </span>
                        </div>
                        <div className="mt-1 break-words text-xs opacity-80">{String(check.detail || '-')}</div>
                        {!check.ok && check.action && <div className="mt-2 text-xs font-medium opacity-90">{check.action}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 rounded-lg border border-slate-100 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Checklist de activacion demo</h3>
                    <p className="mt-1 text-sm text-slate-500">Preparar demo crea el caso base. Restablecer demo borra solo datos Fluxio Demo y vuelve a crear el ejemplo limpio.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
                      onClick={prepareDemoData}
                      disabled={preparingDemo || resettingDemo}
                    >
                      {preparingDemo ? 'Preparando...' : 'Crear datos demo'}
                    </button>
                    <button
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:text-slate-400"
                      onClick={resetDemoData}
                      disabled={preparingDemo || resettingDemo}
                    >
                      {resettingDemo ? 'Restableciendo...' : 'Restablecer demo'}
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {(selectedDetail.activationChecklist || []).map((step) => (
                    <div key={step.key || step.title} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                      <div className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        <CheckCircle size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{step.title}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {step.done ? 'Completo' : 'Pendiente'}
                          </span>
                        </div>
                        <div className="mt-1 text-slate-500">{step.description}</div>
                        {!step.done && step.actionLabel && (
                          <button
                            className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:text-slate-400"
                            onClick={() => handleActivationAction(step)}
                            disabled={preparingDemo || resettingDemo || workingId === selectedDetail.user?.id}
                          >
                            {step.actionLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedDetail.phoneConflicts?.length > 0 && (
                <div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                  <div className="font-semibold">Conflicto de telefono autorizado</div>
                  <div className="mt-2 grid gap-2">
                    {selectedDetail.phoneConflicts.map((conflict) => (
                      <div key={conflict.phone}>
                        {conflict.phone}: {conflict.professionals.map((item) => `${item.displayName} (${item.email})`).join(', ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                <form id="admin-command-phones" className="rounded-lg border border-slate-100 p-4" onSubmit={saveProfessionalPhones}>
                  <h3 className="text-lg font-semibold text-slate-900">Telefonos para ruteo</h3>
                  <p className="mt-1 text-sm text-slate-500">Estos numeros determinan a que profesional pertenecen los comandos enviados al WhatsApp de Fluxio.</p>
                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Telefono principal
                    <input className="mt-1 w-full rounded-lg border p-3" value={phoneForm.phone} onChange={(e) => setPhoneForm({ ...phoneForm, phone: e.target.value })} placeholder="+569..." />
                  </label>
                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Telefonos autorizados
                    <textarea className="mt-1 min-h-24 w-full rounded-lg border p-3" value={phoneForm.assistantAllowedPhones} onChange={(e) => setPhoneForm({ ...phoneForm, assistantAllowedPhones: e.target.value })} placeholder="569..., separados por coma o salto de linea" />
                  </label>
                  <button className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400" disabled={savingPhones}>
                    {savingPhones ? 'Guardando...' : 'Guardar telefonos'}
                  </button>
                </form>

                <div className="rounded-lg border border-slate-100 p-4">
                  <h3 className="text-lg font-semibold text-slate-900">Conexion Kapso/WhatsApp</h3>
                  <div className="mt-4 grid gap-3">
                    {selectedDetail.whatsappConnections?.map((connection) => (
                      <div key={connection.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">{connection.status}</span>
                          <span className="text-slate-500">{formatDate(connection.updatedAt)}</span>
                        </div>
                        <div className="mt-2 break-all text-slate-600">Phone number id: {connection.phoneNumberId || '-'}</div>
                        <div className="mt-1 text-slate-500">Display: {connection.displayPhone || '-'} / {connection.connectionType || 'sin tipo'}</div>
                        {connection.lastError && <div className="mt-2 break-words text-red-600">{connection.lastError}</div>}
                      </div>
                    ))}
                    {selectedDetail.whatsappConnections?.length === 0 && <div className="text-sm text-slate-500">Sin conexion registrada.</div>}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <AdminDetailList title="Ultimos contactos" rows={selectedDetail.contacts || []} empty="Sin contactos" render={(row) => (
                  <div>
                    <div className="font-semibold text-slate-900">{row.fullName || 'Sin nombre'}</div>
                    <div className="text-slate-500">{row.phone || '-'} {row.source ? `- ${row.source}` : ''}</div>
                  </div>
                )} />

                <AdminDetailList title="Conversaciones recientes" rows={selectedDetail.conversations || []} empty="Sin conversaciones" render={(row) => (
                  <div>
                    <div className="font-semibold text-slate-900">{row.contactName || row.contactPhone}</div>
                    <div className="text-slate-500">{row.lastMessage?.text || row.lastMessage?.type || 'Sin mensajes'} - {formatDate(row.lastMessageAt)}</div>
                  </div>
                )} />

                <AdminDetailList title="Cotizaciones recientes" rows={selectedDetail.quotes || []} empty="Sin cotizaciones" render={(row) => (
                  <div>
                    <div className="font-semibold text-slate-900">{row.title}</div>
                    <div className="text-slate-500">{row.contact?.fullName || row.contact?.phone || 'Sin cliente'} - {row.status} - ${Number(row.amount || 0).toLocaleString('es-CL')}</div>
                  </div>
                )} />

                <AdminDetailList title="Atenciones recientes" rows={selectedDetail.attendances || []} empty="Sin atenciones" render={(row) => (
                  <div>
                    <div className="font-semibold text-slate-900">{row.title}</div>
                    <div className="text-slate-500">{row.contact?.fullName || row.contact?.phone || 'Sin cliente'} - ${Number(row.amount || 0).toLocaleString('es-CL')}</div>
                  </div>
                )} />
              </div>

              <div className="mt-5 rounded-lg border border-slate-100 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Auditoria reciente</h3>
                    <p className="mt-1 text-sm text-slate-500">Eventos de cuenta, invitaciones, demo, WhatsApp y sistema.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['Todos', 'Cuenta', 'Invitacion', 'WhatsApp', 'Demo', 'Sistema'].map((category) => (
                      <button
                        key={category}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold ${auditFilter === category ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                        onClick={() => setAuditFilter(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  {(selectedDetail.auditLogs || []).filter((row) => auditFilter === 'Todos' || row.category === auditFilter).map((row) => (
                    <div key={row.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">{row.category || 'Sistema'}</span>
                          <span className="font-semibold text-slate-900">{row.eventType || row.action}</span>
                        </div>
                        <span className="text-slate-500">{formatDate(row.createdAt)}</span>
                      </div>
                      <div className="mt-1 text-slate-500">{row.summary || row.result?.command || row.result?.reason || (row.result?.processed === true ? 'Procesado' : '-')}</div>
                    </div>
                  ))}
                  {(selectedDetail.auditLogs || []).filter((row) => auditFilter === 'Todos' || row.category === auditFilter).length === 0 && <div className="text-sm text-slate-500">Sin eventos recientes para este filtro.</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OnboardingPage({ setPage }) {
  const [professional, setProfessional] = useState(null);
  const [status, setStatus] = useState(null);
  const [realStart, setRealStart] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({});
  const [realContactForm, setRealContactForm] = useState({ fullName: '', phone: '', notes: '' });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [creatingRealContact, setCreatingRealContact] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  async function load() {
    const [profile, kapsoStatus, templateRows, realStartData] = await Promise.all([
      api('/professionals/me'),
      api('/kapso/status'),
      api('/message-templates'),
      api('/professionals/real-start')
    ]);
    setProfessional(profile);
    setStatus(kapsoStatus);
    setRealStart(realStartData);
    setTemplates(templateRows);
    setForm({
      displayName: profile?.displayName || '',
      profession: profile?.profession || '',
      phone: profile?.phone || '',
      assistantAllowedPhones: profile?.assistantAllowedPhones || '',
      email: profile?.email || '',
      timezone: profile?.timezone || 'America/Santiago',
      currency: profile?.currency || 'CLP'
    });
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api('/professionals/me', {
        method: 'PATCH',
        body: JSON.stringify(form)
      });
      await load();
      setMessage('Datos guardados. Ya puedes enviar un comando de prueba.');
    } catch (err) {
      setMessage('No se pudo guardar. Revisa los datos e intenta nuevamente.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function prepareTemplates() {
    setMessage('');
    try {
      await api('/message-templates/defaults', { method: 'POST', body: JSON.stringify({}) });
      await load();
      setMessage('Mensajes base listos.');
    } catch (err) {
      setMessage('No se pudieron preparar los mensajes base.');
      console.error(err);
    }
  }

  async function createRealContact(e) {
    e.preventDefault();
    setCreatingRealContact(true);
    setMessage('');
    try {
      await api('/contacts', {
        method: 'POST',
        body: JSON.stringify({
          fullName: realContactForm.fullName,
          phone: realContactForm.phone,
          source: 'Manual',
          notes: realContactForm.notes || 'Primer cliente real creado desde onboarding.'
        })
      });
      setRealContactForm({ fullName: '', phone: '', notes: '' });
      await load();
      setMessage('Cliente real creado. Ahora puedes preparar una cotizacion o iniciar conversacion.');
    } catch (err) {
      setMessage('No se pudo crear el cliente real.');
      console.error(err);
    } finally {
      setCreatingRealContact(false);
    }
  }

  async function copyText(value, label) {
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    setMessage(`${label} copiado.`);
  }

  const fluxioPhone = status?.fluxioPhone || '';
  const fluxioPhoneDigits = String(fluxioPhone).replace(/[^\d]/g, '');
  const commandPhone = form.assistantAllowedPhones || form.phone || '';
  const activeTemplates = templates.filter((item) => item.active).length;
  const fallbackSteps = [
    {
      title: 'Completa tu perfil',
      done: Boolean(form.displayName && form.profession && form.phone),
      description: 'Nombre, profesion y telefono de trabajo.'
    },
    {
      title: 'Indica tu WhatsApp de trabajo',
      done: Boolean(commandPhone),
      description: 'Usaremos ese numero solo para reconocer tus comandos.'
    },
    {
      title: 'Guarda el numero Fluxio',
      done: Boolean(fluxioPhone),
      description: 'Es el chat al que le escribiras comandos privados.'
    },
    {
      title: 'Envia tu primer comando',
      done: Boolean(status?.hasReceivedFirstMessage),
      description: 'Escribe menu al numero Fluxio desde tu WhatsApp de trabajo.'
    },
    {
      title: 'Mensajes base listos',
      done: activeTemplates >= 4,
      description: 'Cotizacion, cobro, recordatorio y confirmacion.'
    }
  ];
  const steps = status?.activationChecklist?.length ? status.activationChecklist : fallbackSteps;
  const completed = steps.filter((step) => step.done).length;
  const nextStep = steps.find((step) => !step.done);
  const realSteps = realStart?.steps || [];
  const nextRealStep = realStart?.nextStep;
  const commandGuide = [
    { title: 'Ver menu', command: 'menu', description: 'Muestra las opciones disponibles.' },
    { title: 'Registrar atencion', command: 'Registrar atencion: Juan Perez, curacion, $30000, transferencia', description: 'Crea cliente si falta, atencion e ingreso asociado.' },
    { title: 'Cotizar', command: 'Cotizar: Ana Perez, curacion a domicilio, $25000', description: 'Prepara una cotizacion y pide confirmacion antes de enviarla.' },
    { title: 'Agenda', command: 'Agendar: Ana Perez, curacion, manana 10:00', description: 'Registra un servicio agendado.' },
    { title: 'Cobro', command: 'Pago: Ana Perez, $25000, transferencia', description: 'Marca pagos o ayuda a revisar pendientes de cobro.' },
    { title: 'Pendientes', command: 'Pendientes de cobro', description: 'Lista cobros o cotizaciones pendientes.' }
  ];

  if (!professional || !status || !realStart) return <div>Cargando primeros pasos...</div>;

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Primeros pasos</h1>
          <p className="mt-1 max-w-2xl text-slate-500">Deja listo tu asistente para probar el flujo completo por WhatsApp.</p>
        </div>
        <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={load}>
          Actualizar
        </button>
      </div>

      {message && <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Configuracion inicial</h2>
              <p className="mt-1 text-sm text-slate-500">{completed} de {steps.length} pasos completados.</p>
            </div>
            <span className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold ${status.ready ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
              {status.statusLabel}
            </span>
          </div>
          {nextStep && (
            <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              <div className="font-semibold">Siguiente paso: {nextStep.title}</div>
              <div className="mt-1">{nextStep.description}</div>
            </div>
          )}

          <div className="mt-5 grid gap-3">
            {steps.map((step) => (
              <div key={step.title} className="flex items-start gap-3 rounded-lg border border-slate-100 p-4">
                <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                  <CheckCircle size={17} />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{step.title}</div>
                  <div className="mt-1 text-sm text-slate-500">{step.description}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Numero Fluxio</div>
              <div className="mt-2 break-all text-2xl font-bold text-slate-900">{fluxioPhone || 'Pendiente'}</div>
              <div className="mt-2 text-sm text-slate-500">Escribe tus comandos privados a este WhatsApp.</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => copyText(fluxioPhone, 'Numero Fluxio')} disabled={!fluxioPhone}>
                  <Clipboard size={16} />
                  Copiar
                </button>
                {fluxioPhoneDigits && (
                  <a className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700" href={`https://wa.me/${fluxioPhoneDigits}?text=menu`} target="_blank">
                    <Send size={16} />
                    Abrir WhatsApp
                  </a>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Prueba recomendada</div>
              <code className="mt-2 block rounded-lg bg-white p-3 text-sm text-slate-800 ring-1 ring-slate-100">menu</code>
              <div className="mt-3 text-sm text-slate-500">Envialo desde tu WhatsApp de trabajo. Si Fluxio responde, ya puedes usar comandos como cotizar, cobrar o registrar atenciones.</div>
              <button className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => copyText('menu', 'Comando')}>
                <Clipboard size={16} />
                Copiar comando
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Card title="Estado" value={status.statusLabel} subtitle={status.lastActivityAt ? `Ultima actividad: ${formatDate(status.lastActivityAt)}` : 'Aun no recibimos mensajes'} />
          <Card title="Activacion" value={`${completed}/${steps.length}`} subtitle={nextStep ? `Pendiente: ${nextStep.title}` : 'Lista para demo'} />
          <Card title="Mensajes activos" value={activeTemplates} subtitle="Plantillas listas para usar" />
          <Card title="Telefonos autorizados" value={status.commandPhones?.length || 0} subtitle="Numeros que pueden enviar comandos" />
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Guia rapida WhatsApp</h2>
            <p className="mt-1 text-sm text-slate-500">Comandos utiles para operar Fluxio sin entrar a la plataforma durante el dia.</p>
          </div>
          {fluxioPhoneDigits && (
            <a className="inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700" href={`https://wa.me/${fluxioPhoneDigits}?text=menu`} target="_blank">
              <Send size={16} />
              Probar menu
            </a>
          )}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {commandGuide.map((item) => (
            <div key={item.title} className="rounded-lg border border-slate-100 p-4">
              <div className="font-semibold text-slate-900">{item.title}</div>
              <div className="mt-1 text-sm text-slate-500">{item.description}</div>
              <code className="mt-3 block rounded-lg bg-slate-50 p-3 text-xs text-slate-800">{item.command}</code>
              <button className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => copyText(item.command, item.title)}>
                <Clipboard size={14} />
                Copiar
              </button>
            </div>
          ))}
        </div>
      </div>

      <form className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100" onSubmit={saveProfile}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Tus datos</h2>
            <p className="mt-1 text-sm text-slate-500">Estos datos ayudan a personalizar comandos y mensajes.</p>
          </div>
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar datos'}
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Nombre visible
            <input className="mt-1 w-full rounded-lg border p-3" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Profesion
            <input className="mt-1 w-full rounded-lg border p-3" value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Telefono personal/de trabajo
            <input className="mt-1 w-full rounded-lg border p-3" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input className="mt-1 w-full rounded-lg border p-3" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="block text-sm font-medium text-slate-700 md:col-span-2">
            WhatsApp de trabajo para comandos
            <textarea
              className="mt-1 min-h-20 w-full rounded-lg border p-3"
              value={form.assistantAllowedPhones}
              onChange={(e) => setForm({ ...form, assistantAllowedPhones: e.target.value })}
              placeholder="Ejemplo: +56994375379"
            />
            <span className="mt-1 block text-xs text-slate-500">Usaremos este numero solo para reconocer tus comandos cuando escribas al WhatsApp de Fluxio. Tus clientes no veran esos mensajes.</span>
          </label>
        </div>
      </form>

      <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Comandos utiles</h2>
            <p className="mt-1 text-sm text-slate-500">Copia un ejemplo y envialo al numero Fluxio.</p>
          </div>
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={prepareTemplates}>
            Preparar mensajes base
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            'menu',
            'Registrar atencion: Ana Perez, curacion, $25000, transferencia',
            'Cotizar: Ana Perez, curacion a domicilio, $25000',
            'Pendientes de cobro',
            'Pago recibido: Ana Perez, $25000, transferencia',
            'Cobrar a Ana Perez',
            'Agendar: Ana Perez, manana 10:00, control presion, domicilio',
            'Resumen del mes'
          ].map((command) => (
            <button key={command} className="rounded-lg bg-slate-50 p-3 text-left text-sm text-slate-700 hover:bg-slate-100" onClick={() => copyText(command, 'Comando')}>
              <code>{command}</code>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Ya no es demo</div>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Primer cliente real</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">Cuando termines de practicar con Ana Perez, usa este flujo para empezar con un cliente real sin mezclarlo con datos demo.</p>
          </div>
          <span className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold ${realStart.ready ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
            {realStart.completed}/{realStart.total} real
          </span>
        </div>

        {nextRealStep && (
          <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            <div className="font-semibold">Siguiente paso real: {nextRealStep.title}</div>
            <div className="mt-1">{nextRealStep.description}</div>
          </div>
        )}

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="grid gap-3">
              {realSteps.map((step) => (
                <div key={step.key} className="flex items-start gap-3 rounded-lg border border-slate-100 p-4">
                  <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    <CheckCircle size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{step.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {step.done ? 'Completo' : 'Pendiente'}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Card title="Clientes reales" value={realStart.counts?.contacts || 0} />
              <Card title="Cotizaciones reales" value={realStart.counts?.quotes || 0} />
              <Card title="Atenciones reales" value={realStart.counts?.attendances || 0} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800" onClick={() => setPage?.('contacts')}>Ir a clientes reales</button>
              <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setPage?.('quotes')}>Cotizaciones reales</button>
              <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setPage?.('whatsapp')}>WhatsApp real</button>
              <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setPage?.('income')}>Cobros reales</button>
            </div>
          </div>

          <form className="rounded-lg bg-slate-50 p-4" onSubmit={createRealContact}>
            <h3 className="text-lg font-semibold text-slate-900">Crear primer cliente real</h3>
            <p className="mt-1 text-sm text-slate-500">Este registro queda como real. No se marca como Fluxio Demo.</p>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Nombre cliente
              <input className="mt-1 w-full rounded-lg border bg-white p-3" value={realContactForm.fullName} onChange={(e) => setRealContactForm({ ...realContactForm, fullName: e.target.value })} placeholder="Ejemplo: Maria Lopez" required />
            </label>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              WhatsApp cliente
              <input className="mt-1 w-full rounded-lg border bg-white p-3" value={realContactForm.phone} onChange={(e) => setRealContactForm({ ...realContactForm, phone: e.target.value })} placeholder="+569..." />
            </label>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Nota inicial
              <textarea className="mt-1 min-h-20 w-full rounded-lg border bg-white p-3" value={realContactForm.notes} onChange={(e) => setRealContactForm({ ...realContactForm, notes: e.target.value })} placeholder="Que necesita, comuna, horario, observaciones..." />
            </label>
            <button className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400" disabled={creatingRealContact}>
              {creatingRealContact ? 'Creando...' : 'Crear cliente real'}
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <button className="text-sm font-semibold text-slate-700" onClick={() => setShowSupport((value) => !value)}>
          {showSupport ? 'Ocultar informacion de soporte' : 'Mostrar informacion de soporte'}
        </button>
        {showSupport && (
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="font-semibold text-slate-900">Modo interno</div>
              <div className="mt-1 text-slate-500">{status.support?.mode}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="font-semibold text-slate-900">Conexion</div>
              <div className="mt-1 text-slate-500">{status.connection?.status || 'sin conexion'}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="font-semibold text-slate-900">Ultimo error</div>
              <div className="mt-1 break-words text-slate-500">{status.connection?.lastError || 'sin errores recientes'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsPage() {
  const [professional, setProfessional] = useState(null);
  const [profileForm, setProfileForm] = useState({});
  const [templates, setTemplates] = useState([]);
  const [message, setMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingTemplateId, setSavingTemplateId] = useState(null);

  async function load() {
    const [profile, templateRows] = await Promise.all([
      api('/professionals/me'),
      api('/message-templates')
    ]);
    setProfessional(profile);
    setProfileForm({
      displayName: profile?.displayName || '',
      profession: profile?.profession || '',
      phone: profile?.phone || '',
      assistantAllowedPhones: profile?.assistantAllowedPhones || '',
      email: profile?.email || '',
      timezone: profile?.timezone || 'America/Santiago',
      currency: profile?.currency || 'CLP'
    });
    setTemplates(templateRows);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  function updateTemplate(id, patch) {
    setTemplates((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    setMessage('');
    try {
      const updated = await api('/professionals/me', {
        method: 'PATCH',
        body: JSON.stringify(profileForm)
      });
      setProfessional(updated);
      setMessage('Configuracion del profesional guardada.');
    } catch (err) {
      setMessage('No se pudo guardar la configuracion.');
      console.error(err);
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveTemplate(row) {
    setSavingTemplateId(row.id);
    setMessage('');
    try {
      const updated = await api(`/message-templates/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: row.name,
          body: row.body,
          active: row.active
        })
      });
      updateTemplate(row.id, updated);
      setMessage('Plantilla guardada.');
    } catch (err) {
      setMessage('No se pudo guardar la plantilla.');
      console.error(err);
    } finally {
      setSavingTemplateId(null);
    }
  }

  async function ensureDefaults() {
    setMessage('');
    try {
      const rows = await api('/message-templates/defaults', { method: 'POST', body: JSON.stringify({}) });
      setTemplates(rows);
      setMessage('Plantillas base disponibles.');
    } catch (err) {
      setMessage('No se pudieron preparar las plantillas base.');
      console.error(err);
    }
  }

  if (!professional) return <div>Cargando configuracion...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Configuracion</h1>
      <p className="mt-1 text-slate-500">Datos del profesional, numeros autorizados para Fluxio Assistant y mensajes editables.</p>

      {message && <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}

      <form className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100" onSubmit={saveProfile}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Profesional</h2>
            <p className="mt-1 text-sm text-slate-500">Estos datos alimentan el asistente y los mensajes salientes.</p>
          </div>
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400" disabled={savingProfile}>
            {savingProfile ? 'Guardando...' : 'Guardar'}
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Nombre visible
            <input className="mt-1 w-full rounded-lg border p-3" value={profileForm.displayName} onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Profesion
            <input className="mt-1 w-full rounded-lg border p-3" value={profileForm.profession} onChange={(e) => setProfileForm({ ...profileForm, profession: e.target.value })} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Telefono principal
            <input className="mt-1 w-full rounded-lg border p-3" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input className="mt-1 w-full rounded-lg border p-3" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Zona horaria
            <input className="mt-1 w-full rounded-lg border p-3" value={profileForm.timezone} onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Moneda
            <input className="mt-1 w-full rounded-lg border p-3" value={profileForm.currency} onChange={(e) => setProfileForm({ ...profileForm, currency: e.target.value })} />
          </label>
          <label className="block text-sm font-medium text-slate-700 md:col-span-2">
            Telefonos autorizados para Fluxio Assistant
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border p-3"
              value={profileForm.assistantAllowedPhones}
              onChange={(e) => setProfileForm({ ...profileForm, assistantAllowedPhones: e.target.value })}
              placeholder="56994375379, 569..."
            />
            <span className="mt-1 block text-xs text-slate-500">Puedes separar numeros por coma, espacio o salto de linea. Los mensajes desde esos numeros se interpretan como comandos internos.</span>
          </label>
        </div>
      </form>

      <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Plantillas de mensajes</h2>
            <p className="mt-1 text-sm text-slate-500">Variables disponibles: {'{{cliente}}'}, {'{{servicio}}'}, {'{{monto}}'}, {'{{fecha}}'}, {'{{detalle}}'}.</p>
          </div>
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={ensureDefaults}>
            Preparar base
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          {templates.map((template) => (
            <div key={template.id} className="rounded-lg border border-slate-100 p-4">
              <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                <label className="block text-sm font-medium text-slate-700">
                  Nombre
                  <input className="mt-1 w-full rounded-lg border p-3" value={template.name || ''} onChange={(e) => updateTemplate(template.id, { name: e.target.value })} />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Estado
                  <select className="mt-1 w-full rounded-lg border p-3" value={template.active ? 'active' : 'inactive'} onChange={(e) => updateTemplate(template.id, { active: e.target.value === 'active' })}>
                    <option value="active">Activa</option>
                    <option value="inactive">Inactiva</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{template.key}</div>
              <textarea className="mt-2 min-h-36 w-full rounded-lg border p-3 text-sm" value={template.body || ''} onChange={(e) => updateTemplate(template.id, { body: e.target.value })} />
              <div className="mt-3 flex justify-end">
                <button
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
                  onClick={() => saveTemplate(template)}
                  disabled={savingTemplateId === template.id}
                >
                  {savingTemplateId === template.id ? 'Guardando...' : 'Guardar plantilla'}
                </button>
              </div>
            </div>
          ))}
          {templates.length === 0 && <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Sin plantillas configuradas.</div>}
        </div>
      </div>
    </div>
  );
}

function QuickActionMenu({ onAction }) {
  const [open, setOpen] = useState(false);
  const actions = [
    { key: 'contact', icon: Users, title: 'Nuevo cliente', description: 'Registrar datos de contacto' },
    { key: 'appointment', icon: Calendar, title: 'Agendar servicio', description: 'Abrir la agenda' },
    { key: 'attendance', icon: WalletCards, title: 'Registrar atencion', description: 'Crear desde un lead o cotizacion' },
    { key: 'quote', icon: FileText, title: 'Preparar cotizacion', description: 'Revisar oportunidades y cotizaciones' },
    { key: 'lead', icon: TrendingUp, title: 'Nuevo lead', description: 'Registrar una oportunidad' },
    { key: 'expense', icon: DollarSign, title: 'Registrar gasto', description: 'Ingresar un gasto operativo' },
    { key: 'whatsapp', icon: MessageCircle, title: 'Responder WhatsApp', description: 'Abrir conversaciones' }
  ];

  function choose(key) {
    onAction(key);
    setOpen(false);
  }

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <div className="mb-3 w-[min(340px,calc(100vw-40px))] rounded-lg bg-white p-3 shadow-2xl ring-1 ring-slate-200">
          <div className="px-2 pb-2 text-sm font-semibold text-slate-900">Nueva accion</div>
          <div className="grid gap-1">
            {actions.map(({ key, icon: Icon, title, description }) => (
              <button key={key} className="flex items-center gap-3 rounded-lg p-3 text-left hover:bg-slate-50" onClick={() => choose(key)}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Icon size={18} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{title}</span>
                  <span className="block text-xs text-slate-500">{description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <button className="ml-auto flex h-14 items-center gap-2 rounded-lg bg-emerald-600 px-4 font-semibold text-white shadow-lg hover:bg-emerald-700" onClick={() => setOpen((value) => !value)} title={open ? 'Cerrar acciones' : 'Nueva accion'}>
        {open ? <X size={20} /> : <Plus size={20} />}
        <span className="hidden sm:inline">{open ? 'Cerrar' : 'Nueva accion'}</span>
      </button>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return { ok: true };
    }
  });
  const [page, setPage] = useState('dashboard');
  const [createContactRequest, setCreateContactRequest] = useState(0);
  const [createAppointmentRequest, setCreateAppointmentRequest] = useState(0);
  const [createAttendanceRequest, setCreateAttendanceRequest] = useState(0);
  const [createQuoteRequest, setCreateQuoteRequest] = useState(0);
  const [createLeadRequest, setCreateLeadRequest] = useState(0);
  const [createExpenseRequest, setCreateExpenseRequest] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    api('/auth/me')
      .then((data) => {
        localStorage.setItem('user', JSON.stringify(data));
        setUser(data);
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      });
  }, []);

  if (!user) return <Login onLogin={setUser} />;

  function handleQuickAction(action) {
    if (action === 'contact') {
      setCreateContactRequest((value) => value + 1);
      setPage('contacts');
      return;
    }
    if (action === 'appointment') {
      setCreateAppointmentRequest((value) => value + 1);
      setPage('appointments');
    }
    if (action === 'attendance') {
      setCreateAttendanceRequest((value) => value + 1);
      setPage('attendances');
    }
    if (action === 'quote') {
      setCreateQuoteRequest((value) => value + 1);
      setPage('quotes');
    }
    if (action === 'lead') {
      setCreateLeadRequest((value) => value + 1);
      setPage('leads');
    }
    if (action === 'expense') {
      setCreateExpenseRequest((value) => value + 1);
      setPage('expenses');
    }
    if (action === 'whatsapp') setPage('whatsapp');
  }

  const content = {
    onboarding: <OnboardingPage setPage={setPage} />,
    dashboard: <Dashboard setPage={setPage} onQuickAction={handleQuickAction} />,
    demo: <DemoModePage setPage={setPage} />,
    leads: <LeadsPage createRequest={createLeadRequest} />,
    quotes: <QuotesPage createRequest={createQuoteRequest} />,
    contacts: <ContactsPage createRequest={createContactRequest} />,
    appointments: <AppointmentsPage createRequest={createAppointmentRequest} />,
    attendances: <AttendancesPage createRequest={createAttendanceRequest} />,
    income: <EditableRecordsPage title="Ingresos" endpoint="/income" fields={[
      {key:'description',label:'Descripcion', editable: true},
      {key:'attendance',label:'Atencion', render: (row) => row.attendance?.title || '-'},
      {key:'client',label:'Cliente', render: (row) => row.contact?.fullName || row.attendance?.contact?.fullName || row.contact?.phone || row.attendance?.contact?.phone || '-'},
      {key:'amount',label:'Monto', type: 'number', editable: true, render: (row) => `$${Number(row.amount || 0).toLocaleString('es-CL')}`},
      {key:'paymentStatus',label:'Estado', editable: true, options: ['PAID', 'PENDING', 'PARTIAL']},
      {key:'paymentMethod',label:'Metodo', editable: true, options: ['CASH', 'TRANSFER', 'CARD', 'OTHER']},
      {key:'createdAt',label:'Fecha', render: (row) => formatDate(row.createdAt)}
    ]} />,
    expenses: <ExpensesPage createRequest={createExpenseRequest} />,
    evidence: <EvidencePage />,
    whatsapp: <WhatsAppPage />,
    events: <EventsPage />,
    settings: <SettingsPage />,
    admin: user?.isPlatformAdmin ? <PlatformAdminPage /> : <Dashboard setPage={setPage} onQuickAction={handleQuickAction} />
  }[page];

  return (
    <div className="min-h-screen md:flex">
      <Sidebar page={page} setPage={setPage} user={user} />
      <main className="min-w-0 flex-1 p-4 pb-24 md:p-8 md:pb-24 xl:p-10">{content}</main>
      <QuickActionMenu onAction={handleQuickAction} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
