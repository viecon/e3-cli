/**
 * ICS (iCalendar) generator for E3 events.
 * Merges assignment deadlines + manual exam entries into a .ics file.
 */

export interface ICSEvent {
  uid: string;
  summary: string;
  description?: string;
  dtstart: Date;
  dtend?: Date;
  location?: string;
  categories?: string[];
  allDay?: boolean;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDateTimeUTC(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function formatDateOnly(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function buildEvent(event: ICSEvent): string {
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatDateTimeUTC(new Date())}`,
  ];

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(event.dtstart)}`);
    if (event.dtend) {
      lines.push(`DTEND;VALUE=DATE:${formatDateOnly(event.dtend)}`);
    }
  } else {
    lines.push(`DTSTART:${formatDateTimeUTC(event.dtstart)}`);
    if (event.dtend) {
      lines.push(`DTEND:${formatDateTimeUTC(event.dtend)}`);
    }
  }

  lines.push(`SUMMARY:${escapeICS(event.summary)}`);

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeICS(event.location)}`);
  }
  if (event.categories && event.categories.length > 0) {
    lines.push(`CATEGORIES:${event.categories.map(escapeICS).join(',')}`);
  }

  // Reminder: 1 day before + 1 hour before
  lines.push(
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
  );

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

export function generateICS(events: ICSEvent[], calendarName = 'NYCU E3'): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//E3 Assistant//NYCU E3 Calendar//EN',
    `X-WR-CALNAME:${calendarName}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // Refresh every 6 hours
    'X-PUBLISHED-TTL:PT6H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
  ];

  for (const event of events) {
    lines.push(buildEvent(event));
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
