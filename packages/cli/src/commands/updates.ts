import { SECONDS_PER_DAY } from '@e3/core';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getEnrolledCourses, getCourseUpdates, getCourseContents } from '@e3/core';
import { printJson, formatDate } from '../output.js';
import { createClient } from '../createClient.js';

export function registerUpdatesCommand(program: Command): void {
  program
    .command('updates [course-id]')
    .description('查看課程最近更新')
    .option('--days <n>', '過去幾天', '7')
    .option('--json', 'JSON 格式輸出')
    .action(async (courseId: string | undefined, opts) => {
      try {
        const client = createClient();

        const spinner = ora('取得更新...').start();
        const since = Math.floor(Date.now() / 1000) - Number(opts.days) * SECONDS_PER_DAY;

        let courseids: { id: number; name: string }[];
        if (courseId) {
          courseids = [{ id: Number(courseId), name: `Course ${courseId}` }];
        } else {
          const courses = await getEnrolledCourses(client, 'inprogress');
          courseids = courses.map(c => ({ id: c.id, name: c.shortname }));
        }

        const allUpdates: {
          course: string;
          updates: { module: string; type: string; time: number | null }[];
        }[] = [];

        for (const course of courseids) {
          try {
            const result = await getCourseUpdates(client, course.id, since);
            if (!result.instances?.length) continue;

            // Build module ID → name map from course contents
            const moduleNames = new Map<number, string>();
            try {
              const sections = await getCourseContents(client, course.id);
              for (const s of sections) {
                for (const m of s.modules) {
                  moduleNames.set(m.id, m.name);
                }
              }
            } catch { /* can't resolve names, use IDs */ }

            const updates: { module: string; type: string; time: number | null }[] = [];

            for (const instance of result.instances) {
              const moduleName = moduleNames.get(instance.id) || `#${instance.id}`;
              for (const update of instance.updates) {
                updates.push({
                  module: moduleName,
                  type: update.name,
                  time: update.timeupdated ?? null });
              }
            }

            if (updates.length > 0) {
              // Sort: items with time first (desc), then without time
              updates.sort((a, b) => {
                if (a.time && b.time) return b.time - a.time;
                if (a.time) return -1;
                if (b.time) return 1;
                return 0;
              });
              allUpdates.push({ course: course.name, updates });
            }
          } catch {
            // Course might not support this API
          }
        }

        spinner.stop();

        if (opts.json) {
          printJson(allUpdates);
          return;
        }

        if (allUpdates.length === 0) {
          console.log(chalk.gray(`過去 ${opts.days} 天沒有課程更新`));
          return;
        }

        for (const course of allUpdates) {
          console.log(chalk.bold.cyan(`[${course.course}]`) + ` 過去 ${opts.days} 天:`);
          for (const u of course.updates.slice(0, 10)) {
            const typeLabel =
              u.type === 'configuration' ? chalk.yellow('設定') :
              u.type === 'contentfiles' ? chalk.green('教材') :
              u.type === 'fileareas' ? chalk.green('檔案') :
              u.type === 'introattachmentfiles' ? chalk.green('附件') :
              u.type === 'gradeitems' ? chalk.magenta('成績') :
              u.type === 'grades' ? chalk.magenta('評分') :
              u.type === 'submissions' ? chalk.cyan('提交') :
              u.type === 'discussions' ? chalk.blue('討論') :
              chalk.gray(u.type);
            const timeStr = u.time ? chalk.gray(formatDate(u.time)) : '';
            console.log(`  ${typeLabel} ${u.module} ${timeStr}`);
          }
          if (course.updates.length > 10) {
            console.log(chalk.gray(`  ... 還有 ${course.updates.length - 10} 項更新`));
          }
          console.log('');
        }
      } catch (err: unknown) {
        console.error(chalk.red(`錯誤: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
