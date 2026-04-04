import type {
  AssignmentCourse,
  CalendarEvent,
  PendingAssignment,
  SubmissionStatus,
} from './types.js';
import { MoodleClient } from './client.js';
import { SECONDS_PER_DAY } from './constants.js';

/**
 * Get all assignments for the given course IDs.
 * Uses REST API (token auth) - NOT available via AJAX API on most Moodle instances.
 */
export async function getAssignments(
  client: MoodleClient,
  courseids: number[],
): Promise<{ courses: AssignmentCourse[] }> {
  return client.call<{ courses: AssignmentCourse[] }>('mod_assign_get_assignments', {
    courseids,
  });
}

/**
 * Get submission status for a specific assignment.
 * Accepts cmid and auto-resolves to assign id.
 * Uses REST API (token auth).
 */
export async function getSubmissionStatus(
  client: MoodleClient,
  cmid: number,
): Promise<SubmissionStatus> {
  const assignid = await resolveAssignId(client, cmid);
  return client.call<SubmissionStatus>('mod_assign_get_submission_status', {
    assignid,
  });
}

/**
 * Submit an assignment with files from the draft area.
 */
/**
 * Resolve a cmid (course_modules.id) to the assign instance id (assign.id).
 * mod_assign_save_submission requires the assign table id, not the cmid.
 */
export async function resolveAssignId(
  client: MoodleClient,
  cmid: number,
): Promise<number> {
  // core_course_get_course_module returns { cm: { instance, course, ... } }
  const result = await client.call<{ cm: { instance: number; course: number } }>(
    'core_course_get_course_module',
    { cmid },
  );
  return result.cm.instance;
}

/**
 * Submit an assignment with files from the draft area.
 * Accepts cmid (what the calendar API returns) and auto-resolves to assign id.
 */
export async function saveSubmission(
  client: MoodleClient,
  cmid: number,
  draftItemId: number,
): Promise<void> {
  const assignid = await resolveAssignId(client, cmid);
  await client.call('mod_assign_save_submission', {
    assignmentid: assignid,
    plugindata: {
      files_filemanager: draftItemId,
    },
  });
}

/**
 * Get pending assignments using AJAX-compatible calendar API.
 * This works with SSO session auth because it uses
 * core_calendar_get_action_events_by_timesort which is AJAX-enabled.
 *
 * Events with action.actionable=true and eventtype='due' are pending assignments.
 */
export async function getPendingAssignmentsViaCalendar(
  client: MoodleClient,
  daysAhead: number = 60,
): Promise<PendingAssignment[]> {
  const now = Math.floor(Date.now() / 1000);
  const until = now + daysAhead * SECONDS_PER_DAY;

  const result = await client.call<{
    events: CalendarEvent[];
  }>('core_calendar_get_action_events_by_timesort', {
    timesortfrom: now - SECONDS_PER_DAY, // include slightly past events
    timesortto: until,
  });

  const pending: PendingAssignment[] = [];

  for (const event of result.events) {
    // Only include actionable assignment events
    if (!event.action?.actionable) continue;
    if (event.modulename !== 'assign') continue;

    pending.push({
      id: event.instance,
      cmid: event.instance, // calendar API instance == cmid for assign events
      courseId: event.course?.id ?? 0,
      courseName: event.course?.fullname ?? '',
      courseShortname: event.course?.shortname ?? '',
      name: event.name,
      duedate: event.timestart,
      intro: event.description ?? '',
      submissionStatus: 'new', // actionable means not yet submitted
      isOverdue: event.overdue ?? false,
    });
  }

  // Sort by due date
  pending.sort((a, b) => {
    if (a.duedate === 0 && b.duedate === 0) return 0;
    if (a.duedate === 0) return 1;
    if (b.duedate === 0) return -1;
    return a.duedate - b.duedate;
  });

  return pending;
}

/**
 * Get all pending (incomplete) assignments across all enrolled courses.
 * Uses REST API - for token-based auth only.
 */
export async function getPendingAssignments(
  client: MoodleClient,
  courseids: number[],
): Promise<PendingAssignment[]> {
  if (courseids.length === 0) return [];

  const { courses } = await getAssignments(client, courseids);
  const now = Math.floor(Date.now() / 1000);
  const pending: PendingAssignment[] = [];

  for (const course of courses) {
    for (const assignment of course.assignments) {
      if (assignment.nosubmissions) continue;

      let submissionStatus: 'new' | 'draft' | 'submitted' | 'unknown' = 'unknown';

      try {
        const status = await getSubmissionStatus(client, assignment.id);
        const sub = status.lastattempt?.submission ?? status.lastattempt?.teamsubmission;
        submissionStatus = sub?.status ?? 'new';
      } catch {
        // ignore
      }

      if (submissionStatus === 'submitted') continue;

      const isOverdue = assignment.duedate > 0 && assignment.duedate < now;
      if (assignment.cutoffdate > 0 && assignment.cutoffdate < now) continue;

      pending.push({
        id: assignment.id,
        cmid: assignment.cmid,
        courseId: course.id,
        courseName: course.fullname,
        courseShortname: course.shortname,
        name: assignment.name,
        duedate: assignment.duedate,
        intro: assignment.intro,
        submissionStatus,
        isOverdue,
      });
    }
  }

  pending.sort((a, b) => {
    if (a.duedate === 0 && b.duedate === 0) return 0;
    if (a.duedate === 0) return 1;
    if (b.duedate === 0) return -1;
    return a.duedate - b.duedate;
  });

  return pending;
}
