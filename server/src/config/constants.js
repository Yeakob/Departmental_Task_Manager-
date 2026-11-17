export const TASK_STATUS = Object.freeze({
  DRAFT: 'draft',
  ASSIGNED: 'assigned',
  ACKNOWLEDGED: 'acknowledged',
  IN_PROGRESS: 'in_progress',
  UNDER_REVIEW: 'under_review',
  REVISION_REQUIRED: 'revision_required',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  ON_HOLD: 'on_hold',
});
export const TASK_STATUSES = Object.values(TASK_STATUS);

/** Allowed status transitions: from -> [to...] */
export const STATUS_TRANSITIONS = Object.freeze({
  draft: ['assigned', 'cancelled'],
  assigned: ['acknowledged', 'in_progress', 'on_hold', 'cancelled'],
  acknowledged: ['in_progress', 'on_hold', 'cancelled'],
  in_progress: ['under_review', 'completed', 'on_hold', 'cancelled'],
  under_review: ['completed', 'revision_required', 'rejected'],
  revision_required: ['in_progress', 'under_review', 'cancelled'],
  completed: ['in_progress'], // reopen
  rejected: ['assigned', 'in_progress'],
  cancelled: ['assigned'],
  on_hold: ['assigned', 'in_progress', 'cancelled'],
});

export const OPEN_STATUSES = ['assigned', 'acknowledged', 'in_progress', 'under_review', 'revision_required', 'on_hold'];
export const CLOSED_STATUSES = ['completed', 'rejected', 'cancelled'];

export const PRIORITY = Object.freeze({ CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low' });
export const PRIORITIES = Object.values(PRIORITY);

export const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'archived'];
export const MEETING_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'];
export const APPROVAL_DECISIONS = ['pending', 'approved', 'rejected', 'revision_requested'];

export const DEFAULT_CATEGORIES = [
  'Academic Activities',
  'Examination Management',
  'Course Coordination',
  'Research Activities',
  'Accreditation and IQAC',
  'Laboratory Management',
  'Departmental Administration',
  'Student Affairs',
  'Seminar and Workshop',
  'Meeting and Documentation',
  'Publication and Research',
  'Infrastructure and Equipment',
  'Committee Activities',
  'Event Management',
  'Other Activities',
];

export const DOCUMENT_CATEGORIES = [
  'Meeting Minutes',
  'Official Notices',
  'Academic Documents',
  'Course Files',
  'Examination Documents',
  'Accreditation Documents',
  'Research Documents',
  'Reports',
  'Task Deliverables',
  'Other',
];

export const NOTIFICATION_TYPES = [
  'task_assigned',
  'task_reassigned',
  'deadline_approaching',
  'task_overdue',
  'comment',
  'mention',
  'status_changed',
  'approval_requested',
  'task_completed',
  'extension_requested',
  'extension_decided',
  'meeting_invited',
  'announcement',
  'approval_decided',
];

/**
 * Granular permission catalogue. Roles are sets of these keys.
 * Resource:action naming. `*` is a wildcard granted only to super_admin.
 */
export const PERMISSIONS = [
  // system
  'system:manage',
  'audit:read',
  'department:manage',
  'role:manage',
  'user:manage',
  'user:read',
  // tasks
  'task:create',
  'task:read_all',
  'task:read_own',
  'task:update_any',
  'task:update_own',
  'task:delete',
  'task:assign',
  'task:approve',
  'task:comment',
  'task:submit',
  'task:extension_request',
  'task:extension_decide',
  'task:bulk',
  'category:manage',
  // projects
  'project:create',
  'project:read',
  'project:update',
  'project:delete',
  // committees
  'committee:create',
  'committee:read',
  'committee:update',
  'committee:delete',
  'committee:assign_members',
  // meetings
  'meeting:create',
  'meeting:read',
  'meeting:update',
  'meeting:delete',
  // documents
  'document:upload',
  'document:read',
  'document:delete',
  // announcements
  'announcement:create',
  'announcement:read',
  'announcement:manage',
  // reports
  'report:faculty',
  'report:department',
  'report:self',
  // notifications
  'notification:read',
];

export const ROLE_KEYS = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  CHAIRMAN: 'chairman',
  PROGRAM_COORDINATOR: 'program_coordinator',
  FACULTY: 'faculty',
  COMMITTEE_COORDINATOR: 'committee_coordinator',
  OFFICE_STAFF: 'office_staff',
});

const BASE = [
  'task:read_own',
  'task:update_own',
  'task:comment',
  'task:submit',
  'task:extension_request',
  'project:read',
  'committee:read',
  'meeting:read',
  'document:read',
  'document:upload',
  'announcement:read',
  'report:self',
  'notification:read',
  'user:read',
  'task:create', // personal tasks (scoped to self in service layer)
];

export const DEFAULT_ROLES = [
  {
    key: 'super_admin',
    name: 'Super Admin',
    description: 'Complete system configuration and access to all departments.',
    isSystem: true,
    permissions: ['*'],
  },
  {
    key: 'chairman',
    name: 'Department Chairman',
    description: 'Complete departmental overview; assigns, delegates and approves work.',
    isSystem: true,
    permissions: [
      ...BASE,
      'task:read_all',
      'task:update_any',
      'task:delete',
      'task:assign',
      'task:approve',
      'task:extension_decide',
      'task:bulk',
      'category:manage',
      'project:create',
      'project:update',
      'project:delete',
      'committee:create',
      'committee:update',
      'committee:delete',
      'committee:assign_members',
      'meeting:create',
      'meeting:update',
      'meeting:delete',
      'document:delete',
      'announcement:create',
      'announcement:manage',
      'report:faculty',
      'report:department',
      'user:manage',
      'audit:read',
    ],
  },
  {
    key: 'program_coordinator',
    name: 'Program Coordinator',
    description: 'Manages program-specific academic and administrative responsibilities.',
    isSystem: true,
    permissions: [
      ...BASE,
      'task:read_all',
      'task:update_any',
      'task:assign',
      'task:approve',
      'task:extension_decide',
      'task:bulk',
      'project:create',
      'project:update',
      'committee:update',
      'meeting:create',
      'meeting:update',
      'announcement:create',
      'report:faculty',
      'report:department',
    ],
  },
  {
    key: 'faculty',
    name: 'Faculty Member',
    description: 'Receives and executes assigned tasks.',
    isSystem: true,
    permissions: [...BASE],
  },
  {
    key: 'committee_coordinator',
    name: 'Committee Coordinator',
    description: 'Manages committee activities and assigns work to committee members.',
    isSystem: true,
    permissions: [...BASE, 'task:assign', 'committee:update', 'committee:assign_members', 'meeting:create', 'meeting:update'],
  },
  {
    key: 'office_staff',
    name: 'Office Staff',
    description: 'Receives administrative assignments and maintains departmental records.',
    isSystem: true,
    permissions: [...BASE],
  },
];

export const REMINDER_OFFSETS_MINUTES = [7 * 24 * 60, 3 * 24 * 60, 24 * 60, 60];
