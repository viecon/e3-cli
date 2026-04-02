import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { MoodleClient, listCourseFiles, getEnrolledCourses } from '@e3/core';
import { loadConfig, getBaseUrl, requireAuth } from '../config.js';
import { formatFileSize, printJson } from '../output.js';

export function registerDownloadCommand(program: Command): void {
  program
    .command('download <course-id>')
    .description('下載課程教材')
    .option('--type <types>', '檔案類型篩選，逗號分隔 (例: pdf,pptx,docx)')
    .option('-o, --output <dir>', '輸出目錄', '.')
    .option('--list', '只列出檔案，不下載')
    .option('--json', 'JSON 格式輸出')
    .action(async (courseId: string, opts) => {
      try {
        requireAuth();
        const config = loadConfig();
        const client = new MoodleClient({
          token: config.token,
          sessionCookie: config.session,
          baseUrl: getBaseUrl(),
        });

        const typeFilter = opts.type?.split(',').map((t: string) => t.trim().toLowerCase());

        const spinner = ora('取得課程教材列表...').start();
        const files = await listCourseFiles(client, Number(courseId), typeFilter);
        spinner.stop();

        if (files.length === 0) {
          console.log(chalk.yellow('沒有找到符合條件的檔案'));
          return;
        }

        if (opts.json) {
          printJson(files);
          return;
        }

        if (opts.list) {
          console.log(chalk.bold(`共 ${files.length} 個檔案:\n`));
          for (const f of files) {
            console.log(`  ${chalk.cyan(f.filename)} ${chalk.gray(formatFileSize(f.filesize))} - ${f.moduleName}`);
          }
          return;
        }

        // Get course name for folder
        const courses = await getEnrolledCourses(client, 'all');
        const course = courses.find(c => c.id === Number(courseId));
        const folderName = course
          ? course.shortname.replace(/[<>:"/\\|?*]/g, '_')
          : `course_${courseId}`;

        const outputDir = join(opts.output, folderName);
        mkdirSync(outputDir, { recursive: true });

        console.log(chalk.bold(`下載 ${files.length} 個檔案到 ${outputDir}/\n`));

        let downloaded = 0;
        let failed = 0;

        for (const file of files) {
          const dlSpinner = ora(`[${downloaded + failed + 1}/${files.length}] ${file.filename}`).start();
          try {
            const buffer = await client.downloadFile(file.fileurl);
            const filePath = join(outputDir, file.filename);
            writeFileSync(filePath, buffer);

            downloaded++;
            dlSpinner.succeed(`${file.filename} ${chalk.gray(formatFileSize(file.filesize))}`);
          } catch (err: unknown) {
            failed++;
            dlSpinner.fail(`${file.filename} - ${chalk.red(err instanceof Error ? err.message : 'failed')}`);
          }
        }

        console.log(`\n${chalk.green(`✓ 完成: ${downloaded} 個下載成功`)}${failed > 0 ? chalk.red(`, ${failed} 個失敗`) : ''}`);
      } catch (err: unknown) {
        console.error(chalk.red(`錯誤: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
