import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  MoodleClient,
  getEnrolledCourses,
  getCourseContents,
  getPendingAssignmentsViaCalendar,
} from '@e3/core';
import type { CourseSection } from '@e3/core';
import { loadConfig, getBaseUrl, requireAuth, tryRelogin, getVaultPath } from '../config.js';

// Vault path from ~/.e3.env or default

// 排除的課程
const EXCLUDED_COURSES = [
  '服務學習', 'Service Learning',
  '高效能計算概論', 'High-Performance Computing',
  '日文', 'Japanese',
  'Gender Equity', '性別平等',
];

// 排除的檔案類型
const EXCLUDED_EXTENSIONS = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'pkt'];

// 講義檔案類型
const SLIDE_EXTENSIONS = ['pdf', 'pptx', 'ppt', 'docx', 'doc', 'xlsx'];

function isExcludedCourse(fullname: string): boolean {
  return EXCLUDED_COURSES.some(k => fullname.toLowerCase().includes(k.toLowerCase()));
}

function isExcludedFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return EXCLUDED_EXTENSIONS.includes(ext);
}

function isSlideFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return SLIDE_EXTENSIONS.includes(ext);
}

/**
 * 從檔名提取章節 key，用來把多個版本合併成一個筆記。
 * 例如:
 *   "L1 Storage Devices_v2.pptx"      → "L1 Storage Devices"
 *   "L1 Storage Devices_260309v1.pptx" → "L1 Storage Devices"
 *   "L2 IO Stacks260323_v2.pptx"      → "L2 IO Stacks"
 *   "Chapter 1 Computer Abstractions and Technology.pdf" → "Chapter 1 Computer Abstractions and Technology"
 *   "1-overview.pdf" → "1-overview"
 */
function chapterKey(filename: string): string {
  // 去掉副檔名
  let name = filename.replace(/\.[^.]+$/, '');

  // 去掉版本後綴: _v2, _v1, _260309v1, 260323_v2 等
  // Pattern: 可選的日期(6位數字) + 可選的 _v 或 v + 數字
  name = name.replace(/[_]?\d{6}[_]?v?\d*$/i, '');
  name = name.replace(/[_]?v\d+$/i, '');

  return name.trim();
}

