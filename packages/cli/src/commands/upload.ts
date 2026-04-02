import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { uploadFiles, saveSubmission } from '@e3/core';
import { formatFileSize } from '../output.js';
import { createClient } from '../createClient.js';

export function registerUploadCommand(program: Command): void {
  program
    .command('upload <assignment-id> <files...>')
    .description('上傳檔案並提交作業')
    .option('--no-submit', '只上傳不提交')
    .action(async (assignmentId: string, filePaths: string[], opts) => {
      try {
        const client = createClient();
        const id = Number(assignmentId);
        if (isNaN(id)) { console.error(chalk.red('Invalid assignment ID')); process.exit(1); }

        // Read files
        const files = filePaths.map(fp => {
          const buffer = readFileSync(fp);
          const filename = basename(fp);
          console.log(`  ${chalk.cyan(filename)} ${chalk.gray(formatFileSize(buffer.length))}`);
          return { blob: new Blob([buffer]), filename };
        });

        console.log('');

        // Upload
        const spinner = ora('上傳檔案中...').start();
        const itemid = await uploadFiles(client, files, (uploaded, total, name) => {
          if (name === 'done') {
            spinner.text = '上傳完成';
          } else {
            spinner.text = `上傳中 [${uploaded + 1}/${total}] ${name}`;
          }
        });
        spinner.succeed(`所有檔案已上傳到草稿區 (itemid: ${itemid})`);

        // Submit
        if (opts.submit !== false) {
          const submitSpinner = ora('提交作業中...').start();
          await saveSubmission(client, id, itemid);
          submitSpinner.succeed('作業提交成功！');
        } else {
          console.log(chalk.yellow('檔案已上傳，但未提交（使用 --no-submit 選項）'));
        }
      } catch (err: unknown) {
        console.error(chalk.red(`錯誤: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
