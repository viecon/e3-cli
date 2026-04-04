// Constants
export { DEFAULT_BASE_URL, SECONDS_PER_DAY, SECONDS_PER_HOUR } from './constants.js';

// Core client
export { MoodleClient, MoodleApiError } from './client.js';
export type { MoodleClientOptions } from './client.js';

// Auth
export { getSiteInfo } from './auth.js';

// Courses
export { getUserCourses, getEnrolledCourses, getCourseContents, getCourseUpdates } from './courses.js';

// Forums
export { getForums, getForumDiscussions } from './forums.js';

// Notifications
export { getNotifications } from './notifications.js';

// Assignments
export {
  getAssignments,
  getSubmissionStatus,
  resolveAssignId,
  saveSubmission,
  getPendingAssignments,
  getPendingAssignmentsViaCalendar,
} from './assignments.js';

// Files
export { listCourseFiles, uploadFiles } from './files.js';
export type { CourseFile } from './files.js';

// Calendar
export { getUpcomingEvents } from './calendar.js';

// Grades
export { getCourseGrades, getAllGrades } from './grades.js';

// ICS
export { generateICS } from './ics.js';
export type { ICSEvent } from './ics.js';

// Utils
export { flattenParams } from './utils.js';

// Types
export type * from './types.js';