function courseFolderName(_shortname: string, fullname: string): string {
  const parts = fullname.split('.');
  const lastPart = parts[parts.length - 1] ?? fullname;

  // Try to get the full English portion (everything after Chinese text + space)
  // e.g. "生成式AI概論：從理論到應用 Introduction to Generative AI: From Theory to Application"
  //   → "Introduction to Generative AI From Theory to Application"
  const afterChinese = lastPart.match(/\s([A-Z][a-zA-Z\s:&\-(),]+)$/);
  if (afterChinese) {
    return afterChinese[1].trim()
      .replace(/:/g, ' -')
      .replace(/[<>"/\\|?*]/g, '_');
  }

  // Fallback: find longest English substring
  const englishMatch = lastPart.match(/[A-Z][a-zA-Z\s:&\-()]+/g);
  if (englishMatch) {
    const longest = englishMatch.sort((a, b) => b.length - a.length)[0];
    return longest.trim().replace(/[<>:"/\\|?*]/g, '_');
  }

  return lastPart.trim().replace(/[<>:"/\\|?*]/g, '_');
}

function extractShortCourseName(fullname: string): string {
  const parts = fullname.split('.');
  const lastPart = parts[parts.length - 1] ?? fullname;
  const chineseMatch = lastPart.match(/[\u4e00-\u9fff\uff08\uff09()]+/g);
  if (chineseMatch) return chineseMatch.join('').slice(0, 10);
  const englishMatch = lastPart.match(/[A-Z][a-zA-Z\s]+/);
  return (englishMatch?.[0] ?? lastPart).trim().slice(0, 20);
}

function formatDateISO(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function formatDateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

interface ChapterGroup {
  key: string;            // e.g. "L1 Storage Devices"
  slides: string[];       // e.g. ["L1 Storage Devices_v2.pptx", "L1 Storage Devices_260309v1.pptx"]
  latestSlide: string;    // most recent version
}


export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('自動同步 E3 講義和作業到 Obsidian')
    .option('--vault <path>', 'Obsidian vault 路徑', getVaultPath())
    .option('--dry-run', '只顯示會做什麼，不實際寫入')
    .option('--json', 'JSON 格式輸出（列出新下載的講義，供 AI 生成筆記）')
    .action(async (opts) => {
      try {
        requireAuth();
        let config = loadConfig();
        let client = new MoodleClient({
          token: config.token,
          sessionCookie: config.session,
          baseUrl: getBaseUrl(),
        });

        // Verify token works, auto-relogin if expired
        try {
          await getEnrolledCourses(client, 'inprogress');
        } catch {
          const newToken = await tryRelogin();
          if (newToken) {
            config = loadConfig();
            client = new MoodleClient({ token: newToken, baseUrl: getBaseUrl() });
          }
        }

        const vault = opts.vault;
        const dryRun = opts.dryRun ?? false;
        const jsonOutput = opts.json ?? false;

        if (!jsonOutput) {
          console.log(chalk.bold(`\n📚 E3 → Obsidian 同步\n`));
          console.log(`Vault: ${chalk.cyan(vault)}`);
          if (dryRun) console.log(chalk.yellow('(Dry run 模式)\n'));
          else console.log('');
        }

        // Track new slides for JSON output (so Claude Code can generate notes)
        const newSlidesList: { course: string; chapter: string; slideFiles: string[]; notePath: string; slidesDir: string }[] = [];

        // 1. Get courses
        const coursesSpinner = ora('取得課程列表...').start();
        const allCourses = await getEnrolledCourses(client, 'inprogress');
        const courses = allCourses.filter(c => !isExcludedCourse(c.fullname));
        coursesSpinner.succeed(`${courses.length} 門課程（排除 ${allCourses.length - courses.length} 門）`);

        // 2. Download new slides + generate chapter notes
        const lectureSpinner = ora('同步講義...').start();
        let newSlides = 0;
        let newNotes = 0;
        let skippedSlides = 0;

        for (const course of courses) {
          const folderName = courseFolderName(course.shortname, course.fullname);
          const courseDir = join(vault, folderName);
          const slidesDir = join(courseDir, 'slides');

          let sections: CourseSection[];
          try {
            sections = await getCourseContents(client, course.id);
          } catch {
            continue;
          }

          // Collect all slide files for this course
          const allSlideFiles: string[] = [];
          let hasNewSlides = false;

          for (const section of sections) {
            for (const mod of section.modules) {
              if (!mod.contents) continue;
              for (const content of mod.contents) {
                if (content.type !== 'file') continue;
                if (isExcludedFile(content.filename)) continue;
                if (!isSlideFile(content.filename)) continue;

                allSlideFiles.push(content.filename);
                const slidePath = join(slidesDir, content.filename);

                if (existsSync(slidePath)) {
                  skippedSlides++;
                  continue;
                }

                // New slide - download
                hasNewSlides = true;
                if (dryRun) {
                  console.log(`  📄 ${chalk.green('NEW')} ${folderName}/slides/${content.filename}`);
                } else {
                  mkdirSync(slidesDir, { recursive: true });
                  try {
                    const buffer = await client.downloadFile(content.fileurl);
                    writeFileSync(slidePath, buffer);
                  } catch {
                    continue;
                  }
                }
                newSlides++;
              }
            }
          }

          // Group slides by chapter
          const chapters = new Map<string, ChapterGroup>();
          for (const file of allSlideFiles) {
            const key = chapterKey(file);
            if (!chapters.has(key)) {
              chapters.set(key, { key, slides: [], latestSlide: file });
            }
            const ch = chapters.get(key)!;
            ch.slides.push(file);
            ch.latestSlide = file; // last one is usually most recent
          }

          // Generate chapter note if missing
          for (const [, chapter] of chapters) {
            // Check if any note already exists for this chapter
            const existingNotes = existsSync(courseDir)
              ? readdirSync(courseDir).filter(f => f.endsWith('.md'))
              : [];

            const noteExists = existingNotes.some(n => {
              const nKey = n.replace(/\.md$/, '').toLowerCase();
              const cKey = chapter.key.toLowerCase();

              if (nKey === cKey) return true;

              // Normalize for comparison: strip "chapter ", "ch", "np-ch " prefixes and compare numbers
              const nNorm = nKey.replace(/^(chapter\s*|ch|np-ch\s*)/i, '').trim();
              const cNorm = cKey.replace(/^(chapter\s*|ch|np-ch\s*)/i, '').trim();

              // Match if normalized versions overlap significantly
              if (nNorm && cNorm) {
                // Number-based match: "1 Computer Abstractions..." ≈ "1 Computer Abstractions..."
                const nNum = nNorm.match(/^(\d+)/)?.[1];
                const cNum = cNorm.match(/^(\d+)/)?.[1];
                if (nNum && cNum && nNum === cNum) return true;

                // Substring match for non-numbered chapters
                if (nNorm.length > 5 && cNorm.includes(nNorm.slice(0, 15))) return true;
                if (cNorm.length > 5 && nNorm.includes(cNorm.slice(0, 15))) return true;

                // Underscore/space normalization: "C1. Linux_Security_Basics" ≈ "C1. Linux Security Basics"
                const nSpaced = nNorm.replace(/_/g, ' ');
                const cSpaced = cNorm.replace(/_/g, ' ');
                if (nSpaced === cSpaced) return true;
              }

              return false;
            });

            if (noteExists) continue;

            const notePath = join(courseDir, `${chapter.key}.md`);
            if (existsSync(notePath)) continue;

            if (dryRun) {
              console.log(`  📝 ${chalk.cyan('NOTE')} ${folderName}/${chapter.key}.md`);
              newNotes++;
              continue;
            }

            // Track for JSON output (Claude Code will generate the actual content)
            newSlidesList.push({
              course: folderName,
              chapter: chapter.key,
              slideFiles: chapter.slides,
              notePath: notePath,
              slidesDir,
            });

            // Create stub note (matches existing note format: no frontmatter, # title, > course info)
            mkdirSync(courseDir, { recursive: true });

            const slideLinks = chapter.slides
              .map(s => `[[slides/${s}]]`)
              .join(' / ');

            const noteContent = [
              `# ${chapter.key}`,
              ``,
              `> 課程：${folderName}`,
              `> 講義：${slideLinks}`,
              ``,
              ``,
            ].join('\n');

            writeFileSync(notePath, noteContent, 'utf-8');
            newNotes++;
          }
        }

        lectureSpinner.succeed(
          `講義: ${chalk.green(newSlides + ' 新檔案')}` +
          (newNotes > 0 ? `, ${chalk.cyan(newNotes + ' 新筆記')}` : '') +
          (skippedSlides > 0 ? `, ${skippedSlides} 已存在` : ''),
        );

        // 3. Sync assignments to Calendar
        const assignSpinner = ora('同步作業到 Calendar...').start();
        const pending = await getPendingAssignmentsViaCalendar(client, 90);

        const calendarDir = join(vault, 'Calendar');
        if (!dryRun) mkdirSync(calendarDir, { recursive: true });

        let assignCreated = 0;
        let assignSkipped = 0;

        for (const a of pending) {
          const dateStr = formatDateISO(a.duedate);
          const shortName = extractShortCourseName(a.courseName);
          const fileName = `${dateStr} ${shortName} ${a.name}.md`
            .replace(/[<>:"/\\|?*]/g, '_');
          const filePath = join(calendarDir, fileName);

          if (existsSync(filePath)) {
            assignSkipped++;
            continue;
          }

          // Check similar existing file
          const existingFiles = existsSync(calendarDir) ? readdirSync(calendarDir) : [];
          const alreadyExists = existingFiles.some(f =>
            f.startsWith(dateStr) && f.toLowerCase().includes(a.name.toLowerCase().slice(0, 10)),
          );

          if (alreadyExists) {
            assignSkipped++;
            continue;
          }

          // Obsidian Calendar plugin format (match existing: startTime: 23:00, endTime: 00:00, endDate: next day)
          const dueDate = new Date(a.duedate * 1000);
          const nextDay = new Date(dueDate.getTime() + 86400000);
          const endDateStr = nextDay.toISOString().slice(0, 10);
          const startTime = '23:00';
          const endTime = '00:00';

          const title = `${shortName} ${a.name}`;

          const content = [
            `---`,
            `title: ${title}`,
            `allDay: false`,
            `startTime: ${startTime}`,
            `endTime: ${endTime}`,
            `date: ${dateStr}`,
            `endDate: ${endDateStr}`,
            `completed: false`,
            `---`,
            ``,
          ];

          if (a.intro) {
            const desc = stripHtml(a.intro);
            if (desc) content.push(desc, '');
          }

          if (dryRun) {
            console.log(`  📅 ${chalk.green('NEW')} Calendar/${fileName}`);
          } else {
            writeFileSync(filePath, content.join('\n'), 'utf-8');
          }
          assignCreated++;
        }

        assignSpinner.succeed(
          `作業: ${chalk.green(assignCreated + ' 新建')}` +
          (assignSkipped > 0 ? `, ${assignSkipped} 已存在` : ''),
        );

        if (jsonOutput) {
          // JSON output for Claude Code to consume
          console.log(JSON.stringify({
            newSlides: newSlidesList.map(s => ({
              course: s.course,
              chapter: s.chapter,
              notePath: s.notePath,
              pdfFiles: s.slideFiles.filter(f => f.endsWith('.pdf')).map(f => join(s.slidesDir, f)),
            })),
            newAssignments: assignCreated,
            summary: { newSlides, newNotes, skippedSlides, assignCreated, assignSkipped },
          }, null, 2));
        } else {
          console.log(chalk.bold(`\n✅ 同步完成！`));
        }
      } catch (err: unknown) {
        console.error(chalk.red(`錯誤: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
