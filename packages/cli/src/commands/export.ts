import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync } from 'node:fs';
import {
  MoodleClient,
  getEnrolledCourses,
  getCourseGrades,
  getPendingAssignmentsViaCalendar,
} from '@e3/core';
import { loadConfig, getBaseUrl, requireAuth, getUserId } from '../config.js';

export function registerExportCommand(program: Command): void {
  const exportCmd = program
    .command('export')
    .description('匯出資料');

  exportCmd
    .command('grades')
    .description('匯出成績為 CSV')
    .option('-o, --output <file>', '輸出檔案', 'grades.csv')
    .action(async (opts) => {
      try {
        requireAuth();
        const config = loadConfig();
        const client = new MoodleClient({
          token: config.token,
          sessionCookie: config.session,
          baseUrl: getBaseUrl(),
        });
        const userid = getUserId();

        const spinner = ora('匯出成績...').start();
        const courses = await getEnrolledCourses(client, 'inprogress');

        const rows: string[][] = [['課程', '項目', '成績', '範圍', '百分比']];

        for (const course of courses) {
          try {
            const report = await getCourseGrades(client, course.id, userid);
            for (const item of report.gradeitems) {
              if (item.itemtype === 'course') continue;
              rows.push([
                course.fullname,
                item.itemname || '',
                item.gradeformatted || '-',
                item.rangeformatted || '-',
                item.percentageformatted || '-',
              ]);
            }
          } catch {
            // Course might not have grades
          }
        }

        spinner.stop();

        // Write CSV (BOM for Excel compatibility)
        const csv = '\uFEFF' + rows.map(r =>
          r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','),
        ).join('\n');

        writeFileSync(opts.output, csv, 'utf-8');
        console.log(chalk.green(`成績已匯出到 ${opts.output} (${rows.length - 1} 筆)`));
      } catch (err: unknown) {
        console.error(chalk.red(`錯誤: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  exportCmd
    .command('assignments')
    .description('匯出未完成作業為 CSV')
    .option('-o, --output <file>', '輸出檔案', 'assignments.csv')
    .action(async (opts) => {
      try {
        requireAuth();
        const config = loadConfig();
        const client = new MoodleClient({
          token: config.token,
          sessionCookie: config.session,
          baseUrl: getBaseUrl(),
        });

        const spinner = ora('匯出作業...').start();
        const assignments = await getPendingAssignmentsViaCalendar(client, 90);
        spinner.stop();

        const rows: string[][] = [['課程', '作業名稱', '截止日期', '狀態']];

        for (const a of assignments) {
          const dueStr = a.duedate > 0
            ? new Date(a.duedate * 1000).toISOString().slice(0, 16).replace('T', ' ')
            : '無期限';
          rows.push([
            a.courseName,
            a.name,
            dueStr,
            a.isOverdue ? '逾期' : '未繳',
          ]);
        }

        const csv = '\uFEFF' + rows.map(r =>
          r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','),
        ).join('\n');

        writeFileSync(opts.output, csv, 'utf-8');
        console.log(chalk.green(`作業已匯出到 ${opts.output} (${rows.length - 1} 筆)`));
      } catch (err: unknown) {
        console.error(chalk.red(`錯誤: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
