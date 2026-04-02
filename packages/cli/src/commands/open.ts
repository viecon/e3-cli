import { Command } from 'commander';
import chalk from 'chalk';
import { execFile } from 'node:child_process';
import { MoodleClient, getEnrolledCourses } from '@e3/core';
import { loadConfig, getBaseUrl, requireAuth } from '../config.js';

function openUrl(url: string): void {
  // Validate URL to prevent command injection
  try { new URL(url); } catch { return; }

  if (process.platform === 'win32') {
    execFile('cmd', ['/c', 'start', '', url]);
  } else if (process.platform === 'darwin') {
    execFile('open', [url]);
  } else {
    execFile('xdg-open', [url]);
  }
}

export function registerOpenCommand(program: Command): void {
  program
    .command('open [target]')
    .description('用瀏覽器開啟 E3 頁面 (課程名/ID/dashboard/calendar)')
    .action(async (target: string | undefined) => {
      try {
        const baseUrl = getBaseUrl();

        if (!target || target === 'dashboard') {
          console.log(chalk.gray('開啟 E3 首頁...'));
          openUrl(`${baseUrl}/my/`);
          return;
        }

        if (target === 'calendar') {
          openUrl(`${baseUrl}/calendar/view.php`);
          return;
        }

        if (target === 'grades') {
          openUrl(`${baseUrl}/grade/report/overview/index.php`);
          return;
        }

        // Try as course ID
        if (/^\d+$/.test(target)) {
          openUrl(`${baseUrl}/course/view.php?id=${target}`);
          return;
        }

        // Search by course name
        requireAuth();
        const config = loadConfig();
        const client = new MoodleClient({
          token: config.token,
          sessionCookie: config.session,
          baseUrl,
        });

        const courses = await getEnrolledCourses(client, 'inprogress');
        const needle = target.toLowerCase();
        const match = courses.find(c =>
          c.fullname.toLowerCase().includes(needle) ||
          c.shortname.toLowerCase().includes(needle),
        );

        if (match) {
          console.log(chalk.gray(`開啟 ${match.fullname}...`));
          openUrl(`${baseUrl}/course/view.php?id=${match.id}`);
        } else {
          console.log(chalk.yellow(`找不到「${target}」，開啟 E3 首頁...`));
          openUrl(`${baseUrl}/my/`);
        }
      } catch (err: unknown) {
        console.error(chalk.red(`錯誤: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
