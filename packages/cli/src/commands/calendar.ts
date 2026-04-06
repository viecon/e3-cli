import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { getUpcomingEvents, getPendingAssignmentsViaCalendar, generateICS, type ICSEvent } from '@e3/core';
import { printTable, printJson, formatDate, urgencyColor } from '../output.js';
import { createClient } from '../createClient.js';

// Look for calendar-events.json: repo root first, then home dir fallback
function findCalendarEventsPath(): string {
  // Walk up from this file to find repo root (where calendar-events.json lives)
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, 'calendar-events.json');
    if (existsSync(candidate)) return candidate;
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return join(homedir(), '.calendar-events.json');
}
const CALENDAR_EVENTS_PATH = findCalendarEventsPath();

interface ManualExam {
  name: string;
  course: string;
  date: string;       // YYYY-MM-DD
  startTime?: string;  // HH:MM (24h)
  endTime?: string;    // HH:MM
  location?: string;
  allDay?: boolean;
}

function loadManualExams(): ManualExam[] {
  if (!existsSync(CALENDAR_EVENTS_PATH)) return [];
  try {
    return JSON.parse(readFileSync(CALENDAR_EVENTS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function parseExamDate(exam: ManualExam): { start: Date; end?: Date; allDay: boolean } {
  if (exam.allDay || !exam.startTime) {
    const d = new Date(exam.date + 'T00:00:00+08:00');
    return { start: d, allDay: true };
  }
  const start = new Date(`${exam.date}T${exam.startTime}:00+08:00`);
  const end = exam.endTime ? new Date(`${exam.date}T${exam.endTime}:00+08:00`) : undefined;
  return { start, end, allDay: false };
}

export function registerCalendarCommand(program: Command): void {
  program
    .command('calendar')
    .description('查看行事曆事件')
    .option('--days <n>', '未來幾天', '7')
    .option('--json', 'JSON 格式輸出')
    .option('--ics [file]', '輸出 .ics 檔案（預設 e3-calendar.ics）')
    .option('--ics-days <n>', 'ICS 涵蓋未來幾天', '90')
    .action(async (opts) => {
      try {
        const client = createClient();

        // ICS mode
        if (opts.ics !== undefined) {
          const outputFile = typeof opts.ics === 'string' ? opts.ics : 'e3-calendar.ics';
          const days = Number(opts.icsDays) || 90;

          const spinner = ora('取得作業與行事曆事件...').start();

          // 1. Get assignments
          const assignments = await getPendingAssignmentsViaCalendar(client, days);

          // 2. Get all calendar events (includes non-assignment events)
          const calendarResult = await getUpcomingEvents(client, days);

          spinner.text = '產生 ICS...';

          const events: ICSEvent[] = [];
          const seenIds = new Set<string>();

          // Add assignments as deadline events
          for (const a of assignments) {
            const uid = `e3-assign-${a.id}@e3p.nycu.edu.tw`;
            if (seenIds.has(uid)) continue;
            seenIds.add(uid);

            const deadline = new Date(a.duedate * 1000);
            // Event starts 1 hour before deadline
            const start = new Date(deadline.getTime() - 60 * 60 * 1000);

            events.push({
              uid,
              summary: `📋 ${a.name}`,
              description: `課程: ${a.courseName}\n截止: ${deadline.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}\n狀態: ${a.submissionStatus}`,
              dtstart: start,
              dtend: deadline,
              categories: ['作業', a.courseShortname],
            });
          }

          // Add other calendar events (might include exams added by professors)
          for (const e of calendarResult.events) {
            if (e.modulename === 'assign') continue; // already handled above
            const uid = `e3-event-${e.id}@e3p.nycu.edu.tw`;
            if (seenIds.has(uid)) continue;
            seenIds.add(uid);

            const start = new Date(e.timestart * 1000);
            const end = e.timeduration
              ? new Date((e.timestart + e.timeduration) * 1000)
              : new Date(start.getTime() + 60 * 60 * 1000);

            events.push({
              uid,
              summary: `${e.name}`,
              description: `課程: ${e.course?.fullname ?? ''}`,
              dtstart: start,
              dtend: end,
              categories: [e.eventtype, e.course?.shortname ?? ''],
            });
          }

          // 3. Load manual exams
          const manualExams = loadManualExams();
          for (const exam of manualExams) {
            const uid = `e3-exam-${exam.date}-${exam.course.replace(/\s/g, '')}-${exam.name.replace(/\s/g, '')}@manual`;
            if (seenIds.has(uid)) continue;
            seenIds.add(uid);

            const { start, end, allDay } = parseExamDate(exam);

            events.push({
              uid,
              summary: `📝 ${exam.course} ${exam.name}`,
              description: exam.location ? `地點: ${exam.location}` : undefined,
              dtstart: start,
              dtend: end,
              allDay,
              location: exam.location,
              categories: ['考試', exam.course],
            });
          }

          // Sort by start time
          events.sort((a, b) => a.dtstart.getTime() - b.dtstart.getTime());

          const ics = generateICS(events);
          writeFileSync(outputFile, ics, 'utf-8');
          spinner.succeed(`已產生 ${outputFile}（${events.length} 個事件：${assignments.length} 作業 + ${manualExams.length} 考試 + ${events.length - assignments.length - manualExams.length} 其他）`);

          if (manualExams.length === 0) {
            console.log(chalk.yellow(`\n提示：在 ${CALENDAR_EVENTS_PATH} 新增考試，格式：`));
            console.log(chalk.gray(`[
  { "name": "期中考", "course": "計算機組織", "date": "2026-04-16", "startTime": "13:20", "endTime": "15:10", "location": "EC015" }
]`));
          }

          return;
        }

        // Normal mode (table/json)
        const spinner = ora('取得行事曆...').start();
        const result = await getUpcomingEvents(client, Number(opts.days));
        spinner.stop();

        const events = result.events;

        if (opts.json) {
          printJson(events.map(e => ({
            id: e.id,
            name: e.name,
            course: e.course?.fullname,
            timestart: e.timestart,
            eventtype: e.eventtype,
            overdue: e.overdue,
            url: e.url })));
          return;
        }

        if (events.length === 0) {
          console.log(chalk.green(`未來 ${opts.days} 天沒有事件`));
          return;
        }

        printTable(
          ['日期', '課程', '事件', '類型'],
          events.map(e => {
            const color = urgencyColor(e.timestart);
            return [
              color(formatDate(e.timestart)),
              e.course?.shortname ?? '-',
              e.name,
              e.eventtype,
            ];
          }),
        );
      } catch (err: unknown) {
        console.error(chalk.red(`錯誤: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
