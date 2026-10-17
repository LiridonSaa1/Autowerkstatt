import { renderBusinessAppointmentEmail, type BusinessAppointmentInput } from './email-templates';

export type AppointmentEmail = BusinessAppointmentInput;

export function appointmentEmail(input: AppointmentEmail): string {
  return renderBusinessAppointmentEmail(input);
}
