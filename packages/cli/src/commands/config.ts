import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../config.js';

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('管理設定');

  configCmd
    .command('set <key> <value>')
    .description('設定值 (vaultPath, excludedCourses, excludedExtensions, baseUrl)')
    .action((key: string, value: string) => {
      const config = loadConfig();
      const validKeys = ['vaultPath', 'baseUrl', 'excludedCourses', 'excludedExtensions'];

      if (!validKeys.includes(key)) {
        console.error(chalk.red(`無效的設定 key: ${key}`));
        console.log(`可用的 key: ${validKeys.join(', ')}`);
        process.exit(1);
      }

      if (key === 'excludedCourses' || key === 'excludedExtensions') {
        (config as Record<string, unknown>)[key] = value.split(',').map(s => s.trim());
      } else {
        (config as Record<string, unknown>)[key] = value;
      }

      saveConfig(config);
      console.log(chalk.green(`${key} = ${value}`));
    });

  configCmd
    .command('get [key]')
    .description('查看設定')
    .action((key?: string) => {
      const config = loadConfig();

      if (key) {
        const val = (config as Record<string, unknown>)[key];
        if (val !== undefined) {
          console.log(Array.isArray(val) ? val.join(', ') : String(val));
        } else {
          console.log(chalk.gray('(未設定)'));
        }
      } else {
        // Show all non-sensitive config
        console.log(chalk.bold('E3 設定 (~/.e3rc.json)\n'));
        console.log(`  authMode: ${config.authMode ?? chalk.gray('(未設定)')}`);
        console.log(`  baseUrl: ${config.baseUrl ?? 'https://e3p.nycu.edu.tw'}`);
        console.log(`  vaultPath: ${config.vaultPath ?? chalk.gray('(未設定)')}`);
        console.log(`  excludedCourses: ${config.excludedCourses?.join(', ') ?? chalk.gray('(未設定)')}`);
        console.log(`  excludedExtensions: ${config.excludedExtensions?.join(', ') ?? chalk.gray('(未設定)')}`);
        console.log(`  userid: ${config.userid ?? chalk.gray('(未設定)')}`);
        console.log(`  fullname: ${config.fullname ?? chalk.gray('(未設定)')}`);
        console.log(`  token: ${config.token ? config.token.slice(0, 8) + '...' : chalk.gray('(未設定)')}`);
      }
    });
}
