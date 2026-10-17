import ServicesPanel from './services-panel';
import DeleteConfirmation from '@/components/delete-confirmation';
import IntegrationsPanel, { IntegrationUnlock } from './integrations-panel';
import BookingCalendar from './booking-calendar';
import BookingSchedulePanel from './booking-schedule-panel';
import SettingsPanel from './settings-panel';
import ContactReply from './contact-reply';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  ImagePlus,
  LoaderCircle,
  LogIn,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Search,
  Star,
  Settings,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  customFetch,
  getGetAvailabilityQueryKey,
  getGetAdminSummaryQueryKey,
  getListApprovedReviewsQueryKey,
  getListAdminContactMessagesQueryKey,
  getListAdminAppointmentsQueryKey,
  getListAdminReviewsQueryKey,
  getListBlockedSlotsQueryKey,
  getListPortfolioQueryKey,
  useCreateBlockedSlot,
  useDeleteBlockedSlot,
  useDeletePortfolioItem,
  useGetAdminSummary,
  useListAdminAppointments,
  useListAdminContactMessages,
  useListAdminReviews,
  useListBlockedSlots,
  useListPortfolio,
  useModerateReview,
  useUpdateAppointment,
  type BlockedSlot,
} from '@workspace/api-client-react';
import { calendarDateKey, formatCalendarDate } from '@/lib/date-format';

type AdminTab = 'services' | 'integrations' | 'settings' | 'appointments' | 'reviews' | 'availability' | 'messages';
type AppointmentStatusFilter = '' | 'pending' | 'approved' | 'cancelled' | 'completed';

const statusText: Record<string, string> = {
  pending: 'Ausstehend',
  approved: 'Bestätigt',
  cancelled: 'Storniert',
  completed: 'Abgeschlossen',
  rejected: 'Abgelehnt',
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-xs font-semibold text-muted-foreground"><span>{label}</span>{children}</label>;
}

function AdminPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminTab>('appointments');
  const [integrationPrompt, setIntegrationPrompt] = useState(false);
  const [integrationGrant, setIntegrationGrant] = useState<{ token: string; expires: number } | null>(null);
  const lockIntegrations = () => {
    if (integrationGrant) void import('@workspace/api-client-react').then(({ customFetch }) => customFetch('/api/admin/integrations/lock', { method: 'POST', headers: { 'X-Integrations-Token': integrationGrant.token } })).catch(() => {});
    setIntegrationGrant(null); setTab('appointments');
  };
  useEffect(() => {
    if (!integrationGrant) return;
    const timer = window.setTimeout(() => { setIntegrationGrant(null); setTab('appointments'); }, Math.max(0, integrationGrant.expires - Date.now()));
    return () => window.clearTimeout(timer);
  }, [integrationGrant]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [appointmentFilter, setAppointmentFilter] = useState<AppointmentStatusFilter>('');
  const [reviewFilter, setReviewFilter] = useState<'' | 'approved' | 'pending' | 'rejected'>('');
  const [reviewSearch, setReviewSearch] = useState('');
  const reviewParams = useMemo(() => ({}), []);
  const appointmentParams = useMemo(() => appointmentFilter ? { status: appointmentFilter } : {}, [appointmentFilter]);
  const summaryQuery = useGetAdminSummary();
  const appointmentsQuery = useListAdminAppointments(appointmentParams, {
    query: { queryKey: getListAdminAppointmentsQueryKey(appointmentParams) },
  });
  const reviewsQuery = useListAdminReviews(reviewParams, {
    query: { queryKey: getListAdminReviewsQueryKey(reviewParams), refetchInterval: 30000 },
  });
  const contactMessagesQuery = useListAdminContactMessages({
    query: { queryKey: getListAdminContactMessagesQueryKey() },
  });
  const blockedQuery = useListBlockedSlots();
  const updateAppointment = useUpdateAppointment();
  const moderateReview = useModerateReview();
  const createBlockedSlot = useCreateBlockedSlot();
  const deleteBlockedSlot = useDeleteBlockedSlot();

  const [blockSuccess, setBlockSuccess] = useState('');
  const [lastBlockForm, setLastBlockForm] = useState<'day' | 'time' | null>(null);
  const [portfolioSuccess, setPortfolioSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const reviews = reviewsQuery.data ?? [];
  const approvedReviews = reviews.filter((review) => review.status === 'approved');
  const pendingReviews = reviews.filter((review) => review.status === 'pending');
  const averageRating = approvedReviews.length
    ? (approvedReviews.reduce((total, review) => total + review.rating, 0) / approvedReviews.length).toFixed(1)
    : '—';
  const visibleReviews = reviews.filter((review) =>
    (!reviewFilter || review.status === reviewFilter) &&
    `${review.customerName} ${review.carModel} ${review.comment}`.toLocaleLowerCase('de-DE').includes(reviewSearch.trim().toLocaleLowerCase('de-DE')),
  );

  const invalidateAdmin = () => {
    void queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListAdminAppointmentsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListAdminAppointmentsQueryKey(appointmentParams) });
    void queryClient.invalidateQueries({ queryKey: getListAdminReviewsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListAdminReviewsQueryKey(reviewParams) });
    void queryClient.invalidateQueries({ queryKey: getListAdminContactMessagesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListBlockedSlotsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListPortfolioQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetAvailabilityQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListApprovedReviewsQueryKey() });
  };

  const errorStatus = [summaryQuery.error, appointmentsQuery.error, reviewsQuery.error, blockedQuery.error, contactMessagesQuery.error]
    .map((error) => (error as { status?: number; statusCode?: number } | null)?.status ?? (error as { statusCode?: number } | null)?.statusCode)
    .find((status) => status === 401 || status === 403);
  const queries = [summaryQuery, appointmentsQuery, reviewsQuery, blockedQuery, contactMessagesQuery];
  const loading = queries.some((query) => query.isLoading);
  const anyError = queries.some((query) => query.isError);

  const handleAppointmentStatus = (id: number, status: 'approved' | 'cancelled' | 'completed') => {
    setActionError('');
    updateAppointment.mutate({ id, data: { status } }, {
      onSuccess: invalidateAdmin,
      onError: () => setActionError('Die Änderung konnte nicht gespeichert werden. Prüfen Sie Ihre Berechtigung und versuchen Sie es erneut.'),
    });
  };

  const handleAppointmentReschedule = (event: FormEvent<HTMLFormElement>, id: number) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setActionError('');
    updateAppointment.mutate({
      id,
      data: {
        appointmentDate: new Date(`${String(form.get('rescheduleDate'))}T00:00:00Z`).toISOString(),
        appointmentTime: String(form.get('rescheduleTime')),
      },
    }, {
      onSuccess: invalidateAdmin,
      onError: () => setActionError('Der Termin konnte nicht verschoben werden. Die Uhrzeit ist möglicherweise bereits belegt.'),
    });
  };

  const handleModerate = (id: number, status: 'approved' | 'rejected') => {
    setActionError('');
    moderateReview.mutate({ id, data: { status } }, {
      onSuccess: invalidateAdmin,
      onError: () => setActionError('Die Freigabe konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.'),
    });
  };

  const submitBlockedDay = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setActionError('');
    setBlockSuccess('');
    setLastBlockForm('day');
    createBlockedSlot.mutate({
      data: {
        date: String(form.get('blockedDate')),
        time: null,
        reason: String(form.get('blockedReason')).trim(),
      },
    }, {
      onSuccess: (block) => {
        queryClient.setQueryData<BlockedSlot[]>(getListBlockedSlotsQueryKey(), (items) => [...(items ?? []).filter(item => item.id !== block.id), block]);
        setBlockSuccess(`Der ${formatCalendarDate(block.date, { day: '2-digit', month: '2-digit', year: 'numeric' })} wurde gesperrt.`);
        formElement.reset();
        invalidateAdmin();
      },
      onError: (error) => setActionError((error as { data?: { error?: string } }).data?.error || 'Der Tag konnte nicht gesperrt werden. Bitte versuchen Sie es erneut.'),
    });
  };

  const submitBlockedTime = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setActionError('');
    setBlockSuccess('');
    setLastBlockForm('time');
    createBlockedSlot.mutate({
      data: {
        date: String(form.get('blockedTimeDate')),
        time: String(form.get('blockedTime')),
        reason: String(form.get('blockedTimeReason')).trim(),
      },
    }, {
      onSuccess: (block) => {
        queryClient.setQueryData<BlockedSlot[]>(getListBlockedSlotsQueryKey(), (items) => [...(items ?? []).filter(item => item.id !== block.id), block]);
        setBlockSuccess(`Der ${formatCalendarDate(block.date, { day: '2-digit', month: '2-digit', year: 'numeric' })} um ${block.time} Uhr wurde gesperrt.`);
        formElement.reset();
        invalidateAdmin();
      },
      onError: (error) => setActionError((error as { data?: { error?: string } }).data?.error || 'Die Uhrzeit konnte nicht gesperrt werden. Bitte versuchen Sie es erneut.'),
    });
  };

  return (
    <main className="admin-page min-h-[100dvh] min-w-0 bg-background text-foreground lg:pl-60"><aside className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-60 lg:flex-col lg:overflow-y-auto">
<div className="flex h-[76px] shrink-0 items-center justify-between border-b border-sidebar-border px-5">
  <Link href="/" className="flex items-center gap-3 py-1 transition-opacity hover:opacity-90" aria-label="Zur Startseite">
    <img
      src={`${import.meta.env.BASE_URL}service-car-logo-light.png`}
      alt="Service Car"
      width={817}
      height={273}
      className="h-10 w-auto object-contain"
    />
  </Link>
  <span className="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">Admin</span>
</div>
              <nav aria-label="Administrationsmenü" className="flex gap-2 overflow-x-auto px-3 py-3 lg:grid lg:overflow-visible lg:py-5">
                <p className="hidden px-3 pb-3 pt-2 lg:block text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/50">VERWALTUNG</p>
                {[
                  { id: 'appointments' as const, label: 'Termine', icon: CalendarDays },
                  { id: 'services' as const, label: 'Leistungen', icon: Wrench },
                  { id: 'reviews' as const, label: 'Bewertungen', icon: MessageSquareText },
                  { id: 'availability' as const, label: 'Verfügbarkeit', icon: Clock3 },
                  { id: 'messages' as const, label: 'Nachrichten', icon: MessageSquareText },
                  { id: 'integrations' as const, label: 'API-Integrationen', icon: ShieldCheck },
                  { id: 'settings' as const, label: 'Einstellungen', icon: Settings },
                ].map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { if (id === 'integrations') { setIntegrationGrant(null); setIntegrationPrompt(true); } else { setIntegrationGrant(null); setTab(id); } }} aria-current={tab === id ? 'page' : undefined} className={`flex w-auto shrink-0 items-center gap-3 whitespace-nowrap rounded-lg border-l-2 lg:w-full px-3 py-3 text-left text-xs font-bold transition-colors ${tab === id ? 'border-sidebar-primary bg-sidebar-primary text-white' : 'border-transparent text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`} data-testid={`tab-${id}`}><Icon size={17} />{label}</button>)}
              </nav>
