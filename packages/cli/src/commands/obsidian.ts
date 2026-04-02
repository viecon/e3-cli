import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import {
  MoodleClient,
  getEnrolledCourses,
  getCourseContents,
  getPendingAssignmentsViaCalendar,
} from '@e3/core';
import { loadConfig, getBaseUrl, requireAuth } from '../config.js';

interface ObsidianConfig {
  apiUrl: string;
  apiKey: string;
}

function getObsidianConfig(): ObsidianConfig {
  // For now, use environment variables. Later can be in .e3rc.json
  const apiUrl = process.env.OBSIDIAN_API_URL ?? 'https://127.0.0.1:27124';
  const apiKey = process.env.OBSIDIAN_API_KEY;
  if (!apiKey) {
    throw new Error(
      '需要設定 OBSIDIAN_API_KEY 環境變數。\n' +
      '請在 Obsidian 安裝 Local REST API 外掛並取得 API key。',
    );
  }
  return { apiUrl, apiKey };
}

async function obsidianPut(config: ObsidianConfig, path: string, content: string): Promise<void> {
  const url = `${config.apiUrl}/vault/${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'text/markdown',
    },
    body: content,
  });
  if (!res.ok) {
    throw new Error(`Obsidian API error: ${res.status} ${res.statusText}`);
  }
}

function sanitizePath(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}

export function registerObsidianCommand(program: Command): void {
  const obsidian = program
    .command('obsidian')
    .description('Obsidian 整合');

  obsidian
    .command('sync <course-id>')
    .description('同步課程內容到 Obsidian')
    .option('--all', '同步所有課程')
    .option('--prefix <path>', 'Obsidian 資料夾前綴', 'E3')
    .action(async (courseId: string, opts) => {
      try {
        const obsConfig = getObsidianConfig();
        requireAuth();
        const config = loadConfig();
        const client = new MoodleClient({
          token: config.token,
          sessionCookie: config.session,
          baseUrl: getBaseUrl(),
        });
        const allCourses = await getEnrolledCourses(client, 'all');

        let courseIds: number[];
        if (opts.all) {
          courseIds = allCourses.map(c => c.id);
        } else {
          courseIds = [Number(courseId)];
        }

        const courses = allCourses;

        for (const cid of courseIds) {
          const course = courses.find(c => c.id === cid);
          if (!course) continue;

          const coursePath = `${opts.prefix}/${sanitizePath(course.fullname)}`;
          const spinner = ora(`同步: ${course.fullname}`).start();

          // Sync course contents
          const sections = await getCourseContents(client, cid);
          const lines: string[] = [
            `---`,
            `course_id: ${cid}`,
            `shortname: "${course.shortname}"`,
            `e3_url: "https://e3p.nycu.edu.tw/course/view.php?id=${cid}"`,
            `synced_at: "${new Date().toISOString()}"`,
            `---`,
            ``,
            `# ${course.fullname}`,
            ``,
          ];

          for (const section of sections) {
            if (!section.modules.length) continue;
            lines.push(`## ${section.name || `第 ${section.section} 週`}`);
            lines.push('');

            for (const mod of section.modules) {
              lines.push(`### ${mod.name}`);
              if (mod.description) {
                // Strip HTML tags for markdown
                const desc = mod.description.replace(/<[^>]*>/g, '').trim();
                if (desc) lines.push(desc);
              }
              if (mod.contents) {
                for (const file of mod.contents) {
                  if (file.type === 'file') {
                    lines.push(`- 📎 [${file.filename}](${file.fileurl})`);
                  }
                }
              }
              lines.push('');
            }
          }

          await obsidianPut(obsConfig, `${coursePath}/課程大綱.md`, lines.join('\n'));

          // Sync pending assignments
          const allPending = await getPendingAssignmentsViaCalendar(client, 90);
          const pending = allPending.filter(a => a.courseId === cid);
          if (pending.length > 0) {
            const assignLines: string[] = [
              `---`,
              `course_id: ${cid}`,
              `type: assignments`,
              `synced_at: "${new Date().toISOString()}"`,
              `---`,
              ``,
              `# ${course.fullname} - 未完成作業`,
              ``,
            ];

            for (const a of pending) {
              const dueStr = a.duedate > 0
                ? new Date(a.duedate * 1000).toISOString().slice(0, 16)
                : '無期限';

              assignLines.push(`## ${a.name}`);
              assignLines.push(`- **截止日期**: ${dueStr}`);
              assignLines.push(`- **狀態**: ${a.isOverdue ? '⚠️ 逾期' : a.submissionStatus}`);
              assignLines.push(`- **連結**: [開啟 E3](https://e3p.nycu.edu.tw/mod/assign/view.php?id=${a.cmid})`);
              if (a.intro) {
                const desc = a.intro.replace(/<[^>]*>/g, '').trim();
                if (desc) assignLines.push(`\n${desc}`);
              }
              assignLines.push('');
            }

            await obsidianPut(obsConfig, `${coursePath}/作業.md`, assignLines.join('\n'));
          }

          spinner.succeed(`${course.fullname} 同步完成`);
        }

        console.log(chalk.green('\n✓ Obsidian 同步完成'));
      } catch (err: unknown) {
        console.error(chalk.red(`錯誤: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
