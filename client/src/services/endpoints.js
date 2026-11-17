import { api, unwrap, withMeta, qs } from './api';
import { setCredentials, loggedOut, setUser } from '@/store/authSlice';

/**
 * All REST endpoints. Invalidation is deliberately broad per module: only
 * currently-subscribed queries refetch, so correctness wins over micro-caching.
 */
const TASK_EFFECTS = ['Task', 'Kanban', 'Report', 'Calendar', 'Activity', 'Approval', 'Project', 'Committee'];

export const endpoints = api.injectEndpoints({
  endpoints: (b) => ({
    // ---------------- Auth ----------------
    login: b.mutation({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      transformResponse: unwrap,
      async onQueryStarted(_a, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(setCredentials(data));
      },
    }),
    logout: b.mutation({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      async onQueryStarted(_a, { dispatch, queryFulfilled }) {
        try { await queryFulfilled; } finally {
          dispatch(loggedOut());
          dispatch(api.util.resetApiState());
        }
      },
    }),
    me: b.query({ query: () => '/auth/me', transformResponse: unwrap }),
    updateProfile: b.mutation({
      query: (body) => ({ url: '/auth/me', method: 'PATCH', body }),
      transformResponse: unwrap,
      async onQueryStarted(_a, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(setUser(data.user));
      },
    }),
    uploadAvatar: b.mutation({
      query: (file) => {
        const fd = new FormData();
        fd.append('avatar', file);
        return { url: '/auth/me/avatar', method: 'POST', body: fd };
      },
      transformResponse: unwrap,
      async onQueryStarted(_a, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(setUser({ avatar: data.avatar }));
      },
    }),
    changePassword: b.mutation({ query: (body) => ({ url: '/auth/change-password', method: 'POST', body }) }),

    // ---------------- Users / admin ----------------
    directory: b.query({ query: (q) => ({ url: '/users/directory', params: qs({ q }) }), transformResponse: unwrap, providesTags: ['User'] }),
    users: b.query({ query: (p) => ({ url: '/users', params: qs(p) }), transformResponse: withMeta, providesTags: ['User'] }),
    user: b.query({ query: (id) => `/users/${id}`, transformResponse: unwrap, providesTags: ['User'] }),
    createUser: b.mutation({ query: (body) => ({ url: '/users', method: 'POST', body }), invalidatesTags: ['User'] }),
    updateUser: b.mutation({ query: ({ id, ...body }) => ({ url: `/users/${id}`, method: 'PATCH', body }), invalidatesTags: ['User'] }),
    resetUserPassword: b.mutation({ query: ({ id, password }) => ({ url: `/users/${id}/reset-password`, method: 'POST', body: { password } }) }),
    deleteUser: b.mutation({ query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }), invalidatesTags: ['User'] }),
    preferences: b.query({ query: () => '/users/me/preferences', transformResponse: unwrap, providesTags: ['Prefs'] }),
    updatePreferences: b.mutation({ query: (body) => ({ url: '/users/me/preferences', method: 'PATCH', body }), invalidatesTags: ['Prefs'] }),

    roles: b.query({ query: () => '/roles', transformResponse: unwrap, providesTags: ['Role'] }),
    permissions: b.query({ query: () => '/roles/permissions', transformResponse: unwrap }),
    createRole: b.mutation({ query: (body) => ({ url: '/roles', method: 'POST', body }), invalidatesTags: ['Role'] }),
    updateRole: b.mutation({ query: ({ id, ...body }) => ({ url: `/roles/${id}`, method: 'PATCH', body }), invalidatesTags: ['Role'] }),
    deleteRole: b.mutation({ query: (id) => ({ url: `/roles/${id}`, method: 'DELETE' }), invalidatesTags: ['Role'] }),

    departments: b.query({ query: () => '/departments', transformResponse: unwrap, providesTags: ['Department'] }),
    createDepartment: b.mutation({ query: (body) => ({ url: '/departments', method: 'POST', body }), invalidatesTags: ['Department'] }),
    updateDepartment: b.mutation({ query: ({ id, ...body }) => ({ url: `/departments/${id}`, method: 'PATCH', body }), invalidatesTags: ['Department'] }),
    deleteDepartment: b.mutation({ query: (id) => ({ url: `/departments/${id}`, method: 'DELETE' }), invalidatesTags: ['Department'] }),

    categories: b.query({ query: () => '/categories', transformResponse: unwrap, providesTags: ['Category'] }),
    createCategory: b.mutation({ query: (body) => ({ url: '/categories', method: 'POST', body }), invalidatesTags: ['Category'] }),
    updateCategory: b.mutation({ query: ({ id, ...body }) => ({ url: `/categories/${id}`, method: 'PATCH', body }), invalidatesTags: ['Category'] }),
    deleteCategory: b.mutation({ query: (id) => ({ url: `/categories/${id}`, method: 'DELETE' }), invalidatesTags: ['Category'] }),

    sessions: b.query({ query: () => '/academic-sessions', transformResponse: unwrap, providesTags: ['Session'] }),
    createSession: b.mutation({ query: (body) => ({ url: '/academic-sessions', method: 'POST', body }), invalidatesTags: ['Session', 'Calendar'] }),
    updateSession: b.mutation({ query: ({ id, ...body }) => ({ url: `/academic-sessions/${id}`, method: 'PATCH', body }), invalidatesTags: ['Session', 'Calendar'] }),
    deleteSession: b.mutation({ query: (id) => ({ url: `/academic-sessions/${id}`, method: 'DELETE' }), invalidatesTags: ['Session', 'Calendar'] }),

    auditLogs: b.query({ query: (p) => ({ url: '/audit-logs', params: qs(p) }), transformResponse: withMeta, providesTags: ['Audit'] }),

    // ---------------- Tasks ----------------
    tasks: b.query({ query: (p) => ({ url: '/tasks', params: qs(p) }), transformResponse: withMeta, providesTags: ['Task'] }),
    kanban: b.query({ query: (p) => ({ url: '/tasks/kanban', params: qs(p) }), transformResponse: unwrap, providesTags: ['Kanban'] }),
    task: b.query({ query: (id) => `/tasks/${id}`, transformResponse: unwrap, providesTags: (_r, _e, id) => [{ type: 'Task', id }, 'Task'] }),
    createTask: b.mutation({ query: (body) => ({ url: '/tasks', method: 'POST', body }), transformResponse: unwrap, invalidatesTags: TASK_EFFECTS }),
    updateTask: b.mutation({ query: ({ id, ...body }) => ({ url: `/tasks/${id}`, method: 'PATCH', body }), transformResponse: unwrap, invalidatesTags: TASK_EFFECTS }),
    deleteTask: b.mutation({ query: (id) => ({ url: `/tasks/${id}`, method: 'DELETE' }), invalidatesTags: TASK_EFFECTS }),
    restoreTask: b.mutation({ query: (id) => ({ url: `/tasks/${id}/restore`, method: 'POST' }), invalidatesTags: TASK_EFFECTS }),
    recycleBin: b.query({ query: () => '/tasks/recycle-bin', transformResponse: unwrap, providesTags: ['Task'] }),
    duplicateTask: b.mutation({ query: (id) => ({ url: `/tasks/${id}/duplicate`, method: 'POST' }), transformResponse: unwrap, invalidatesTags: TASK_EFFECTS }),
    createFromTemplate: b.mutation({ query: ({ id, ...body }) => ({ url: `/tasks/${id}/from-template`, method: 'POST', body }), transformResponse: unwrap, invalidatesTags: TASK_EFFECTS }),
    changeStatus: b.mutation({ query: ({ id, ...body }) => ({ url: `/tasks/${id}/status`, method: 'PATCH', body }), transformResponse: unwrap, invalidatesTags: TASK_EFFECTS }),
    kanbanMove: b.mutation({
      query: ({ id, ...body }) => ({ url: `/tasks/${id}/kanban`, method: 'PATCH', body }),
      invalidatesTags: ['Task', 'Report', 'Activity'],
    }),
    updateProgress: b.mutation({ query: ({ id, ...body }) => ({ url: `/tasks/${id}/progress`, method: 'PATCH', body }), invalidatesTags: TASK_EFFECTS }),
    assignTask: b.mutation({ query: ({ id, ...body }) => ({ url: `/tasks/${id}/assign`, method: 'POST', body }), invalidatesTags: TASK_EFFECTS }),
    delegateTask: b.mutation({ query: ({ id, ...body }) => ({ url: `/tasks/${id}/delegate`, method: 'POST', body }), invalidatesTags: TASK_EFFECTS }),
    watchTask: b.mutation({ query: ({ id, watch }) => ({ url: `/tasks/${id}/watch`, method: 'POST', body: { watch } }), invalidatesTags: ['Task'] }),
    addDependency: b.mutation({ query: ({ id, dependsOn }) => ({ url: `/tasks/${id}/dependencies`, method: 'POST', body: { dependsOn } }), invalidatesTags: ['Task', 'Activity'] }),
    removeDependency: b.mutation({ query: ({ id, depId }) => ({ url: `/tasks/${id}/dependencies/${depId}`, method: 'DELETE' }), invalidatesTags: ['Task', 'Activity'] }),
    requestExtension: b.mutation({ query: ({ id, ...body }) => ({ url: `/tasks/${id}/extensions`, method: 'POST', body }), invalidatesTags: ['Task', 'Activity'] }),
    decideExtension: b.mutation({ query: ({ id, requestId, ...body }) => ({ url: `/tasks/${id}/extensions/${requestId}`, method: 'PATCH', body }), invalidatesTags: TASK_EFFECTS }),
    submitTask: b.mutation({ query: ({ id, ...body }) => ({ url: `/tasks/${id}/submit`, method: 'POST', body }), invalidatesTags: TASK_EFFECTS }),
    decideApproval: b.mutation({ query: ({ id, ...body }) => ({ url: `/tasks/${id}/approve`, method: 'POST', body }), invalidatesTags: TASK_EFFECTS }),
    approvals: b.query({ query: (id) => `/tasks/${id}/approvals`, transformResponse: unwrap, providesTags: ['Approval'] }),
    activity: b.query({ query: (id) => `/tasks/${id}/activity`, transformResponse: unwrap, providesTags: ['Activity'] }),
    comments: b.query({ query: (id) => `/tasks/${id}/comments`, transformResponse: unwrap, providesTags: ['Comment'] }),
    addComment: b.mutation({ query: ({ id, ...body }) => ({ url: `/tasks/${id}/comments`, method: 'POST', body }), invalidatesTags: ['Comment', 'Activity'] }),
    updateComment: b.mutation({ query: ({ id, commentId, body }) => ({ url: `/tasks/${id}/comments/${commentId}`, method: 'PATCH', body: { body } }), invalidatesTags: ['Comment'] }),
    deleteComment: b.mutation({ query: ({ id, commentId }) => ({ url: `/tasks/${id}/comments/${commentId}`, method: 'DELETE' }), invalidatesTags: ['Comment'] }),
    addChecklistItem: b.mutation({ query: ({ id, text }) => ({ url: `/tasks/${id}/checklist`, method: 'POST', body: { text } }), invalidatesTags: ['Task'] }),
    updateChecklistItem: b.mutation({ query: ({ id, itemId, ...body }) => ({ url: `/tasks/${id}/checklist/${itemId}`, method: 'PATCH', body }), invalidatesTags: ['Task'] }),
    deleteChecklistItem: b.mutation({ query: ({ id, itemId }) => ({ url: `/tasks/${id}/checklist/${itemId}`, method: 'DELETE' }), invalidatesTags: ['Task'] }),
    attachments: b.query({ query: (id) => `/tasks/${id}/attachments`, transformResponse: unwrap, providesTags: ['Attachment'] }),
    uploadAttachments: b.mutation({
      query: ({ id, files }) => {
        const fd = new FormData();
        for (const f of files) fd.append('files', f);
        return { url: `/tasks/${id}/attachments`, method: 'POST', body: fd };
      },
      transformResponse: unwrap,
      invalidatesTags: ['Attachment', 'Task', 'Activity'],
    }),
    deleteAttachment: b.mutation({ query: ({ id, attachmentId }) => ({ url: `/tasks/${id}/attachments/${attachmentId}`, method: 'DELETE' }), invalidatesTags: ['Attachment', 'Task', 'Activity'] }),
    bulkCreate: b.mutation({ query: (tasks) => ({ url: '/tasks/bulk', method: 'POST', body: { tasks } }), invalidatesTags: TASK_EFFECTS }),
    bulkAssign: b.mutation({ query: (body) => ({ url: '/tasks/bulk/assign', method: 'POST', body }), invalidatesTags: TASK_EFFECTS }),
    bulkStatus: b.mutation({ query: (body) => ({ url: '/tasks/bulk/status', method: 'POST', body }), invalidatesTags: TASK_EFFECTS }),

    recurring: b.query({ query: () => '/recurring-tasks', transformResponse: unwrap, providesTags: ['Recurring'] }),
    createRecurring: b.mutation({ query: (body) => ({ url: '/recurring-tasks', method: 'POST', body }), invalidatesTags: ['Recurring'] }),
    updateRecurring: b.mutation({ query: ({ id, ...body }) => ({ url: `/recurring-tasks/${id}`, method: 'PATCH', body }), invalidatesTags: ['Recurring'] }),
    deleteRecurring: b.mutation({ query: (id) => ({ url: `/recurring-tasks/${id}`, method: 'DELETE' }), invalidatesTags: ['Recurring'] }),
    runRecurring: b.mutation({ query: (id) => ({ url: `/recurring-tasks/${id}/run`, method: 'POST' }), invalidatesTags: ['Recurring', ...TASK_EFFECTS] }),

    // ---------------- Projects ----------------
    projects: b.query({ query: (p) => ({ url: '/projects', params: qs(p) }), transformResponse: withMeta, providesTags: ['Project'] }),
    project: b.query({ query: (id) => `/projects/${id}`, transformResponse: unwrap, providesTags: ['Project'] }),
    projectTimeline: b.query({ query: (id) => `/projects/${id}/timeline`, transformResponse: unwrap, providesTags: ['Project', 'Task'] }),
    createProject: b.mutation({ query: (body) => ({ url: '/projects', method: 'POST', body }), transformResponse: unwrap, invalidatesTags: ['Project'] }),
    updateProject: b.mutation({ query: ({ id, ...body }) => ({ url: `/projects/${id}`, method: 'PATCH', body }), invalidatesTags: ['Project'] }),
    deleteProject: b.mutation({ query: (id) => ({ url: `/projects/${id}`, method: 'DELETE' }), invalidatesTags: ['Project'] }),
    addMilestone: b.mutation({ query: ({ id, ...body }) => ({ url: `/projects/${id}/milestones`, method: 'POST', body }), invalidatesTags: ['Project', 'Calendar'] }),
    updateMilestone: b.mutation({ query: ({ id, milestoneId, ...body }) => ({ url: `/projects/${id}/milestones/${milestoneId}`, method: 'PATCH', body }), invalidatesTags: ['Project', 'Calendar'] }),
    deleteMilestone: b.mutation({ query: ({ id, milestoneId }) => ({ url: `/projects/${id}/milestones/${milestoneId}`, method: 'DELETE' }), invalidatesTags: ['Project', 'Calendar'] }),

    // ---------------- Committees ----------------
    committees: b.query({ query: (p) => ({ url: '/committees', params: qs(p) }), transformResponse: withMeta, providesTags: ['Committee'] }),
    committee: b.query({ query: (id) => `/committees/${id}`, transformResponse: unwrap, providesTags: ['Committee'] }),
    createCommittee: b.mutation({ query: (body) => ({ url: '/committees', method: 'POST', body }), transformResponse: unwrap, invalidatesTags: ['Committee'] }),
    updateCommittee: b.mutation({ query: ({ id, ...body }) => ({ url: `/committees/${id}`, method: 'PATCH', body }), invalidatesTags: ['Committee'] }),
    deleteCommittee: b.mutation({ query: (id) => ({ url: `/committees/${id}`, method: 'DELETE' }), invalidatesTags: ['Committee'] }),

    // ---------------- Meetings ----------------
    meetings: b.query({ query: (p) => ({ url: '/meetings', params: qs(p) }), transformResponse: withMeta, providesTags: ['Meeting'] }),
    meeting: b.query({ query: (id) => `/meetings/${id}`, transformResponse: unwrap, providesTags: ['Meeting'] }),
    createMeeting: b.mutation({ query: (body) => ({ url: '/meetings', method: 'POST', body }), transformResponse: unwrap, invalidatesTags: ['Meeting', 'Calendar', 'Report'] }),
    updateMeeting: b.mutation({ query: ({ id, ...body }) => ({ url: `/meetings/${id}`, method: 'PATCH', body }), invalidatesTags: ['Meeting', 'Calendar', 'Report'] }),
    deleteMeeting: b.mutation({ query: (id) => ({ url: `/meetings/${id}`, method: 'DELETE' }), invalidatesTags: ['Meeting', 'Calendar', 'Report'] }),
    meetingAttendance: b.mutation({ query: ({ id, ...body }) => ({ url: `/meetings/${id}/attendance`, method: 'PATCH', body }), invalidatesTags: ['Meeting'] }),
    saveMinutes: b.mutation({ query: ({ id, ...body }) => ({ url: `/meetings/${id}/minutes`, method: 'PUT', body }), invalidatesTags: ['Meeting'] }),
    addDecision: b.mutation({ query: ({ id, ...body }) => ({ url: `/meetings/${id}/decisions`, method: 'POST', body }), invalidatesTags: ['Meeting'] }),
    updateDecision: b.mutation({ query: ({ id, decisionId, ...body }) => ({ url: `/meetings/${id}/decisions/${decisionId}`, method: 'PATCH', body }), invalidatesTags: ['Meeting'] }),
    deleteDecision: b.mutation({ query: ({ id, decisionId }) => ({ url: `/meetings/${id}/decisions/${decisionId}`, method: 'DELETE' }), invalidatesTags: ['Meeting'] }),
    convertDecision: b.mutation({ query: ({ id, decisionId, ...body }) => ({ url: `/meetings/${id}/decisions/${decisionId}/convert`, method: 'POST', body }), transformResponse: unwrap, invalidatesTags: ['Meeting', ...TASK_EFFECTS] }),

    // ---------------- Documents ----------------
    documents: b.query({ query: (p) => ({ url: '/documents', params: qs(p) }), transformResponse: withMeta, providesTags: ['Document'] }),
    document: b.query({ query: (id) => `/documents/${id}`, transformResponse: unwrap, providesTags: ['Document'] }),
    uploadDocument: b.mutation({ query: (formData) => ({ url: '/documents', method: 'POST', body: formData }), transformResponse: unwrap, invalidatesTags: ['Document', 'Project', 'Committee'] }),
    addDocumentVersion: b.mutation({ query: ({ id, formData }) => ({ url: `/documents/${id}/versions`, method: 'POST', body: formData }), invalidatesTags: ['Document'] }),
    updateDocument: b.mutation({ query: ({ id, ...body }) => ({ url: `/documents/${id}`, method: 'PATCH', body }), invalidatesTags: ['Document'] }),
    deleteDocument: b.mutation({ query: (id) => ({ url: `/documents/${id}`, method: 'DELETE' }), invalidatesTags: ['Document', 'Project', 'Committee'] }),

    // ---------------- Announcements ----------------
    announcements: b.query({ query: (p) => ({ url: '/announcements', params: qs(p) }), transformResponse: withMeta, providesTags: ['Announcement'] }),
    createAnnouncement: b.mutation({ query: (body) => ({ url: '/announcements', method: 'POST', body }), invalidatesTags: ['Announcement', 'Report'] }),
    updateAnnouncement: b.mutation({ query: ({ id, ...body }) => ({ url: `/announcements/${id}`, method: 'PATCH', body }), invalidatesTags: ['Announcement', 'Report'] }),
    deleteAnnouncement: b.mutation({ query: (id) => ({ url: `/announcements/${id}`, method: 'DELETE' }), invalidatesTags: ['Announcement', 'Report'] }),

    // ---------------- Notifications ----------------
    notifications: b.query({ query: (p) => ({ url: '/notifications', params: qs(p) }), transformResponse: withMeta, providesTags: ['Notification'] }),
    unreadCount: b.query({ query: () => '/notifications/unread-count', transformResponse: (r) => r.data.count, providesTags: ['Notification'] }),
    markRead: b.mutation({ query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }), invalidatesTags: ['Notification'] }),
    markUnread: b.mutation({ query: (id) => ({ url: `/notifications/${id}/unread`, method: 'PATCH' }), invalidatesTags: ['Notification'] }),
    markAllRead: b.mutation({ query: () => ({ url: '/notifications/read-all', method: 'PATCH' }), invalidatesTags: ['Notification'] }),
    deleteNotification: b.mutation({ query: (id) => ({ url: `/notifications/${id}`, method: 'DELETE' }), invalidatesTags: ['Notification'] }),

    // ---------------- Calendar ----------------
    calendarEvents: b.query({ query: (p) => ({ url: '/calendar/events', params: qs(p) }), transformResponse: unwrap, providesTags: ['Calendar'] }),
    createEvent: b.mutation({ query: (body) => ({ url: '/calendar/events', method: 'POST', body }), invalidatesTags: ['Calendar'] }),
    updateEvent: b.mutation({ query: ({ id, ...body }) => ({ url: `/calendar/events/${id}`, method: 'PATCH', body }), invalidatesTags: ['Calendar'] }),
    deleteEvent: b.mutation({ query: (id) => ({ url: `/calendar/events/${id}`, method: 'DELETE' }), invalidatesTags: ['Calendar'] }),
    reschedule: b.mutation({ query: (body) => ({ url: '/calendar/reschedule', method: 'PATCH', body }), invalidatesTags: ['Calendar', 'Task', 'Meeting', 'Kanban'] }),

    // ---------------- Reports / search ----------------
    dashboard: b.query({ query: (p) => ({ url: '/reports/dashboard', params: qs(p) }), transformResponse: unwrap, providesTags: ['Report'] }),
    facultyReport: b.query({ query: (p) => ({ url: '/reports/faculty', params: qs(p) }), transformResponse: unwrap, providesTags: ['Report'] }),
    departmentReport: b.query({ query: (p) => ({ url: '/reports/department', params: qs(p) }), transformResponse: unwrap, providesTags: ['Report'] }),
    taskReport: b.query({ query: (p) => ({ url: '/reports/tasks', params: qs(p) }), transformResponse: unwrap, providesTags: ['Report'] }),
    search: b.query({ query: (q) => ({ url: '/search', params: { q } }), transformResponse: unwrap, invalidatesTags: ['Prefs'] }),
  }),
});