<div className="mt-auto flex border-t border-sidebar-border px-3 py-1 lg:block lg:p-4"><Link href="/" className="flex items-center gap-3 px-3 py-3 text-xs text-sidebar-foreground/65"><ArrowLeft size={16}/>Zur Website</Link><button onClick={async () => { const result = await supabase?.auth.signOut(); if(result?.error) { setActionError('Die Abmeldung ist fehlgeschlagen.'); return; } queryClient.clear(); window.location.assign(import.meta.env.BASE_URL + 'sign-in'); }} className="flex items-center gap-3 px-3 py-3 text-xs text-sidebar-foreground/65"><LogIn size={16}/>Abmelden</button></div></aside>
<header className="flex h-[76px] items-center justify-between border-b border-border bg-card px-5 lg:px-8"><span className="text-sm text-muted-foreground">Verwaltung</span><span className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={17} className="text-accent"/>Administrator</span></header>

      <div className="min-w-0 px-3 py-5 sm:px-5 sm:py-7 lg:px-8">
        <div className="flex flex-col justify-between gap-5 xl:flex-row md:items-end">
          <div>
            
            <h1 className="font-display text-4xl font-bold uppercase tracking-tight">Verwaltung</h1>
            <p className="mt-4 text-sm text-muted-foreground">Verwalten Sie Termine, Bewertungen und Ihre Website.</p>
          </div>
          <p className="max-w-sm border-l-2 border-accent pl-4 text-xs leading-5 text-muted-foreground">Willkommen in der Verwaltung Ihrer Werkstatt.</p>
        </div>

        {tab === 'integrations' && integrationGrant ? (
          <div className="mt-8"><IntegrationsPanel token={integrationGrant.token} onLock={lockIntegrations} /></div>
        ) : errorStatus ? (
          <section className="mx-auto mt-12 max-w-2xl border border-border bg-card px-6 py-10 text-center shadow-sm">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-accent"><LogIn size={24} /></span>
            <h2 className="mt-5 font-display text-3xl font-bold uppercase">{errorStatus === 403 ? 'Kein Zugriff für dieses Konto' : 'Anmeldung erforderlich'}</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{errorStatus === 403 ? 'Dieses Konto ist nicht für die Verwaltung freigeschaltet. Die Berechtigungen werden serverseitig geprüft.' : 'Dieser Bereich ist privat. Melden Sie sich über Supabase mit dem autorisierten Geschäftskonto an. Eine Anmeldung allein gewährt keine Administratorrechte.'}</p>
            {errorStatus === 401 && <Link href="/sign-in" className="mt-6 inline-flex items-center gap-3 bg-primary px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-primary-foreground" data-testid="link-admin-signin">Anmelden <LogIn size={15} /></Link>}
          </section>
        ) : loading ? (
          <section className="mt-10" aria-label="Verwaltung wird geladen">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse border border-border bg-card" />)}</div>
            <div className="mt-6 h-72 animate-pulse border border-border bg-card" />
          </section>
        ) : anyError ? (
          <section className="mt-10 border border-destructive/30 bg-card p-8" role="alert">
            <div className="flex items-start gap-3"><CircleAlert className="text-destructive" /><div><h2 className="font-display text-2xl font-bold uppercase">Die Daten konnten nicht geladen werden</h2><p className="mt-2 text-sm text-muted-foreground">Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.</p></div></div>
            <button type="button" onClick={() => { void summaryQuery.refetch(); void appointmentsQuery.refetch(); void reviewsQuery.refetch(); void blockedQuery.refetch(); void contactMessagesQuery.refetch(); }} className="mt-5 border border-border px-4 py-2 text-xs font-bold" data-testid="button-retry-admin">Erneut versuchen</button>
          </section>
        ) : (
          <>
            <div className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {[
                { label: 'Offene Terminanfragen', value: summaryQuery.data?.pendingAppointments ?? 0, icon: CalendarDays },
                { label: 'Termine insgesamt', value: summaryQuery.data?.totalAppointments ?? 0, icon: Wrench },
                { label: 'Bevorstehend', value: summaryQuery.data?.upcomingAppointments ?? 0, icon: Clock3 },
                { label: 'Offene Bewertungen', value: summaryQuery.data?.pendingReviews ?? 0, icon: MessageSquareText },
                { label: 'Aktive Sperren', value: summaryQuery.data?.blockedSlots ?? 0, icon: X },
              ].map(({ label, value, icon: Icon }) => (
                <article key={label} className="rounded-xl border border-border bg-card p-5 shadow-sm" data-testid={`summary-${label.replaceAll(' ', '-')}`}>
                  <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span><Icon size={16} className="text-accent" /></div>
                  <p className="mt-5 font-display text-4xl font-bold">{value}</p>
                </article>
              ))}
            </div>

            {(actionError || blockSuccess || portfolioSuccess) && (
              <div className={`mt-5 flex items-center justify-between gap-3 border px-4 py-3 text-xs ${actionError ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-emerald-700/20 bg-emerald-700/5 text-emerald-800'}`} role={actionError ? 'alert' : 'status'}>
                <span>{actionError || portfolioSuccess || blockSuccess}</span>
                <button type="button" onClick={() => { setActionError(''); setBlockSuccess(''); setPortfolioSuccess(''); }} aria-label="Meldung schließen"><X size={15} /></button>
              </div>
            )}

            <section className="mt-8 min-w-0">

              <div className="min-w-0 [&>div:first-child]:mt-0">


              {tab === 'services' && <ServicesPanel />}
              {tab === 'settings' && <SettingsPanel />}
              {tab === 'appointments' && (
                <div className="mt-6 overflow-hidden border border-border bg-card">
                  <div className="flex flex-col justify-between gap-4 border-b border-border p-5 sm:flex-row sm:items-center">
                    <div><h2 className="font-display text-2xl font-bold uppercase">Buchungen</h2><p className="mt-1 text-xs text-muted-foreground">Prüfen und bearbeiten Sie die Anfragen Ihrer Kunden.</p></div>
                    <select value={appointmentFilter} onChange={(event) => setAppointmentFilter(event.target.value as AppointmentStatusFilter)} className="h-10 border border-border bg-background px-3 text-xs" data-testid="select-appointment-status">
                      <option value="">Alle Status</option><option value="pending">Ausstehend</option><option value="approved">Bestätigt</option><option value="cancelled">Storniert</option><option value="completed">Abgeschlossen</option>
                    </select>
                  </div>
                  <BookingCalendar appointments={appointmentsQuery.data ?? []} onSelect={setSelectedAppointmentId} />
                  {selectedAppointmentId !== null && <div className="flex items-center justify-between border-t border-border px-5 py-3"><h3 className="text-sm font-bold">Buchungsdetails</h3><button type="button" onClick={() => setSelectedAppointmentId(null)} aria-label="Details schließen"><X size={18} /></button></div>}
                  {selectedAppointmentId !== null && (
                    <div className="overflow-x-auto">
                      <table className="admin-booking-table w-full text-left lg:min-w-[900px]">
                        <thead className="bg-muted/55 text-[9px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-3">Kunde / Fahrzeug</th><th className="px-5 py-3">Leistung</th><th className="px-5 py-3">Termin</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Aktion</th></tr></thead>
                        <tbody className="divide-y divide-border">
                          {appointmentsQuery.data?.filter((appointment) => appointment.id === selectedAppointmentId).map((appointment) => (
                            <tr key={appointment.id} className="align-top" data-testid={`row-appointment-${appointment.id}`}>
                              <td className="px-5 py-4"><p className="text-xs font-bold">{appointment.customerName}</p><p className="mt-1 text-[10px] text-muted-foreground">{appointment.vehicleYear} {appointment.vehicleMake} {appointment.vehicleModel}</p><p className="mt-1 text-[10px] text-muted-foreground">{appointment.phone} · {appointment.email}</p><p className="mt-1 font-mono text-[9px] text-accent">{appointment.referenceCode}</p></td>
                              <td className="px-5 py-4 text-xs">{appointment.customService || appointment.serviceName}{appointment.licensePlate && <p className="mt-1 text-[10px] text-muted-foreground">{appointment.licensePlate}</p>}</td>
                              <td className="px-5 py-4 text-xs">{formatCalendarDate(appointment.appointmentDate, { day: 'numeric', month: 'short', year: 'numeric' })}<p className="mt-1 text-[10px] text-muted-foreground">{appointment.appointmentTime}</p></td>
                              <td className="px-5 py-4"><span className="inline-flex border border-border bg-muted/50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider">{statusText[appointment.status] || appointment.status}</span>{appointment.notes && <p className="mt-2 max-w-[180px] text-[10px] leading-4 text-muted-foreground">{appointment.notes}</p>}</td>
                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                  {appointment.status === 'pending' && <><button type="button" disabled={updateAppointment.isPending} onClick={() => handleAppointmentStatus(appointment.id, 'approved')} className="inline-flex h-8 items-center gap-1 bg-primary px-2.5 text-[9px] font-bold uppercase text-primary-foreground disabled:opacity-50" data-testid={`button-approve-appointment-${appointment.id}`}><Check size={12} /> Bestätigen</button><button type="button" disabled={updateAppointment.isPending} onClick={() => handleAppointmentStatus(appointment.id, 'cancelled')} className="h-8 border border-border px-2.5 text-[9px] font-bold uppercase disabled:opacity-50" data-testid={`button-cancel-appointment-${appointment.id}`}>Abbrechen</button></>}
                                  {appointment.status === 'approved' && <button type="button" disabled={updateAppointment.isPending} onClick={() => handleAppointmentStatus(appointment.id, 'completed')} className="h-8 border border-border px-2.5 text-[9px] font-bold uppercase disabled:opacity-50" data-testid={`button-complete-appointment-${appointment.id}`}>Als abgeschlossen markieren</button>}
                                </div>
                                {(appointment.status === 'pending' || appointment.status === 'approved') && (
                                  <form onSubmit={(event) => handleAppointmentReschedule(event, appointment.id)} className="mt-3 flex flex-wrap justify-end gap-2" data-testid={`form-reschedule-appointment-${appointment.id}`}>
                                    <input required type="date" name="rescheduleDate" defaultValue={calendarDateKey(appointment.appointmentDate)} className="h-8 border border-border bg-background px-2 text-[10px]" aria-label="Neues Datum" />
                                    <input required type="time" name="rescheduleTime" defaultValue={appointment.appointmentTime} className="h-8 border border-border bg-background px-2 text-[10px]" aria-label="Neue Uhrzeit" />
                                    <button type="submit" disabled={updateAppointment.isPending} className="h-8 border border-border px-2.5 text-[9px] font-bold uppercase disabled:opacity-50" data-testid={`button-reschedule-appointment-${appointment.id}`}>Verschieben</button>
                                  </form>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {appointmentsQuery.isError && <p className="p-4 text-xs text-destructive" role="alert">Die Termine konnten nicht geladen werden. <button type="button" onClick={() => void appointmentsQuery.refetch()} className="underline">Erneut versuchen</button></p>}
                </div>
              )}

              {tab === 'messages' && (
                <div className="mt-6 border border-border bg-card">
                  <div className="border-b border-border p-5">
                    <h2 className="font-display text-2xl font-bold uppercase">Kundennachrichten</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Hier finden Sie die Nachrichten aus dem Kontaktformular.</p>
                  </div>
                  {(contactMessagesQuery.data ?? []).length === 0 ? (
                    <div className="px-6 py-14 text-center">
                      <MessageSquareText className="mx-auto text-muted-foreground/50" />
                      <p className="mt-3 text-sm font-semibold">Es gibt keine neuen Nachrichten.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {contactMessagesQuery.data?.map((message) => (
                        <article key={message.id} className="flex flex-col justify-between gap-4 p-5 xl:flex-row" data-testid={`row-contact-message-${message.id}`}>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <h3 className="text-sm font-bold">{message.subject}</h3>
                              <span className="text-[10px] text-muted-foreground">{formatCalendarDate(message.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                            <p className="mt-2 text-xs font-semibold">{message.name}<span className="ml-2 font-normal text-muted-foreground">{message.status === 'replied' ? 'Beantwortet' : message.status === 'new' ? 'Neu' : message.status}</span></p>
                            <a href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`} className="mt-1 inline-block text-xs text-accent underline">{message.email}</a>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{message.message}</p>
                          </div>
                          <ContactReply contact={message} />
                        </article>
                      ))}
                    </div>
                  )}
                  {contactMessagesQuery.isError && <p className="p-4 text-xs text-destructive" role="alert">Die Nachrichten konnten nicht geladen werden. <button type="button" onClick={() => void contactMessagesQuery.refetch()} className="underline">Erneut versuchen</button></p>}
                </div>
              )}

              {tab === 'reviews' && (
                <div className="space-y-6">
                  <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center">
                    <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border border-accent/30 bg-accent/5" aria-label="Durchschnitt der freigegebenen Bewertungen"><span className="text-2xl font-bold">{averageRating}</span><Star size={16} className="mt-1 fill-accent text-accent" /></div>
                    <div><h2 className="text-lg font-bold">Bewertungen und Kundenerfahrungen</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">Insgesamt {reviews.length} Bewertungen ({approvedReviews.length} freigegeben, {pendingReviews.length} ausstehend). Nur freigegebene Bewertungen werden auf der Website angezeigt.</p></div>
                    <Link href="/#vleresime" className="inline-flex shrink-0 justify-center rounded-full border border-border px-4 py-2.5 text-xs font-semibold hover:bg-muted sm:ml-auto">Auf der Website ansehen</Link>
                  </div>
                  <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Bewertungen nach Status filtern">
                      {([{ value: '', label: 'Alle' }, { value: 'approved', label: 'Freigegeben' }, { value: 'pending', label: 'Ausstehend' }, { value: 'rejected', label: 'Abgelehnt' }] as const).map((filter) => <button key={filter.value} type="button" onClick={() => setReviewFilter(filter.value)} aria-pressed={reviewFilter === filter.value} className={`rounded-xl border px-4 py-2.5 text-xs font-semibold transition-colors ${reviewFilter === filter.value ? 'border-accent bg-accent text-accent-foreground shadow-sm' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`} data-testid={`filter-reviews-${filter.value || 'all'}`}>{filter.label} ({reviews.filter((review) => !filter.value || review.status === filter.value).length})</button>)}
                    </div>
                    <label className="flex items-center gap-2 rounded-full border border-border bg-card px-4 xl:w-80"><Search size={16} className="shrink-0 text-muted-foreground" /><input type="search" value={reviewSearch} onChange={(event) => setReviewSearch(event.target.value)} placeholder="Bewertungen suchen…" aria-label="Nach Kunde, Fahrzeug oder Kommentar suchen" className="h-10 w-full min-w-0 bg-transparent text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="input-review-search" /></label>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-left">
                      <thead className="border-b border-border bg-muted/25 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th scope="col" className="px-6 py-4">Kunde / Fahrzeug</th><th scope="col" className="px-6 py-4">Sterne</th><th scope="col" className="w-[40%] px-6 py-4">Kommentar / Erfahrungsbericht</th><th scope="col" className="px-6 py-4">Status</th><th scope="col" className="px-6 py-4 text-right">Aktionen</th></tr></thead>
                      <tbody className="divide-y divide-border">
                        {visibleReviews.map((review) => <tr key={review.id} data-testid={`row-review-${review.id}`} className="hover:bg-muted/15">
                          <td className="px-6 py-5"><p className="text-xs font-bold">{review.customerName}</p><p className="mt-1 text-xs font-medium text-accent">{review.carModel}</p><p className="mt-1 text-[10px] text-muted-foreground">{formatCalendarDate(review.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}</p></td>
                          <td className="px-6 py-5"><div className="flex items-center gap-2" aria-label={`${review.rating} von 5 Sternen`}><span className="flex gap-0.5 text-accent" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} className={index < review.rating ? 'fill-current' : 'opacity-25'} />)}</span><span className="text-xs font-bold">{review.rating.toFixed(1)}</span></div></td>
                          <td className="px-6 py-5"><p className="whitespace-pre-wrap break-words text-xs italic leading-6 text-muted-foreground">“{review.comment}”</p></td>
                          <td className="px-6 py-5"><span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide ${review.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : review.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>{review.status === 'approved' ? 'Freigegeben' : statusText[review.status]}</span></td>
                          <td className="px-6 py-5"><div className="flex justify-end gap-2">
                            {review.status !== 'approved' && <button type="button" disabled={moderateReview.isPending} onClick={() => handleModerate(review.id, 'approved')} title="Bewertung freigeben" aria-label={`Bewertung freigeben von ${review.customerName}`} className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-200 disabled:opacity-50" data-testid={`button-approve-review-${review.id}`}><Check size={15} /></button>}
                            {review.status !== 'rejected' && <button type="button" disabled={moderateReview.isPending} onClick={() => handleModerate(review.id, 'rejected')} title="Bewertung ablehnen" aria-label={`Bewertung ablehnen von ${review.customerName}`} className="grid h-9 w-9 place-items-center rounded-full bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-50" data-testid={`button-reject-review-${review.id}`}><X size={15} /></button>}
                            <DeleteConfirmation title="Bewertung löschen?" description="Diese Bewertung wird dauerhaft entfernt und nicht mehr auf der Website angezeigt." itemLabel={`${review.customerName} · ${review.carModel} · ${review.rating} Sterne`} onConfirm={async () => { await customFetch(`/api/admin/reviews/${review.id}`, { method: 'DELETE' }); invalidateAdmin(); }}><button type="button" disabled={moderateReview.isPending} title="Bewertung löschen" aria-label={`Bewertung löschen von ${review.customerName}`} className="grid h-9 w-9 place-items-center rounded-full bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50" data-testid={`button-delete-review-${review.id}`}><Trash2 size={15} /></button></DeleteConfirmation>
                          </div></td>
                        </tr>)}
                        {visibleReviews.length === 0 && <tr><td colSpan={5} className="px-6 py-16 text-center"><MessageSquareText className="mx-auto text-muted-foreground/50" /><p className="mt-3 text-sm font-semibold">{reviews.length ? 'Keine Bewertung gefunden.' : 'Es gibt noch keine Bewertungen.'}</p><p className="mt-1 text-xs text-muted-foreground">{reviews.length ? 'Versuchen Sie einen anderen Filter oder Suchbegriff.' : 'Die Kundenbewertungen erscheinen hier.'}</p></td></tr>}
                      </tbody>
                    </table>
                  </div></div>
                </div>
              )}
              {tab === 'availability' && <div className="mt-6"><BookingSchedulePanel /></div>}


              </div>
            </section>
          </>
        )}
      </div>
      <IntegrationUnlock open={integrationPrompt} onClose={() => setIntegrationPrompt(false)} onUnlock={(token, expires) => { setIntegrationGrant({ token, expires }); setIntegrationPrompt(false); setTab('integrations'); }} />
    </main>
  );
}

export default AdminPage;





