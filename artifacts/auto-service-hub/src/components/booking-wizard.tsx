import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import { getGetAvailabilityQueryKey, useCreateAppointment, useGetAvailability, type Service } from '@workspace/api-client-react';
import { calendarDateKey, formatCalendarDate } from '@/lib/date-format';
import { ServiceBadge } from '@/components/service-icon';

const steps = ['Leistung', 'Datum', 'Uhrzeit', 'Fahrzeug & Kontakt', 'Bestätigung'];
const inputClass = 'h-12 w-full rounded-none border border-primary/20 bg-primary/[.035] px-4 text-sm text-foreground outline-none placeholder:text-foreground/35 focus:border-orange-300 focus:ring-2 focus:ring-orange-300/15';
const emptyDetails = { customerName: '', phone: '', email: '', vehicleMake: '', vehicleModel: '', vehicleYear: '', licensePlate: '', notes: '' };
type Props = {
  services: Service[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  selectedServiceIds?: string[];
  selectedServiceId?: string;
  onToggleService?: (id: string) => void;
  onSelect?: (id: string) => void;
  onClearServices?: () => void;
};

export default function BookingWizard({
  services,
  loading,
  error,
  onRetry,
  selectedServiceIds,
  selectedServiceId,
  onToggleService,
  onSelect,
  onClearServices,
}: Props) {
  const client = useQueryClient();
  const [step, setStep] = useState(0);
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [details, setDetails] = useState(emptyDetails);
  const [receipt, setReceipt] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [dateNotice, setDateNotice] = useState<{ date: string; reason: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const params = useMemo(() => ({ month: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}` }), [month]);
  const availability = useGetAvailability(params, { query: { queryKey: getGetAvailabilityQueryKey(params), refetchInterval: 15000 } });
  const booking = useCreateAppointment();

  const currentSelectedIds = useMemo(() => {
    if (selectedServiceIds !== undefined) return selectedServiceIds;
    return selectedServiceId ? [selectedServiceId] : [];
  }, [selectedServiceIds, selectedServiceId]);

  const handleToggle = (id: string) => {
    if (onToggleService) {
      onToggleService(id);
    } else if (onSelect) {
      onSelect(currentSelectedIds.includes(id) ? '' : id);
    }
  };

  const handleClear = () => {
    if (onClearServices) onClearServices();
    if (onSelect) onSelect('');
  };

  const selectedServices = useMemo(
    () => services.filter((item) => currentSelectedIds.includes(item.id)),
    [services, currentSelectedIds],
  );
  const primaryService = selectedServices[0];

  const days = availability.data ?? [];
  const day = days.find((item) => calendarDateKey(item.date) === selectedDay);
  const validSlot = !availability.isError && Boolean(day?.open && day.slots.some((slot) => slot.time === selectedTime && slot.available));
  const validDay = !availability.isError && Boolean(day?.open && day.slots.some((slot) => slot.available));
  const canContinue = step === 0 ? selectedServices.length > 0 && !error && !loading : step === 1 ? validDay : step === 2 ? validSlot : true;
  const changeStep = (next: number) => {
    if (next === 1 || next === 2) void availability.refetch();
    setStep(next); setBookingError('');
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'nearest' });
    });
  };

  useEffect(() => {
    const update = (event: StorageEvent) => { if (event.key === 'booking-schedule-updated') void client.invalidateQueries({ queryKey: getGetAvailabilityQueryKey() }); };
    const refresh = () => { void client.invalidateQueries({ queryKey: getGetAvailabilityQueryKey() }); };
    window.addEventListener('storage', update);
    window.addEventListener('booking-schedule-updated', refresh);
    return () => { window.removeEventListener('storage', update); window.removeEventListener('booking-schedule-updated', refresh); };
  }, [client]);

  useEffect(() => {
    if (availability.isSuccess && selectedTime && !day?.slots.some(slot => slot.time === selectedTime && slot.available)) setSelectedTime('');
  }, [availability.isSuccess, availability.data, day, selectedTime]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (booking.isPending || receipt) return;
    if (selectedServices.length === 0 || !primaryService || error || loading) { changeStep(0); return; }
    if (step === 0) { changeStep(1); return; }
    if (!validDay) { changeStep(1); setBookingError('Bitte wählen Sie ein verfügbares Datum.'); return; }
    if (step === 1) { changeStep(2); return; }
    if (!validSlot) { changeStep(2); setBookingError('Bitte wählen Sie eine verfügbare Uhrzeit.'); return; }
    if (step === 2) { changeStep(3); return; }
    if (!event.currentTarget.checkValidity()) {
      changeStep(3);
      requestAnimationFrame(() => formRef.current?.reportValidity());
      return;
    }
    if (step === 3) { changeStep(4); return; }
    setBookingError('');

    const serviceNames = selectedServices.map((s) => s.name).join(', ');
    const customServiceText = selectedServices.length > 1 ? serviceNames.slice(0, 160) : null;
    const userNotes = details.notes.trim();
    const combinedNotes = selectedServices.length > 1
      ? (userNotes ? `Ausgewählte Leistungen: ${serviceNames}\n\n${userNotes}` : `Ausgewählte Leistungen: ${serviceNames}`)
      : (userNotes || null);

    booking.mutate({ data: {
      serviceId: primaryService.id,
      customService: customServiceText,
      ...details,
      vehicleYear: Number(details.vehicleYear),
      licensePlate: details.licensePlate.trim() || null,
      notes: combinedNotes,
      appointmentDate: selectedDay,
      appointmentTime: selectedTime,
    } }, {
      onSuccess: (result) => {
        setReceipt(result.referenceCode);
        void client.invalidateQueries({ queryKey: getGetAvailabilityQueryKey() });
      },
      onError: (err) => {
        setBookingError((err as { data?: { error?: string } }).data?.error || 'Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.');
        void availability.refetch();
      },
    });
  };

  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const navigateMonth = (amount: number) => { setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1)); setSelectedDay(''); setSelectedTime(''); setDateNotice(null); };
  const titles = ['Welche Leistung benötigen Sie?', 'Wählen Sie Ihr Wunschdatum.', 'Wählen Sie Ihre Uhrzeit.', 'Fahrzeug- & Kontaktdaten', 'Ihre Terminanfrage'];

  return (
    <section id="rezervo" className="relative isolate scroll-mt-16 overflow-hidden bg-white px-5 py-20 text-foreground md:px-10 md:py-24">
      <div className="pointer-events-none absolute bottom-0 left-0 -z-10 hidden h-[650px] w-[382px] bg-contain bg-left-bottom bg-no-repeat lg:block" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}booking-mechanic-new.png)`, maskImage: 'linear-gradient(to right, black 0%, black 78%, transparent 100%), linear-gradient(to bottom, black 0%, black 90%, transparent 100%)', maskComposite: 'intersect' }} aria-hidden="true" />
      <div className="mx-auto w-full max-w-[1000px]">
        <div className="eyebrow flex items-center gap-3 text-accent"><span className="h-px w-8 bg-current" />Online-Terminvereinbarung</div>
        <h2 className="mt-4 font-display text-4xl font-bold uppercase leading-tight md:text-5xl">Ihr Termin. Ganz einfach.</h2>
        <p className="mt-3 text-sm text-foreground/65">In wenigen Schritten zu Ihrem Wunschtermin.</p>
        <ol className="mb-7 mt-8 grid grid-cols-5 gap-2" aria-label="Buchungsschritte">
          {steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={`border-t-[3px] pt-3 ${index <= step ? 'border-accent' : 'border-primary/20'}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${index === step ? 'bg-accent text-foreground' : index < step ? 'bg-teal-200/20 text-teal-800' : 'bg-primary/10 text-foreground/60'}`}>{index < step ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
              <span className={`text-[10px] leading-snug sm:text-xs ${index === step ? 'font-bold text-foreground' : 'text-foreground/60'}`}>{label}</span>
            </div>
          </li>)}
        </ol>
        {receipt ? <div className="rounded-none border border-primary/20 bg-white p-6 md:p-9" role="status">
          <CheckCircle2 size={40} className="text-accent" />
          <h3 className="mt-4 font-display text-3xl font-bold uppercase">Vielen Dank für Ihre Anfrage!</h3>
          <p className="mt-3 text-sm leading-7 text-foreground/70">Ihr Referenzcode: <strong className="text-foreground">{receipt}</strong><br />Wir bestätigen Ihren Termin persönlich. Ihre Anfrage ist noch keine verbindliche Buchung.</p>
          <button type="button" onClick={() => { setReceipt(''); setDetails(emptyDetails); setSelectedDay(''); setSelectedTime(''); handleClear(); changeStep(0); }} className="mt-6 rounded-full bg-accent px-5 py-3 text-sm font-bold">Weitere Anfrage</button>
        </div> : <form ref={formRef} noValidate onSubmit={submit} className="rounded-none border border-primary/20 bg-white p-5 md:p-8">
          <h3 ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold leading-tight outline-none md:text-3xl">{titles[step]}</h3>
          <div hidden={step !== 0}>
            <div className="mb-5 mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-foreground/65">Wählen Sie den gewünschten Service aus (Mehrfachauswahl möglich).</p>
              {selectedServices.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-400/20 px-3 py-1 text-xs font-semibold text-accent">
                  <Check size={13} className="text-accent" />
                  {selectedServices.length} {selectedServices.length === 1 ? 'Leistung ausgewählt' : 'Leistungen ausgewählt'}
                </span>
              )}
            </div>
            {loading && <p role="status" className="py-8 text-sm text-foreground/60">Leistungen werden geladen…</p>}
            {error && <p role="alert" className="py-6 text-sm text-accent">Leistungen konnten nicht geladen werden. <button type="button" onClick={onRetry} className="underline">Erneut versuchen</button></p>}
            {!loading && !error && services.length === 0 && <p className="py-6 text-sm text-foreground/65">Zurzeit sind keine Leistungen für die Online-Anfrage veröffentlicht.</p>}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3" role="group" aria-label="Leistung auswählen">
              {services.map((item) => {
                const isSelected = currentSelectedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleToggle(item.id)}
                    className={`relative flex min-w-0 flex-col rounded-none border p-3 sm:p-4 text-left transition-all ${
                      isSelected
                        ? 'border-accent bg-primary/10 ring-1 ring-accent/30'
                        : 'border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <ServiceBadge icon={item.icon} name={item.name} />
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
                          isSelected
                            ? 'border-accent bg-accent text-white'
                            : 'border-primary/30 bg-primary/5'
                        }`}
                        aria-hidden="true"
                      >
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </span>
                    </div>
                    <span className="mt-2.5 block font-display text-base font-semibold leading-tight sm:text-lg">{item.name}</span>
                    <span className="mt-1 block text-[11px] leading-4 text-foreground/60 sm:text-xs sm:leading-5">{item.category}</span>
                    {(item.priceLabel || item.durationMinutes) && (
                      <span className="mt-2.5 block text-[11px] text-accent sm:mt-3 sm:text-xs">
                        {[item.priceLabel, item.durationMinutes ? `${item.durationMinutes} Min.` : ''].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div hidden={step !== 1}>
            <div className="mb-3 mt-6 flex items-center justify-between gap-3">
              <p className="font-display text-xl font-semibold uppercase">{month.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => navigateMonth(-1)} aria-label="Vorheriger Monat" className="grid h-9 w-9 place-items-center rounded-full border border-primary/20"><ChevronLeft size={17} /></button>
                <button type="button" onClick={() => navigateMonth(1)} aria-label="Nächster Monat" className="grid h-9 w-9 place-items-center rounded-full border border-primary/20"><ChevronRight size={17} /></button>
              </div>
            </div>
            {availability.isLoading && <p role="status" className="py-6 text-sm text-foreground/60">Verfügbarkeit wird geladen…</p>}
            {availability.isError && <p role="alert" className="py-5 text-sm text-accent">Termine konnten nicht geladen werden. <button type="button" onClick={() => void availability.refetch()} className="underline">Erneut versuchen</button></p>}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-foreground/50 sm:gap-2">{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((label) => <span key={label} className="py-3">{label}</span>)}</div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {Array.from({ length: offset + dayCount }, (_, index) => {
                if (index < offset) return <span key={`empty-${index}`} />;
                const date = `${params.month}-${String(index - offset + 1).padStart(2, '0')}`;
                const availableDay = days.find((item) => calendarDateKey(item.date) === date);
                const enabled = !availability.isError && Boolean(availableDay?.open && availableDay.slots.some((slot) => slot.available));
                const reason = availableDay?.reason || 'Keine freien Termine';
                const dateLabel = formatCalendarDate(date, { weekday: 'long', day: 'numeric', month: 'long' });
                return <button key={date} type="button" disabled={!availableDay || availability.isError} aria-disabled={!enabled} aria-pressed={enabled && date === selectedDay} aria-label={`${dateLabel}${!enabled ? ` — ${reason}` : ''}`} title={!enabled ? `${dateLabel}: ${reason}` : dateLabel} onClick={() => {
                  if (!enabled) { setDateNotice({ date, reason }); return; }
                  setDateNotice(null); setSelectedDay(date); setSelectedTime('');
                }} className={`flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-none px-1 text-sm transition-colors sm:h-16 ${enabled && selectedDay === date ? 'bg-accent font-bold text-foreground' : enabled ? 'bg-primary/10 hover:bg-primary/20' : 'bg-primary/[.025] text-foreground/40 hover:bg-primary/5'}`}>
                  <span>{index - offset + 1}</span>
                  {!enabled && availableDay && <span className="block w-full truncate text-[8px] leading-tight sm:text-[10px]">{reason}</span>}
                </button>;
              })}
            </div>
            {dateNotice && <p role="status" className="mt-4 rounded-none border border-orange-300/25 bg-orange-300/5 px-4 py-3 text-sm text-foreground"><span className="font-semibold">{formatCalendarDate(dateNotice.date)}:</span> {dateNotice.reason}</p>}
            {!availability.isLoading && !availability.isError && !days.some((item) => item.open && item.slots.some((slot) => slot.available)) && <p className="mt-4 text-sm text-foreground/60">In diesem Monat sind keine Termine frei. Bitte wählen Sie einen anderen Monat.</p>}
          </div>
          <div hidden={step !== 2}>
            <p className="mt-3 text-sm text-foreground/65">{selectedDay && formatCalendarDate(selectedDay)}</p>
            {day && <div className="mt-6"><h4 className="text-sm font-semibold">Uhrzeit auswählen</h4><div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-7" role="group" aria-label="Verfügbare Uhrzeiten" tabIndex={0}>{day.slots.map((slot) => <button key={slot.time} type="button" disabled={!slot.available || availability.isError} aria-pressed={slot.time === selectedTime} onClick={() => setSelectedTime(slot.time)} className={`min-h-10 rounded-none px-1.5 py-2 text-xs font-semibold ${slot.available && slot.time === selectedTime ? 'bg-accent text-foreground' : slot.available ? 'bg-primary/10 hover:bg-primary/20' : 'bg-primary/5 text-foreground/25 line-through'}`}>{slot.time}{!slot.available && ' · Belegt'}</button>)}</div></div>}
            <p className="mt-5 text-xs leading-5 text-foreground/50">Es werden nur freie Termine innerhalb unserer Arbeitszeiten angezeigt. Feiertage und Betriebsferien sind berücksichtigt.</p>
          </div>
          <div hidden={step !== 3}>
            <p className="mb-5 mt-3 text-sm text-foreground/65">Damit wir uns optimal vorbereiten können.</p>
            <fieldset disabled={booking.isPending} className="grid gap-4 sm:grid-cols-2">
              {([
                ['customerName', 'Vollständiger Name', 'Max Mustermann', 'text', 120, 2, 'name'],
                ['phone', 'Telefon', '+49 …', 'tel', 40, 5, 'tel'],
                ['email', 'E-Mail', 'name@email.de', 'email', 254, 1, 'email'],
                ['vehicleMake', 'Marke', 'BMW', 'text', 80, 1, 'off'],
                ['vehicleModel', 'Modell', '320d', 'text', 80, 1, 'off'],
                ['vehicleYear', 'Baujahr', '2020', 'number', 4, 1, 'off'],
                ['licensePlate', 'Kennzeichen / FIN (optional)', 'Optional', 'text', 24, 0, 'off'],
              ] as const).map(([name, label, placeholder, type, maxLength, minLength, autoComplete]) => <label key={name} className={`grid gap-2 text-xs font-semibold text-foreground/80 ${name === 'customerName' ? 'sm:col-span-2' : ''}`}>{label}<input name={name} type={type} required={name !== 'licensePlate'} minLength={minLength} maxLength={maxLength} min={type === 'number' ? 1950 : undefined} max={type === 'number' ? 2100 : undefined} autoComplete={autoComplete} placeholder={placeholder} value={details[name]} onChange={(event) => setDetails((current) => ({ ...current, [name]: event.target.value }))} className={inputClass} /></label>)}
              <label className="grid gap-2 text-xs font-semibold text-foreground/80 sm:col-span-2">Weitere Hinweise<textarea name="notes" maxLength={2000} rows={3} placeholder="Beschreiben Sie Ihr Anliegen…" value={details.notes} onChange={(event) => setDetails((current) => ({ ...current, notes: event.target.value }))} className="resize-y rounded-none border border-primary/20 bg-primary/[.035] px-4 py-3 text-sm font-normal text-foreground outline-none placeholder:text-foreground/35 focus:border-orange-300" /></label>
            </fieldset>
          </div>
          <div hidden={step !== 4}>
            <p className="mt-3 text-sm text-foreground/65">Bitte überprüfen Sie Ihre Angaben.</p>
            <dl className="mt-4 divide-y divide-white/15">{[
              [
                selectedServices.length > 1 ? 'Leistungen' : 'Leistung',
                selectedServices.length > 0
                  ? selectedServices.map((s) => s.name).join(' · ')
                  : 'Keine Leistung ausgewählt',
              ],
              ['Wunschtermin', selectedDay ? `${formatCalendarDate(selectedDay)} · ${selectedTime} Uhr` : ''],
              ['Name', details.customerName], ['Kontakt', `${details.phone} · ${details.email}`],
              ['Fahrzeug', `${details.vehicleMake} ${details.vehicleModel} · ${details.vehicleYear}`],
              ...(details.licensePlate ? [['Kennzeichen / FIN', details.licensePlate]] : []),
              ...(details.notes ? [['Hinweise', details.notes]] : []),
            ].map(([label, value]) => <div key={label} className="flex flex-col justify-between gap-2 py-5 text-sm sm:flex-row sm:gap-8"><dt className="shrink-0 text-foreground/60">{label}</dt><dd className="min-w-0 break-words font-semibold sm:max-w-[65%] sm:text-right">{value}</dd></div>)}</dl>
            <p className="mt-5 text-xs leading-6 text-foreground/60">Wir bestätigen Ihren Termin persönlich. Noch keine verbindliche Buchung.</p>
          </div>
          {bookingError && <p role="alert" className="mt-5 rounded-none border border-orange-300/30 p-3 text-sm text-accent">{bookingError}</p>}
          <div className="mt-7 flex items-center justify-between gap-3">
            {step > 0 ? <button type="button" disabled={booking.isPending} onClick={() => changeStep(step - 1)} className="inline-flex items-center gap-2 rounded-full border border-primary/25 px-4 py-3 text-xs font-semibold text-foreground/75 disabled:opacity-50"><ArrowLeft size={15} />Zurück</button> : <span className="text-xs text-foreground/45">Schritt 1 von 5</span>}
            <button type="submit" disabled={!canContinue || booking.isPending} className="inline-flex items-center gap-3 rounded-full bg-accent px-6 py-3 text-sm font-bold text-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40">{booking.isPending ? <><LoaderCircle size={16} className="animate-spin" />Wird gesendet…</> : <>{step === 4 ? 'Terminanfrage senden' : 'Weiter'}<ArrowRight size={16} /></>}</button>
          </div>
        </form>}
      </div>
    </section>
  );
}