export const {
  useLoginMutation, useLogoutMutation, useMeQuery, useUpdateProfileMutation, useUploadAvatarMutation, useChangePasswordMutation,
  useDirectoryQuery, useUsersQuery, useUserQuery, useCreateUserMutation, useUpdateUserMutation, useResetUserPasswordMutation, useDeleteUserMutation,
  usePreferencesQuery, useUpdatePreferencesMutation,
  useRolesQuery, usePermissionsQuery, useCreateRoleMutation, useUpdateRoleMutation, useDeleteRoleMutation,
  useDepartmentsQuery, useCreateDepartmentMutation, useUpdateDepartmentMutation, useDeleteDepartmentMutation,
  useCategoriesQuery, useCreateCategoryMutation, useUpdateCategoryMutation, useDeleteCategoryMutation,
  useSessionsQuery, useCreateSessionMutation, useUpdateSessionMutation, useDeleteSessionMutation, useAuditLogsQuery,
  useTasksQuery, useKanbanQuery, useTaskQuery, useCreateTaskMutation, useUpdateTaskMutation, useDeleteTaskMutation, useRestoreTaskMutation, useRecycleBinQuery,
  useDuplicateTaskMutation, useCreateFromTemplateMutation, useChangeStatusMutation, useKanbanMoveMutation, useUpdateProgressMutation, useAssignTaskMutation,
  useDelegateTaskMutation, useWatchTaskMutation, useAddDependencyMutation, useRemoveDependencyMutation, useRequestExtensionMutation, useDecideExtensionMutation,
  useSubmitTaskMutation, useDecideApprovalMutation, useApprovalsQuery, useActivityQuery, useCommentsQuery, useAddCommentMutation, useUpdateCommentMutation,
  useDeleteCommentMutation, useAddChecklistItemMutation, useUpdateChecklistItemMutation, useDeleteChecklistItemMutation, useAttachmentsQuery,
  useUploadAttachmentsMutation, useDeleteAttachmentMutation, useBulkCreateMutation, useBulkAssignMutation, useBulkStatusMutation,
  useRecurringQuery, useCreateRecurringMutation, useUpdateRecurringMutation, useDeleteRecurringMutation, useRunRecurringMutation,
  useProjectsQuery, useProjectQuery, useProjectTimelineQuery, useCreateProjectMutation, useUpdateProjectMutation, useDeleteProjectMutation,
  useAddMilestoneMutation, useUpdateMilestoneMutation, useDeleteMilestoneMutation,
  useCommitteesQuery, useCommitteeQuery, useCreateCommitteeMutation, useUpdateCommitteeMutation, useDeleteCommitteeMutation,
  useMeetingsQuery, useMeetingQuery, useCreateMeetingMutation, useUpdateMeetingMutation, useDeleteMeetingMutation, useMeetingAttendanceMutation,
  useSaveMinutesMutation, useAddDecisionMutation, useUpdateDecisionMutation, useDeleteDecisionMutation, useConvertDecisionMutation,
  useDocumentsQuery, useDocumentQuery, useUploadDocumentMutation, useAddDocumentVersionMutation, useUpdateDocumentMutation, useDeleteDocumentMutation,
  useAnnouncementsQuery, useCreateAnnouncementMutation, useUpdateAnnouncementMutation, useDeleteAnnouncementMutation,
  useNotificationsQuery, useUnreadCountQuery, useMarkReadMutation, useMarkUnreadMutation, useMarkAllReadMutation, useDeleteNotificationMutation,
  useCalendarEventsQuery, useCreateEventMutation, useUpdateEventMutation, useDeleteEventMutation, useRescheduleMutation,
  useDashboardQuery, useFacultyReportQuery, useDepartmentReportQuery, useTaskReportQuery, useLazyTaskReportQuery, useSearchQuery,
} = endpoints;
