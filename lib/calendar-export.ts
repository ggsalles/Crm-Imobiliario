import { format, parseISO } from "date-fns";

export interface CalendarEventItem {
  id: string;
  title: string;
  time: string;
  type: string;
  client?: string;
  date: Date | string;
  description?: string;
  status?: string;
}

function parseEventDates(event: CalendarEventItem): { start: Date; end: Date } {
  const baseDate = event.date instanceof Date ? event.date : parseISO(event.date as string);
  const timeParts = (event.time || "").split(" - ");
  const startTime = timeParts[0] || "10:00";
  const endTime = timeParts[1] || "11:00";

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  const start = new Date(baseDate);
  start.setHours(isNaN(startH) ? 10 : startH, isNaN(startM) ? 0 : startM, 0, 0);

  const end = new Date(baseDate);
  end.setHours(isNaN(endH) ? start.getHours() + 1 : endH, isNaN(endM) ? 0 : endM, 0, 0);

  if (end.getTime() <= start.getTime()) {
    end.setTime(start.getTime() + 60 * 60 * 1000);
  }

  return { start, end };
}

function formatUtcForIcs(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Generates a direct Google Calendar add event link
 */
export function getGoogleCalendarUrl(event: CalendarEventItem): string {
  const { start, end } = parseEventDates(event);
  const startStr = formatUtcForIcs(start);
  const endStr = formatUtcForIcs(end);

  const title = encodeURIComponent(`[${event.type}] ${event.title}`);
  const details = encodeURIComponent(
    [
      `Tipo: ${event.type}`,
      event.client ? `Cliente: ${event.client}` : null,
      event.description ? `Observações:\n${event.description}` : null,
      `Gerado via SalesScore CRM`
    ]
      .filter(Boolean)
      .join("\n\n")
  );

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}`;
}

/**
 * Generates an iCalendar (.ics) string for a single event or multiple events
 */
export function generateIcsContent(events: CalendarEventItem[], calendarTitle = "SalesScore Agenda"): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SalesScore CRM//Agenda Imobiliaria//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${calendarTitle}`
  ];

  for (const event of events) {
    const { start, end } = parseEventDates(event);
    const nowStr = formatUtcForIcs(new Date());
    const startStr = formatUtcForIcs(start);
    const endStr = formatUtcForIcs(end);

    const summary = `[${event.type}] ${event.title}`.replace(/,/g, "\\,").replace(/;/g, "\\;");
    const desc = [
      `Tipo: ${event.type}`,
      event.client ? `Cliente: ${event.client}` : null,
      event.description ? `Observações: ${event.description}` : null,
      `Status: ${event.status === "completed" ? "Concluído" : "Pendente"}`
    ]
      .filter(Boolean)
      .join(" \\n ");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id || Math.random().toString(36).substring(2)}@salesscore.crm`,
      `DTSTAMP:${nowStr}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      `STATUS:${event.status === "completed" ? "CONFIRMED" : "TENTATIVE"}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/**
 * Downloads an .ics file directly in the browser
 */
export function downloadIcsFile(filename: string, icsContent: string): void {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export single event to .ics file
 */
export function exportEventToIcs(event: CalendarEventItem): void {
  const content = generateIcsContent([event]);
  const safeTitle = event.title.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30);
  downloadIcsFile(`compromisso-${safeTitle || "evento"}.ics`, content);
}

/**
 * Export multiple events to .ics file
 */
export function exportAllEventsToIcs(events: CalendarEventItem[], filename = "agenda-salesscore"): void {
  const content = generateIcsContent(events);
  downloadIcsFile(`${filename}.ics`, content);
}
