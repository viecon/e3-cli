import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getSiteInfo, MoodleClient, getEnrolledCourses } from '@e3/core';
import { saveConfig, clearConfig, loadConfig, getBaseUrl, saveCredentials, getCredentials } from '../config.js';

export function registerAuthCommands(program: Command): void {
  program
    .command('login')
    .description('登入 E3 系統')
    .option('--token <token>', '使用 Moodle web service token 登入')
    .option('--session <cookie>', '使用 MoodleSession cookie 登入（從瀏覽器複製）')
    .option('-u, --username <user>', 'E3 帳號（直接用帳密取得 token）')
    .option('-p, --password <pass>', 'E3 密碼')
    .action(async (opts) => {
      try {
        const baseUrl = getBaseUrl();

        // Username + password login
        if (opts.username && opts.password) {
          const spinner = ora('用帳密取得 token...').start();
          const loginUrl = new URL('/login/token.php', baseUrl);
          const body = new URLSearchParams({
            username: opts.username,
            password: opts.password,
            service: 'moodle_mobile_app',
          });
          const res = await fetch(loginUrl.toString(), { method: 'POST', body });
          const data = await res.json() as { token?: string; error?: string };

          if (!data.token) {
            spinner.fail(`登入失敗: ${data.error ?? '未知錯誤'}`);
            console.log(chalk.yellow('如果 E3 要求二階段驗證，請到 E3 設定中放寬為「新裝置才需要」'));
            process.exit(1);
          }

          const client = new MoodleClient({ token: data.token, baseUrl });
          const info = await getSiteInfo(client);
          spinner.succeed(`登入成功！歡迎 ${chalk.bold(info.fullname)}`);

          saveConfig({
            token: data.token,
            authMode: 'token',
            userid: info.userid,
            fullname: info.fullname,
            baseUrl,
          });
          saveCredentials(opts.username, opts.password);

          console.log(chalk.gray('Token 已儲存至 ~/.e3rc.json'));
          console.log(chalk.gray('帳密已儲存至 ~/.e3.env (chmod 600)'));
          console.log(chalk.green('✓ Token 過期時會自動用帳密重新取得'));
          return;
        }

        if (!opts.token && !opts.session) {
          console.log(chalk.bold('\n📋 E3 登入方式\n'));
          console.log('因為 E3 使用交大 SSO + 二階段驗證，需要手動取得認證資訊：\n');

          console.log(chalk.cyan('方式 1: 帳號密碼（推薦，支援自動重登）'));
          console.log(`  執行: ${chalk.green('e3 login -u <帳號> -p <密碼>')}`);
          console.log('  需要在 E3 設定中將二階段驗證改為「新裝置才需要」\n');

          console.log(chalk.cyan('方式 2: MoodleSession Cookie'));
          console.log('  1. 在瀏覽器登入 E3 (https://e3p.nycu.edu.tw)');
          console.log('  2. 按 F12 開啟開發者工具 → Application → Cookies');
          console.log('  3. 找到 MoodleSession 的值');
          console.log(`  4. 執行: ${chalk.green('e3 login --session <cookie值>')}\n`);

          console.log(chalk.cyan('方式 2: Web Service Token'));
          console.log('  1. 登入 E3 後到個人偏好設定 → 安全金鑰');
          console.log('  2. 建立新的 token');
          console.log(`  3. 執行: ${chalk.green('e3 login --token <token值>')}\n`);

          console.log(chalk.cyan('方式 3: 使用瀏覽器 Extension'));
          console.log('  安裝 E3 助手 Extension 後，它會自動偵測登入狀態\n');

          return;
        }

        if (opts.session) {
          const spinner = ora('驗證 session...').start();

          const client = new MoodleClient({
            sessionCookie: opts.session,
            baseUrl,
          });

          // core_webservice_get_site_info 在 E3 AJAX API 被停用
          // 改用 fetchSesskey 驗證 session 有效性，並從頁面抓使用者資訊
          let userid: number | undefined;
          let fullname: string | undefined;

          try {
            // Try REST API first (unlikely to work with session, but try)
            const info = await getSiteInfo(client);
            userid = info.userid;
            fullname = info.fullname;
          } catch {
            // Fallback: fetch E3 main page to extract user info
            const pageRes = await fetch(`${baseUrl}/my/`, {
              headers: { Cookie: `MoodleSession=${opts.session}` },
              redirect: 'manual',
            });

            if (pageRes.status !== 200) {
              spinner.fail('Session 無效或已過期');
              process.exit(1);
            }

            const html = await pageRes.text();
            const useridMatch = html.match(/data-userid="(\d+)"/);
            const nameMatch = html.match(/data-userid="\d+"[^>]*>([^<]+)</);
            userid = useridMatch ? Number(useridMatch[1]) : undefined;
            fullname = nameMatch?.[1]?.trim();

            if (!userid) {
              // Try another pattern
              const uid2 = html.match(/"userid"\s*:\s*(\d+)/);
              userid = uid2 ? Number(uid2[1]) : undefined;
            }

            // Verify we can actually call AJAX API
            try {
              await getEnrolledCourses(client, 'inprogress');
            } catch {
              spinner.fail('Session 有效但 API 無法存取');
              process.exit(1);
            }
          }

          spinner.succeed(`登入成功！${fullname ? `歡迎 ${chalk.bold(fullname)}` : '(userid: ' + userid + ')'}`);

          saveConfig({
            session: opts.session,
            authMode: 'session',
            userid,
            fullname,
            baseUrl,
          });

          console.log(chalk.gray('Session 已儲存至 ~/.e3rc.json'));
          console.log(chalk.yellow('⚠️  Session 會過期，過期後需要重新執行 e3 login'));
        }

        if (opts.token) {
          const spinner = ora('驗證 token...').start();

          const client = new MoodleClient({
            token: opts.token,
            baseUrl,
          });

          const info = await getSiteInfo(client);
          spinner.succeed(`登入成功！歡迎 ${chalk.bold(info.fullname)}`);

          saveConfig({
            token: opts.token,
            authMode: 'token',
            userid: info.userid,
            fullname: info.fullname,
            baseUrl,
          });

          console.log(chalk.gray('Token 已儲存至 ~/.e3rc.json'));
        }
      } catch (err: unknown) {
        console.error(chalk.red(`錯誤: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  program
    .command('logout')
    .description('登出 E3 系統')
    .action(() => {
      clearConfig();
      console.log(chalk.green('已登出，認證資訊已清除'));
    });

  program
    .command('whoami')
    .description('顯示目前登入身份')
    .action(async () => {
      const config = loadConfig();
      if (!config.token && !config.session) {
        console.log(chalk.yellow('尚未登入。請先執行 `e3 login`'));
        return;
      }

      const spinner = ora('查詢中...').start();
      try {
        if (config.fullname) {
          spinner.stop();
          console.log(`姓名: ${chalk.bold(config.fullname)}`);
          console.log(`用戶 ID: ${config.userid}`);
          console.log(`認證方式: ${config.authMode === 'session' ? 'Session Cookie' : 'Token'}`);

          // Verify session is still valid
          const client = new MoodleClient({
            token: config.token,
            sessionCookie: config.session,
            baseUrl: getBaseUrl(),
          });
          try {
            await getEnrolledCourses(client, 'inprogress');
            console.log(`狀態: ${chalk.green('有效')}`);
          } catch {
            console.log(`狀態: ${chalk.red('已過期，請重新登入')}`);
          }
        } else {
          spinner.fail('無使用者資訊，請重新登入');
        }
      } catch {
        spinner.fail('認證已過期或無效，請重新登入');
      }
    });
}
