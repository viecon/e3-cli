import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getEnrolledCourses, getCourseContents } from '@e3/core';
import type { CourseSection } from '@e3/core';
import { createClient } from '../createClient.js';
import { getVaultPath, getExcludedCourses } from '../config.js';

export function registerDiffCommand(program: Command): void {
  program
    .command('diff')
    .description('比較 E3 和本地 vault 的差異（找出新教材和缺少的筆記）')
    .option('--json', 'JSON 格式輸出')
    .action(async (opts) => {
      try {
        const client = createClient();
        const vault = getVaultPath();
        const excludedCourses = getExcludedCourses();

        const spinner = ora('比對差異...').start();
        const courses = await getEnrolledCourses(client, 'inprogress');

        const results: {
          course: string;
          newSlides: string[];
          missingNotes: string[];
        }[] = [];

        for (const course of courses) {
          if (excludedCourses.some(k => course.fullname.toLowerCase().includes(k.toLowerCase()))) continue;

          // Extract folder name (same logic as sync)
          const parts = course.fullname.split('.');
          const lastPart = parts[parts.length - 1] ?? course.fullname;
          const afterChinese = lastPart.match(/\s([A-Z][a-zA-Z\s:&\-(),]+)$/);
          const folderName = afterChinese
            ? afterChinese[1].trim().replace(/:/g, ' -').replace(/[<>"/\\|?*]/g, '_')
            : lastPart.trim().replace(/[<>:"/\\|?*]/g, '_');

          const courseDir = join(vault, folderName);
          const slidesDir = join(courseDir, 'slides');

          let sections: CourseSection[];
          try {
            sections = await getCourseContents(client, course.id);
          } catch {
            continue;
          }

          const newSlides: string[] = [];
          const missingNotes: string[] = [];

          for (const section of sections) {
            for (const mod of section.modules) {
              if (!mod.contents) continue;
              for (const content of mod.contents) {
                if (content.type !== 'file') continue;
                const ext = content.filename.split('.').pop()?.toLowerCase() ?? '';
                if (['mp4', 'mkv', 'avi', 'mov', 'pkt'].includes(ext)) continue;
                if (!['pdf', 'pptx', 'ppt', 'docx', 'doc'].includes(ext)) continue;

                const slidePath = join(slidesDir, content.filename);
                if (!existsSync(slidePath)) {
                  newSlides.push(content.filename);
                }

                // Check for corresponding note
                const noteName = content.filename.replace(/\.[^.]+$/, '');
                const notePath = join(courseDir, noteName + '.md');
                if (existsSync(slidePath) && !existsSync(notePath)) {
                  missingNotes.push(noteName);
                }
              }
            }
          }

          if (newSlides.length > 0 || missingNotes.length > 0) {
            results.push({ course: folderName, newSlides, missingNotes });
          }
        }

        spinner.stop();

        if (opts.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }

        if (results.length === 0) {
          console.log(chalk.green('本地 vault 與 E3 完全同步'));
          return;
        }

        for (const r of results) {
          console.log(chalk.bold.cyan(`[${r.course}]`));
          for (const s of r.newSlides) {
            console.log(chalk.green(`  + ${s}`));
          }
          for (const n of r.missingNotes) {
            console.log(chalk.yellow(`  ? ${n}.md (缺少筆記)`));
          }
          console.log('');
        }

        const totalNew = results.reduce((a, r) => a + r.newSlides.length, 0);
        const totalMissing = results.reduce((a, r) => a + r.missingNotes.length, 0);
        console.log(chalk.gray(`${totalNew} 新教材, ${totalMissing} 缺少筆記`));
      } catch (err: unknown) {
        console.error(chalk.red(`錯誤: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
