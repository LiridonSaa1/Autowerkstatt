import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { Link } from 'wouter';
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
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  getGetAvailabilityQueryKey,
  getGetAdminSummaryQueryKey,
  getListApprovedReviewsQueryKey,
  getListAdminContactMessagesQueryKey,
  getListAdminAppointmentsQueryKey,
  getListAdminReviewsQueryKey,
  getListBlockedSlotsQueryKey,
  getListPortfolioQueryKey,
  useCreateBlockedSlot,
  useCreatePortfolioItem,
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
} from '@workspace/api-client-react';
import { calendarDateKey, formatCalendarDate } from '@/lib/date-format';

type AdminTab = 'appointments' | 'reviews' | 'availability' | 'portfolio' | 'messages';
type AppointmentStatusFilter = '' | 'pending' | 'approved' | 'cancelled' | 'completed';

const statusText: Record<string, string> = {
  pending: 'Në pritje',
  approved: 'Konfirmuar',
  cancelled: 'Anuluar',
  completed: 'Përfunduar',
  rejected: 'Refuzuar',
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-xs font-semibold text-muted-foreground">{label}{children}</label>;
}

function AdminPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminTab>('appointments');
  const [appointmentFilter, setAppointmentFilter] = useState<AppointmentStatusFilter>('');
  const reviewParams = useMemo(() => ({ status: 'pending' as const }), []);
  const appointmentParams = useMemo(() => appointmentFilter ? { status: appointmentFilter } : {}, [appointmentFilter]);
  const summaryQuery = useGetAdminSummary();
  const appointmentsQuery = useListAdminAppointments(appointmentParams, {
    query: { queryKey: getListAdminAppointmentsQueryKey(appointmentParams) },
  });
  const reviewsQuery = useListAdminReviews(reviewParams, {
    query: { queryKey: getListAdminReviewsQueryKey(reviewParams) },
  });
  const contactMessagesQuery = useListAdminContactMessages({
    query: { queryKey: getListAdminContactMessagesQueryKey() },
  });
  const blockedQuery = useListBlockedSlots();
  const portfolioQuery = useListPortfolio();
  const updateAppointment = useUpdateAppointment();
  const moderateReview = useModerateReview();
  const createBlockedSlot = useCreateBlockedSlot();
  const deleteBlockedSlot = useDeleteBlockedSlot();
  const createPortfolio = useCreatePortfolioItem();
  const deletePortfolio = useDeletePortfolioItem();
  const [blockSuccess, setBlockSuccess] = useState('');
  const [portfolioSuccess, setPortfolioSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [showPortfolioForm, setShowPortfolioForm] = useState(false);

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
      onError: () => setActionError('Ndryshimi nuk u ruajt. Kontrolloni qasjen dhe provoni përsëri.'),
    });
  };

  const handleAppointmentReschedule = (event: FormEvent<HTMLFormElement>, id: number) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setActionError('');
    updateAppointment.mutate({
      id,
      data: {
        appointmentDate: new Date(`${String(form.get('rescheduleDate'))}T00:00:00Z`),
        appointmentTime: String(form.get('rescheduleTime')),
      },
    }, {
      onSuccess: invalidateAdmin,
      onError: () => setActionError('Termini nuk u zhvendos. Koha mund të jetë zënë tashmë; kontrolloni dhe provoni përsëri.'),
    });
  };

  const handleModerate = (id: number, status: 'approved' | 'rejected') => {
    setActionError('');
    moderateReview.mutate({ id, data: { status } }, {
      onSuccess: invalidateAdmin,
      onError: () => setActionError('Vendimi për vlerësimin nuk u ruajt. Provoni përsëri.'),
    });
  };

  const submitBlockedDay = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setActionError('');
    createBlockedSlot.mutate({
      data: {
        date: String(form.get('blockedDate')),
        time: null,
        reason: String(form.get('blockedReason')),
      },
    }, {
      onSuccess: () => {
        setBlockSuccess('Dita u bllokua.');
        formElement.reset();
        invalidateAdmin();
      },
      onError: () => setActionError('Dita nuk u bllokua. Provoni përsëri.'),
    });
  };

  const submitBlockedTime = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setActionError('');
    createBlockedSlot.mutate({
      data: {
        date: String(form.get('blockedTimeDate')),
        time: String(form.get('blockedTime')),
        reason: String(form.get('blockedTimeReason')),
      },
    }, {
      onSuccess: () => {
        setBlockSuccess('Orari u bllokua.');
        formElement.reset();
        invalidateAdmin();
      },
      onError: () => setActionError('Ora nuk u bllokua. Provoni përsëri.'),
    });
  };

  const submitPortfolio = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setActionError('');
    createPortfolio.mutate({
      data: {
        title: String(form.get('workTitle')),
        category: String(form.get('workCategory')),
        description: String(form.get('workDescription')),
        imageUrl: String(form.get('workImage')),
        vehicleLabel: String(form.get('workVehicle')),
      },
    }, {
      onSuccess: () => {
        setPortfolioSuccess('Puna u shtua në galeri.');
        setShowPortfolioForm(false);
        formElement.reset();
        invalidateAdmin();
      },
      onError: () => setActionError('Puna nuk u shtua. Kontrolloni fushat dhe provoni përsëri.'),
    });
  };

  return (
    <main className="min-h-[100dvh] bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-[76px] max-w-[1480px] items-center justify-between gap-4 px-5 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center bg-primary text-accent"><Wrench size={19} /></span>
            <div>
              <p className="font-display text-xl font-bold uppercase leading-none">Auto Service</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[.22em] text-muted-foreground">Hapësira e punishtes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:flex"><ShieldCheck size={14} className="text-accent" /> Panel i mbrojtur</span>
            <Link href="/" className="inline-flex items-center gap-2 border border-border px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider hover:bg-muted" data-testid="link-public-site"><ArrowLeft size={14} /> Faqja publike</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-5 py-8 lg:px-10 lg:py-12">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <span className="eyebrow text-accent">Qendra e punës</span>
            <h1 className="mt-3 font-display text-5xl font-bold uppercase leading-none md:text-7xl">Përshëndetje,<br className="sm:hidden" /> ekipi.</h1>
            <p className="mt-4 text-sm text-muted-foreground">Menaxhoni terminet, vlerësimet dhe përditësimet e galerisë.</p>
          </div>
          <p className="max-w-sm border-l-2 border-accent pl-4 text-xs leading-5 text-muted-foreground">Qasja në këtë panel kontrollohet nga serveri dhe kufizohet te llogaria e autorizuar e biznesit.</p>
        </div>

        {errorStatus ? (
          <section className="mx-auto mt-12 max-w-2xl border border-border bg-card px-6 py-10 text-center shadow-sm">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-accent"><LogIn size={24} /></span>
            <h2 className="mt-5 font-display text-3xl font-bold uppercase">{errorStatus === 403 ? 'Kjo llogari nuk ka qasje' : 'Identifikimi kërkohet'}</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{errorStatus === 403 ? 'Kjo llogari nuk është e autorizuar për panelin e biznesit. Qasja vendoset nga serveri; identifikimi në vetvete nuk jep privilegje administratori.' : 'Paneli është privat. Hyni përmes Clerk me llogarinë e autorizuar për këtë biznes. Një llogari e identifikuar nuk jep automatikisht të drejta administratori.'}</p>
            {errorStatus === 401 && <Link href="/sign-in" className="mt-6 inline-flex items-center gap-3 bg-primary px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-primary-foreground" data-testid="link-admin-signin">Hyr në llogari <LogIn size={15} /></Link>}
          </section>
        ) : loading ? (
          <section className="mt-10" aria-label="Po ngarkohet paneli">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse border border-border bg-card" />)}</div>
            <div className="mt-6 h-72 animate-pulse border border-border bg-card" />
          </section>
        ) : anyError ? (
          <section className="mt-10 border border-destructive/30 bg-card p-8" role="alert">
            <div className="flex items-start gap-3"><CircleAlert className="text-destructive" /><div><h2 className="font-display text-2xl font-bold uppercase">Të dhënat nuk u ngarkuan</h2><p className="mt-2 text-sm text-muted-foreground">Kontrolloni lidhjen dhe provoni përsëri.</p></div></div>
            <button type="button" onClick={() => { void summaryQuery.refetch(); void appointmentsQuery.refetch(); void reviewsQuery.refetch(); void blockedQuery.refetch(); void contactMessagesQuery.refetch(); }} className="mt-5 border border-border px-4 py-2 text-xs font-bold" data-testid="button-retry-admin">Provo përsëri</button>
          </section>
        ) : (
          <>
            <div className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                { label: 'Termine në pritje', value: summaryQuery.data?.pendingAppointments ?? 0, icon: CalendarDays },
                { label: 'Termine gjithsej', value: summaryQuery.data?.totalAppointments ?? 0, icon: Wrench },
                { label: 'Të ardhshme', value: summaryQuery.data?.upcomingAppointments ?? 0, icon: Clock3 },
                { label: 'Vlerësime në pritje', value: summaryQuery.data?.pendingReviews ?? 0, icon: MessageSquareText },
                { label: 'Bllokime aktive', value: summaryQuery.data?.blockedSlots ?? 0, icon: X },
              ].map(({ label, value, icon: Icon }) => (
                <article key={label} className="border border-border bg-card p-5 shadow-sm" data-testid={`summary-${label.replaceAll(' ', '-')}`}>
                  <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span><Icon size={16} className="text-accent" /></div>
                  <p className="mt-5 font-display text-4xl font-bold">{value}</p>
                </article>
              ))}
            </div>

            {(actionError || blockSuccess || portfolioSuccess) && (
              <div className={`mt-5 flex items-center justify-between gap-3 border px-4 py-3 text-xs ${actionError ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-emerald-700/20 bg-emerald-700/5 text-emerald-800'}`} role={actionError ? 'alert' : 'status'}>
                <span>{actionError || portfolioSuccess || blockSuccess}</span>
                <button type="button" onClick={() => { setActionError(''); setBlockSuccess(''); setPortfolioSuccess(''); }} aria-label="Mbyll mesazhin"><X size={15} /></button>
              </div>
            )}

            <section className="mt-9">
              <div className="flex gap-1 overflow-x-auto border-b border-border">
                {[
                  { id: 'appointments' as const, label: 'Terminet', icon: CalendarDays },
                  { id: 'reviews' as const, label: 'Vlerësimet', icon: MessageSquareText },
                  { id: 'availability' as const, label: 'Disponueshmëria', icon: Clock3 },
                  { id: 'portfolio' as const, label: 'Galeria', icon: ImagePlus },
                  { id: 'messages' as const, label: 'Mesazhet', icon: MessageSquareText },
                ].map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold ${tab === id ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`} data-testid={`tab-${id}`}><Icon size={15} />{label}</button>)}
              </div>

              {tab === 'appointments' && (
                <div className="mt-6 overflow-hidden border border-border bg-card">
                  <div className="flex flex-col justify-between gap-4 border-b border-border p-5 sm:flex-row sm:items-center">
                    <div><h2 className="font-display text-2xl font-bold uppercase">Rezervimet</h2><p className="mt-1 text-xs text-muted-foreground">Shqyrtoni dhe përditësoni kërkesat e klientëve.</p></div>
                    <select value={appointmentFilter} onChange={(event) => setAppointmentFilter(event.target.value as AppointmentStatusFilter)} className="h-10 border border-border bg-background px-3 text-xs" data-testid="select-appointment-status">
                      <option value="">Të gjitha gjendjet</option><option value="pending">Në pritje</option><option value="approved">Konfirmuar</option><option value="cancelled">Anuluar</option><option value="completed">Përfunduar</option>
                    </select>
                  </div>
                  {(appointmentsQuery.data ?? []).length === 0 ? (
                    <div className="px-6 py-14 text-center"><CalendarDays className="mx-auto text-muted-foreground/50" /><p className="mt-3 text-sm font-semibold">Nuk ka termine për t'u shfaqur.</p><p className="mt-1 text-xs text-muted-foreground">Kërkesat e reja do të shfaqen këtu.</p></div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] text-left">
                        <thead className="bg-muted/55 text-[9px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-3">Klienti / makina</th><th className="px-5 py-3">Shërbimi</th><th className="px-5 py-3">Termini</th><th className="px-5 py-3">Gjendja</th><th className="px-5 py-3 text-right">Veprimi</th></tr></thead>
                        <tbody className="divide-y divide-border">
                          {appointmentsQuery.data?.map((appointment) => (
                            <tr key={appointment.id} className="align-top" data-testid={`row-appointment-${appointment.id}`}>
                              <td className="px-5 py-4"><p className="text-xs font-bold">{appointment.customerName}</p><p className="mt-1 text-[10px] text-muted-foreground">{appointment.vehicleYear} {appointment.vehicleMake} {appointment.vehicleModel}</p><p className="mt-1 text-[10px] text-muted-foreground">{appointment.phone} · {appointment.email}</p><p className="mt-1 font-mono text-[9px] text-accent">{appointment.referenceCode}</p></td>
                              <td className="px-5 py-4 text-xs">{appointment.customService || appointment.serviceName}{appointment.licensePlate && <p className="mt-1 text-[10px] text-muted-foreground">{appointment.licensePlate}</p>}</td>
                              <td className="px-5 py-4 text-xs">{formatCalendarDate(appointment.appointmentDate, { day: 'numeric', month: 'short', year: 'numeric' })}<p className="mt-1 text-[10px] text-muted-foreground">{appointment.appointmentTime}</p></td>
                              <td className="px-5 py-4"><span className="inline-flex border border-border bg-muted/50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider">{statusText[appointment.status] || appointment.status}</span>{appointment.notes && <p className="mt-2 max-w-[180px] text-[10px] leading-4 text-muted-foreground">{appointment.notes}</p>}</td>
                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                  {appointment.status === 'pending' && <><button type="button" disabled={updateAppointment.isPending} onClick={() => handleAppointmentStatus(appointment.id, 'approved')} className="inline-flex h-8 items-center gap-1 bg-primary px-2.5 text-[9px] font-bold uppercase text-primary-foreground disabled:opacity-50" data-testid={`button-approve-appointment-${appointment.id}`}><Check size={12} /> Konfirmo</button><button type="button" disabled={updateAppointment.isPending} onClick={() => handleAppointmentStatus(appointment.id, 'cancelled')} className="h-8 border border-border px-2.5 text-[9px] font-bold uppercase disabled:opacity-50" data-testid={`button-cancel-appointment-${appointment.id}`}>Anulo</button></>}
                                  {appointment.status === 'approved' && <button type="button" disabled={updateAppointment.isPending} onClick={() => handleAppointmentStatus(appointment.id, 'completed')} className="h-8 border border-border px-2.5 text-[9px] font-bold uppercase disabled:opacity-50" data-testid={`button-complete-appointment-${appointment.id}`}>Shëno përfunduar</button>}
                                </div>
                                {(appointment.status === 'pending' || appointment.status === 'approved') && (
                                  <form onSubmit={(event) => handleAppointmentReschedule(event, appointment.id)} className="mt-3 flex flex-wrap justify-end gap-2" data-testid={`form-reschedule-appointment-${appointment.id}`}>
                                    <input required type="date" name="rescheduleDate" defaultValue={calendarDateKey(appointment.appointmentDate)} className="h-8 border border-border bg-background px-2 text-[10px]" aria-label="Data e re" />
                                    <input required type="time" name="rescheduleTime" defaultValue={appointment.appointmentTime} className="h-8 border border-border bg-background px-2 text-[10px]" aria-label="Ora e re" />
                                    <button type="submit" disabled={updateAppointment.isPending} className="h-8 border border-border px-2.5 text-[9px] font-bold uppercase disabled:opacity-50" data-testid={`button-reschedule-appointment-${appointment.id}`}>Zhvendos</button>
                                  </form>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {appointmentsQuery.isError && <p className="p-4 text-xs text-destructive" role="alert">Terminet nuk u ngarkuan. <button type="button" onClick={() => void appointmentsQuery.refetch()} className="underline">Provo përsëri</button></p>}
                </div>
              )}

              {tab === 'messages' && (
                <div className="mt-6 border border-border bg-card">
                  <div className="border-b border-border p-5">
                    <h2 className="font-display text-2xl font-bold uppercase">Mesazhet e klientëve</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Mesazhet e dërguara nga formulari publik ruhen këtu.</p>
                  </div>
                  {(contactMessagesQuery.data ?? []).length === 0 ? (
                    <div className="px-6 py-14 text-center">
                      <MessageSquareText className="mx-auto text-muted-foreground/50" />
                      <p className="mt-3 text-sm font-semibold">Nuk ka mesazhe të reja.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {contactMessagesQuery.data?.map((message) => (
                        <article key={message.id} className="flex flex-col justify-between gap-4 p-5 md:flex-row" data-testid={`row-contact-message-${message.id}`}>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <h3 className="text-sm font-bold">{message.subject}</h3>
                              <span className="text-[10px] text-muted-foreground">{formatCalendarDate(message.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                            <p className="mt-2 text-xs font-semibold">{message.name}<span className="ml-2 font-normal text-muted-foreground">{message.status}</span></p>
                            <a href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`} className="mt-1 inline-block text-xs text-accent underline">{message.email}</a>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{message.message}</p>
                          </div>
                          <a href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`} className="inline-flex h-9 shrink-0 items-center justify-center border border-border px-4 text-[10px] font-bold uppercase tracking-wider hover:bg-muted">Përgjigju me email</a>
                        </article>
                      ))}
                    </div>
                  )}
                  {contactMessagesQuery.isError && <p className="p-4 text-xs text-destructive" role="alert">Mesazhet nuk u ngarkuan. <button type="button" onClick={() => void contactMessagesQuery.refetch()} className="underline">Provo përsëri</button></p>}
                </div>
              )}

              {tab === 'reviews' && (
                <div className="mt-6 border border-border bg-card">
                  <div className="border-b border-border p-5"><h2 className="font-display text-2xl font-bold uppercase">Moderimi i vlerësimeve</h2><p className="mt-1 text-xs text-muted-foreground">Vlerësimet publike shfaqen pas miratimit.</p></div>
                  {(reviewsQuery.data ?? []).length === 0 ? <div className="px-6 py-14 text-center"><MessageSquareText className="mx-auto text-muted-foreground/50" /><p className="mt-3 text-sm font-semibold">Kutia e moderimit është bosh.</p><p className="mt-1 text-xs text-muted-foreground">Vlerësimet e reja do të shfaqen këtu.</p></div> : (
                    <div className="divide-y divide-border">
                      {reviewsQuery.data?.map((review) => <article key={review.id} className="flex flex-col justify-between gap-5 p-5 md:flex-row md:items-center" data-testid={`row-review-${review.id}`}>
                        <div className="max-w-3xl"><div className="flex items-center gap-3"><span className="text-xs font-bold">{review.customerName}</span><span className="text-[10px] text-muted-foreground">{review.carModel}</span><span className="text-[10px] font-bold text-accent">{review.rating}/5</span></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{review.comment}</p><p className="mt-2 text-[9px] text-muted-foreground">{new Date(review.createdAt).toLocaleDateString('sq-AL')} · {statusText[review.status]}</p></div>
                        <div className="flex shrink-0 gap-2"><button type="button" disabled={moderateReview.isPending} onClick={() => handleModerate(review.id, 'approved')} className="inline-flex h-9 items-center gap-2 bg-primary px-3 text-[10px] font-bold uppercase text-primary-foreground disabled:opacity-50" data-testid={`button-approve-review-${review.id}`}><Check size={13} /> Mirato</button><button type="button" disabled={moderateReview.isPending} onClick={() => handleModerate(review.id, 'rejected')} className="h-9 border border-border px-3 text-[10px] font-bold uppercase disabled:opacity-50" data-testid={`button-reject-review-${review.id}`}>Refuzo</button></div>
                      </article>)}
                    </div>
                  )}
                </div>
              )}

              {tab === 'availability' && (
                <div className="mt-6 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
                  <div className="grid gap-5">
                    <form onSubmit={submitBlockedDay} className="border border-border bg-card p-5">
                      <span className="eyebrow text-accent">Bllokim i plotë</span><h2 className="mt-2 font-display text-2xl font-bold uppercase">Mbyllni një ditë</h2>
                      <div className="mt-5 grid gap-4">
                        <Field label="Data"><input required type="date" name="blockedDate" className="h-11 border border-border bg-background px-3 text-sm text-foreground" data-testid="input-block-day-date" /></Field>
                        <Field label="Arsyeja"><input required minLength={2} maxLength={240} name="blockedReason" placeholder="p.sh. pushim" className="h-11 border border-border bg-background px-3 text-sm" data-testid="input-block-day-reason" /></Field>
                        <button type="submit" disabled={createBlockedSlot.isPending} className="inline-flex h-10 items-center justify-center gap-2 bg-primary text-xs font-bold uppercase text-primary-foreground disabled:opacity-50" data-testid="button-block-day">{createBlockedSlot.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />} Blloko ditën</button>
                      </div>
                    </form>
                    <form onSubmit={submitBlockedTime} className="border border-border bg-card p-5">
                      <span className="eyebrow text-accent">Bllokim i pjesshëm</span><h2 className="mt-2 font-display text-2xl font-bold uppercase">Mbyllni një orar</h2>
                      <div className="mt-5 grid gap-4">
                        <Field label="Data"><input required type="date" name="blockedTimeDate" className="h-11 border border-border bg-background px-3 text-sm" data-testid="input-block-time-date" /></Field>
                        <Field label="Ora"><input required type="time" name="blockedTime" className="h-11 border border-border bg-background px-3 text-sm" data-testid="input-block-time-time" /></Field>
                        <Field label="Arsyeja"><input required minLength={2} maxLength={240} name="blockedTimeReason" className="h-11 border border-border bg-background px-3 text-sm" data-testid="input-block-time-reason" /></Field>
                        <button type="submit" disabled={createBlockedSlot.isPending} className="inline-flex h-10 items-center justify-center gap-2 border border-primary text-xs font-bold uppercase text-primary disabled:opacity-50" data-testid="button-block-time">{createBlockedSlot.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />} Blloko orarin</button>
                      </div>
                    </form>
                  </div>
                  <div className="border border-border bg-card">
                    <div className="border-b border-border p-5"><h2 className="font-display text-2xl font-bold uppercase">Ditët dhe oraret e bllokuara</h2><p className="mt-1 text-xs text-muted-foreground">Hiqni bllokimin për t'i rihapur rezervimet.</p></div>
                    {(blockedQuery.data ?? []).length === 0 ? <div className="px-5 py-12 text-center text-sm text-muted-foreground">Nuk ka ditë apo orare të bllokuara.</div> : <div className="divide-y divide-border">{blockedQuery.data?.map((slot) => <div key={slot.id} className="flex items-center justify-between gap-4 p-4" data-testid={`row-blocked-slot-${slot.id}`}><div><p className="text-xs font-bold">{new Date(`${slot.date}T12:00:00`).toLocaleDateString('sq-AL', { day: 'numeric', month: 'long', year: 'numeric' })}{slot.time && <span className="ml-2 text-accent">{slot.time}</span>}</p><p className="mt-1 text-[10px] text-muted-foreground">{slot.reason}</p></div><button type="button" disabled={deleteBlockedSlot.isPending} onClick={() => { if (window.confirm('Të hiqet ky bllokim?')) deleteBlockedSlot.mutate({ id: slot.id }, { onSuccess: invalidateAdmin, onError: () => setActionError('Bllokimi nuk u hoq. Provoni përsëri.') }); }} className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50" aria-label={`Hiq bllokimin ${slot.date}`} data-testid={`button-delete-block-${slot.id}`}><Trash2 size={15} /></button></div>)}</div>}
                  </div>
                </div>
              )}

              {tab === 'portfolio' && (
                <div className="mt-6">
                  <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="font-display text-2xl font-bold uppercase">Galeria e punëve</h2><p className="mt-1 text-xs text-muted-foreground">Shtoni punë të përfunduara që vizitorët të shohin shembuj realë.</p></div><button type="button" onClick={() => setShowPortfolioForm((value) => !value)} className="inline-flex h-10 items-center justify-center gap-2 bg-primary px-4 text-[10px] font-bold uppercase tracking-wider text-primary-foreground" data-testid="button-toggle-portfolio-form">{showPortfolioForm ? <X size={14} /> : <Plus size={14} />}{showPortfolioForm ? 'Mbyll formën' : 'Shto punë të re'}</button></div>
                  {showPortfolioForm && <form onSubmit={submitPortfolio} className="mb-6 grid gap-4 border border-border bg-card p-5 sm:grid-cols-2">
                    <Field label="Titulli"><input required minLength={2} maxLength={120} name="workTitle" className="h-11 border border-border bg-background px-3 text-sm" data-testid="input-work-title" /></Field>
                    <Field label="Kategoria"><input required minLength={2} maxLength={80} name="workCategory" className="h-11 border border-border bg-background px-3 text-sm" data-testid="input-work-category" /></Field>
                    <Field label="Automjeti"><input maxLength={120} name="workVehicle" className="h-11 border border-border bg-background px-3 text-sm" data-testid="input-work-vehicle" /></Field>
                    <Field label="Lidhja e fotos"><input type="url" name="workImage" placeholder="https://" className="h-11 border border-border bg-background px-3 text-sm" data-testid="input-work-image" /></Field>
                    <Field label="Përshkrimi"><textarea required minLength={2} maxLength={1000} name="workDescription" rows={3} className="border border-border bg-background px-3 py-3 text-sm sm:col-span-2" data-testid="input-work-description" /></Field>
                    <button type="submit" disabled={createPortfolio.isPending} className="inline-flex h-10 items-center justify-center gap-2 bg-accent text-xs font-bold uppercase disabled:opacity-50 sm:col-span-2" data-testid="button-add-portfolio">{createPortfolio.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <ImagePlus size={15} />} Publiko punën</button>
                  </form>}
                  {portfolioQuery.isLoading ? <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-56 animate-pulse bg-muted" />)}</div> : portfolioQuery.isError ? <div className="border border-destructive/30 bg-card p-6 text-sm text-destructive">Galeria nuk u ngarkua. <button type="button" onClick={() => void portfolioQuery.refetch()} className="underline">Provo përsëri</button></div> : (portfolioQuery.data ?? []).length === 0 ? <div className="border border-dashed border-border bg-card p-12 text-center"><ImagePlus className="mx-auto text-muted-foreground/50" /><p className="mt-3 text-sm font-semibold">Galeria është ende bosh.</p><p className="mt-1 text-xs text-muted-foreground">Shtoni punën e parë të përfunduar.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{portfolioQuery.data?.map((item) => <article key={item.id} className="group overflow-hidden border border-border bg-card" data-testid={`card-admin-work-${item.id}`}><div className="relative aspect-[4/3] bg-muted">{item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground/50"><ImagePlus /></div>}<button type="button" onClick={() => { if (window.confirm('Të hiqet kjo punë nga galeria?')) deletePortfolio.mutate({ id: item.id }, { onSuccess: invalidateAdmin, onError: () => setActionError('Puna nuk u fshi. Provoni përsëri.') }); }} className="absolute right-3 top-3 grid h-9 w-9 place-items-center bg-card/90 text-destructive shadow-sm" aria-label={`Fshi punën ${item.title}`} data-testid={`button-delete-work-${item.id}`}><Trash2 size={15} /></button></div><div className="p-4"><span className="eyebrow text-accent">{item.category}</span><h3 className="mt-2 font-display text-xl font-bold uppercase">{item.title}</h3><p className="mt-1 text-xs text-muted-foreground">{item.vehicleLabel}</p><p className="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground">{item.description}</p></div></article>)}</div>}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default AdminPage;
