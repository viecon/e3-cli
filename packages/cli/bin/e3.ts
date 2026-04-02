#!/usr/bin/env node

import { Command } from 'commander';
import { registerAuthCommands } from '../src/commands/auth.js';
import { registerCoursesCommand } from '../src/commands/courses.js';
import { registerAssignmentsCommand } from '../src/commands/assignments.js';
import { registerDownloadCommand } from '../src/commands/download.js';
import { registerUploadCommand } from '../src/commands/upload.js';
import { registerGradesCommand } from '../src/commands/grades.js';
import { registerCalendarCommand } from '../src/commands/calendar.js';
import { registerObsidianCommand } from '../src/commands/obsidian.js';
import { registerSyncCommand } from '../src/commands/sync.js';
import { registerNewsCommand } from '../src/commands/news.js';
import { registerSubmissionCommand } from '../src/commands/submission.js';
import { registerUpdatesCommand } from '../src/commands/updates.js';
import { registerNotificationsCommand } from '../src/commands/notifications.js';
import { registerStatusCommand } from '../src/commands/status.js';
import { registerOpenCommand } from '../src/commands/open.js';
import { registerExportCommand } from '../src/commands/export.js';
import { registerConfigCommand } from '../src/commands/config.js';

const program = new Command();

program
  .name('e3')
  .description('NYCU E3 LMS 命令列工具')
  .version('0.1.0');

registerAuthCommands(program);
registerCoursesCommand(program);
registerAssignmentsCommand(program);
registerDownloadCommand(program);
registerUploadCommand(program);
registerGradesCommand(program);
registerCalendarCommand(program);
registerObsidianCommand(program);
registerSyncCommand(program);
registerNewsCommand(program);
registerSubmissionCommand(program);
registerUpdatesCommand(program);
registerNotificationsCommand(program);
registerStatusCommand(program);
registerOpenCommand(program);
registerExportCommand(program);
registerConfigCommand(program);

program.parse();
