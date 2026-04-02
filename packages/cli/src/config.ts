import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

interface E3Config {
  /** Moodle web service token (from /user/managetoken.php) */
  token?: string;
  /** MoodleSession cookie value (from browser) */
  session?: string;
  /** Auth mode */
  authMode?: 'token' | 'session';
  userid?: number;
  fullname?: string;
  sesskey?: string;
  baseUrl?: string;
  /** Obsidian vault path */
  vaultPath?: string;
  /** Course names to exclude from sync (partial match) */
  excludedCourses?: string[];
  /** File extensions to exclude from download (e.g. mp4, mkv) */
  excludedExtensions?: string[];
}

const CONFIG_PATH = join(homedir(), '.e3rc.json');

export function loadConfig(): E3Config {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveConfig(config: E3Config): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

export function clearConfig(): void {
  saveConfig({});
  // Also remove credentials
  try { unlinkSync(ENV_PATH); } catch { /* ignore if doesn't exist */ }
}

export function getUserId(): number {
  const config = loadConfig();
  if (!config.userid) {
    throw new Error('尚未登入。請先執行 `e3 login`');
  }
  return config.userid;
}

export function getBaseUrl(): string {
  const config = loadConfig();
  return config.baseUrl ?? 'https://e3p.nycu.edu.tw';
}

export function requireAuth(): void {
  const config = loadConfig();
  if (!config.token && !config.session) {
    throw new Error(
      '尚未登入。請使用以下方式登入：\n' +
      '  e3 login --session <MoodleSession cookie>  (從瀏覽器複製)\n' +
      '  e3 login --token <token>                    (從 E3 安全金鑰頁面取得)',
    );
  }
}

const ENV_PATH = join(homedir(), '.e3.env');

/** Save credentials to ~/.e3.env (separate from config, gitignored) */
export function saveCredentials(username: string, password: string): void {
  // Preserve existing env vars (like VAULT_PATH)
  let existing: Record<string, string> = {};
  try {
    const raw = readFileSync(ENV_PATH, 'utf-8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match) existing[match[1]] = match[2];
    }
  } catch { /* file doesn't exist yet */ }

  existing['E3_USERNAME'] = username;
  existing['E3_PASSWORD'] = password;

  const content = Object.entries(existing).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  writeFileSync(ENV_PATH, content, { encoding: 'utf-8', mode: 0o600 });
}

/** Get stored credentials from ~/.e3.env */
export function getCredentials(): { username: string; password: string } | null {
  try {
    const raw = readFileSync(ENV_PATH, 'utf-8');
    const username = raw.match(/^E3_USERNAME=(.+)$/m)?.[1]?.trim();
    const password = raw.match(/^E3_PASSWORD=(.+)$/m)?.[1]?.trim();
    if (username && password) return { username, password };
  } catch {
    // file doesn't exist
  }
  return null;
}

/** Get vault path from config or env */
export function getVaultPath(): string {
  // Check ~/.e3rc.json first
  const config = loadConfig();
  if (config.vaultPath) return config.vaultPath;

  // Fallback to ~/.e3.env
  try {
    const raw = readFileSync(ENV_PATH, 'utf-8');
    const vault = raw.match(/^VAULT_PATH=(.+)$/m)?.[1]?.trim();
    if (vault) return vault;
  } catch { /* ignore */ }

  throw new Error(
    'Obsidian vault 路徑未設定。請用以下任一方式設定:\n' +
    '  1. e3 config set vaultPath "C:\\path\\to\\vault"\n' +
    '  2. 在 ~/.e3.env 加入 VAULT_PATH=C:\\path\\to\\vault',
  );
}

/** Get excluded courses from config */
export function getExcludedCourses(): string[] {
  const config = loadConfig();
  return config.excludedCourses ?? [];
}

/** Get excluded file extensions from config */
export function getExcludedExtensions(): string[] {
  const config = loadConfig();
  return config.excludedExtensions ?? [];
}

/**
 * Auto-relogin: try to get a new token using stored credentials from ~/.e3.env.
 * Returns the new token if successful, null otherwise.
 */
export async function tryRelogin(): Promise<string | null> {
  const creds = getCredentials();
  if (!creds) return null;

  try {
    const url = new URL('/login/token.php', getBaseUrl());
    const body = new URLSearchParams({
      username: creds.username,
      password: creds.password,
      service: 'moodle_mobile_app',
    });
    const res = await fetch(url.toString(), { method: 'POST', body });
    const data = await res.json() as { token?: string; error?: string };
    if (data.token) {
      const config = loadConfig();
      config.token = data.token;
      config.authMode = 'token';
      saveConfig(config);
      return data.token;
    }
  } catch {
    // ignore
  }
  return null;
}
