import { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import deLocale from '@fullcalendar/core/locales/de';
import type { AdminAppointment } from '@workspace/api-client-react';
import { calendarDateKey } from '@/lib/date-format';

export default function BookingCalendar({ appointments, onSelect }: { appointments: AdminAppointment[]; onSelect: (id: number | null) => void }) {
  const events = useMemo(() => appointments.map((item) => ({
    id: String(item.id),
    title: `${item.customerName} · ${item.customService || item.serviceName}`,
    start: `${calendarDateKey(item.appointmentDate)}T${item.appointmentTime}`,
    classNames: [`booking-${item.status}`],
  })), [appointments]);
  return <div className="booking-calendar p-3 sm:p-5">
    <div className="mb-5 flex flex-wrap gap-4 text-[11px] text-muted-foreground" aria-label="Buchungsstatus">
      {[['pending', 'Ausstehend'], ['approved', 'Bestätigt'], ['completed', 'Abgeschlossen'], ['cancelled', 'Storniert']].map(([status, label]) => <span key={status} className="flex items-center gap-2"><span className={`booking-legend booking-${status}`} />{label}</span>)}
    </div>
    <FullCalendar plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} locale={deLocale}
      initialView="dayGridMonth" firstDay={1} timeZone="local" height="auto"
      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
      buttonText={{ today: 'Heute', month: 'Monat', week: 'Woche', day: 'Tag' }}
      events={events} dayMaxEvents={3} nowIndicator allDaySlot={false}
      slotMinTime="06:00:00" slotMaxTime="23:00:00" scrollTime="08:00:00"
      eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
      slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
      eventClick={({ event }) => onSelect(Number(event.id))}
      dateClick={({ date, view }) => view.calendar.changeView('timeGridDay', date)}
      datesSet={() => onSelect(null)}
      eventDidMount={({ el, event }) => { el.title = `${event.title} — ${event.start?.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`; }}
    />
    <p className="mt-4 text-xs text-muted-foreground">Klicken Sie auf eine Buchung, um Details zu sehen und sie zu bearbeiten. Ein Klick auf ein Datum öffnet die Tagesansicht.</p>
    {appointments.length === 0 && <p role="status" className="mt-3 text-sm text-muted-foreground">Für den gewählten Filter gibt es keine Buchungen.</p>}
  </div>;
}
