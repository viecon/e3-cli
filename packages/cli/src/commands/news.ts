import { SECONDS_PER_DAY } from '@e3/core';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getEnrolledCourses, getForums, getForumDiscussions } from '@e3/core';
import { printJson, formatDate } from '../output.js';
import { stripHtml } from '../html.js';
import { createClient } from '../createClient.js';


export function registerNewsCommand(program: Command): void {
  program
    .command('news')
    .description('查看課程公告')
    .option('--course <id>', '指定課程 ID')
    .option('--days <n>', '過去幾天的公告', '14')
    .option('--json', 'JSON 格式輸出')
    .action(async (opts) => {
      try {
        const client = createClient();

        const spinner = ora('取得公告...').start();

        let courseids: number[];
        if (opts.course) {
          courseids = [Number(opts.course)];
        } else {
          const courses = await getEnrolledCourses(client, 'inprogress');
          courseids = courses.map(c => c.id);
        }

        const sinceTimestamp = Math.floor(Date.now() / 1000) - Number(opts.days) * SECONDS_PER_DAY;

        // Get news forums for all courses
        const forums = await getForums(client, courseids);
        const newsForums = forums.filter(f => f.type === 'news');

        const allNews: { course: string; subject: string; message: string; time: number; author: string }[] = [];

        for (const forum of newsForums) {
          const { discussions } = await getForumDiscussions(client, forum.id, -1, 0, 20);
          const courseName = forum.name === '公告' ? `Course ${forum.course}` : forum.name;

          for (const d of discussions) {
            if (d.timemodified < sinceTimestamp) continue;
            allNews.push({
              course: courseName,
              subject: d.subject || d.name,
              message: stripHtml(d.message),
              time: d.timemodified,
              author: d.userfullname });
          }
        }

        // Sort by time descending
        allNews.sort((a, b) => b.time - a.time);
        spinner.stop();

        if (opts.json) {
          printJson(allNews);
          return;
        }

        if (allNews.length === 0) {
          console.log(chalk.gray(`過去 ${opts.days} 天沒有公告`));
          return;
        }

        for (const news of allNews) {
          console.log(`${chalk.gray(formatDate(news.time))} ${chalk.bold(news.subject)}`);
          console.log(`  ${chalk.cyan(news.author)}`);
          // Show first 3 lines of message
          const lines = news.message.split('\n').filter(l => l.trim());
          for (const line of lines.slice(0, 3)) {
            console.log(`  ${line}`);
          }
          if (lines.length > 3) {
            console.log(chalk.gray(`  ... (${lines.length - 3} more lines)`));
          }
          console.log('');
        }
      } catch (err: unknown) {
        console.error(chalk.red(`錯誤: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
