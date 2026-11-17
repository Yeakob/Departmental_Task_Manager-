/**
 * End-to-end smoke test against a running API seeded with `npm run seed -- --demo`.
 *   node scripts/smoke-test.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'http://localhost:5000/api/v1';
let failures = 0;
let passes = 0;

async function call(token, method, path, body, { expect = [200, 201], form } = {}) {
  const headers = { 'X-Requested-With': 'XMLHttpRequest' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  const okStatus = [].concat(expect).includes(res.status);
  if (okStatus) passes++;
  else {
    failures++;
    console.log(`✗ ${method} ${path} -> ${res.status} (expected ${expect})`, typeof json === 'object' ? JSON.stringify(json).slice(0, 400) : String(json).slice(0, 200));
  }
  return json?.data ?? json;
}

const login = async (email, password = 'Demo@12345') => (await call(null, 'POST', '/auth/login', { email, password })).accessToken;

const check = (cond, label) => {
  if (cond) passes++;
  else { failures++; console.log(`✗ ${label}`); }
};

(async () => {
  const admin = await login('admin@dwmt.local', 'Admin@12345');
  const chair = await login('chairman@dwmt.local');
  const pc = await login('pc@dwmt.local');
  const rafiq = await login('rafiq@dwmt.local');
  const office = await login('office@dwmt.local');
  check(admin && chair && rafiq, 'logins');

  const me = await call(rafiq, 'GET', '/auth/me');
  check(me.user.permissions.includes('task:read_own') && !me.user.permissions.includes('task:read_all'), 'faculty permissions');

  // Users / roles / departments
  const users = await call(chair, 'GET', '/users/directory');
  const uid = (email) => (users.find((u) => u.email === email) || {})._id;
  check(users.length >= 10, 'directory');
  await call(rafiq, 'GET', '/users?limit=5'); // user:read
  await call(rafiq, 'POST', '/users', { name: 'X', email: 'x@x.com', password: 'Abcdef12' }, { expect: 403 });
  await call(chair, 'GET', '/roles');
  await call(chair, 'GET', '/departments');
  const cats = await call(chair, 'GET', '/categories');
  check(cats.length >= 15, 'categories');
  await call(chair, 'GET', '/academic-sessions');
  await call(chair, 'GET', '/audit-logs?limit=5');
  await call(rafiq, 'GET', '/audit-logs', undefined, { expect: 403 });

  // Dashboard
  const dChair = await call(chair, 'GET', '/reports/dashboard');
  const dRafiq = await call(rafiq, 'GET', '/reports/dashboard');
  check(dChair.cards.total > dRafiq.cards.total, `dashboard scoping (chair ${dChair.cards.total} > faculty ${dRafiq.cards.total})`);
  check(dChair.charts.workload.length > 0 && dChair.charts.weekly.length > 0, 'dashboard charts');
  await call(chair, 'GET', `/reports/dashboard?priority=critical,high&from=2020-01-01`);

  // Tasks
  const list = await call(chair, 'GET', '/tasks?limit=50');
  check(list.length > 10, 'task list');
  const mine = await call(rafiq, 'GET', '/tasks?scope=mine');
  check(mine.every((t) => t.assignees.some((a) => a.user._id === uid('rafiq@dwmt.local')) || t.supporters.some((s) => s._id === uid('rafiq@dwmt.local'))), 'mine scope');
  await call(chair, 'GET', '/tasks/kanban');
  const created = await call(chair, 'POST', '/tasks', {
    title: 'Smoke test task', description: '<p>hello</p>', priority: 'high', category: cats[0]._id,
    assignees: [{ user: uid('rafiq@dwmt.local'), isPrimary: true }], supporters: [uid('sadia@dwmt.local')],
    deadline: new Date(Date.now() + 3 * 86400000).toISOString(), estimatedHours: 4, checklist: ['one', 'two'],
  });
  const tid = created.id || created._id;
  check(created.taskId?.startsWith('CSE-'), 'task id format');
  await call(office, 'GET', `/tasks/${tid}`, undefined, { expect: 403 }); // not a participant
  await call(rafiq, 'PATCH', `/tasks/${tid}/status`, { status: 'acknowledged' });
  await call(rafiq, 'PATCH', `/tasks/${tid}/status`, { status: 'completed' }, { expect: [400, 403] });
  await call(rafiq, 'PATCH', `/tasks/${tid}/status`, { status: 'in_progress' });
  await call(rafiq, 'PATCH', `/tasks/${tid}/progress`, { progress: 60, actualHours: 2 });
  await call(rafiq, 'PATCH', `/tasks/${tid}`, { deadline: new Date().toISOString() }, { expect: 403 });
  await call(rafiq, 'POST', `/tasks/${tid}/comments`, { body: 'Working on it @Dr. Mahmudul Karim', mentions: [uid('chairman@dwmt.local')] });
  const comments = await call(chair, 'GET', `/tasks/${tid}/comments`);
  check(comments.length === 1, 'comments');
  const detail = await call(rafiq, 'GET', `/tasks/${tid}`);
  check(detail.checklist?.items?.length === 2, 'checklist created');
  const item = detail.checklist.items[0]._id;
  await call(rafiq, 'PATCH', `/tasks/${tid}/checklist/${item}`, { done: true });
  await call(rafiq, 'POST', `/tasks/${tid}/checklist`, { text: 'three' });

  const fd = new FormData();
  fd.append('files', new Blob(['deliverable content'], { type: 'text/plain' }), 'report.txt');
  const att = await call(rafiq, 'POST', `/tasks/${tid}/attachments`, undefined, { form: fd });
  const attId = (Array.isArray(att) ? att[0] : att)?.id || (Array.isArray(att) ? att[0] : att)?._id;
  await call(rafiq, 'POST', `/tasks/${tid}/extensions`, { requestedDeadline: new Date(Date.now() + 9 * 86400000).toISOString(), reason: 'Need more time' });
  const t2 = await call(chair, 'GET', `/tasks/${tid}`);
  const ext = t2.extensionRequests?.[0];
  if (ext) await call(chair, 'PATCH', `/tasks/${tid}/extensions/${ext._id}`, { decision: 'approved', note: 'ok' });
  await call(rafiq, 'POST', `/tasks/${tid}/submit`, { note: 'Done', attachmentIds: attId ? [attId] : [] });
  await call(rafiq, 'POST', `/tasks/${tid}/approve`, { decision: 'approved' }, { expect: 403 });
  await call(chair, 'POST', `/tasks/${tid}/approve`, { decision: 'revision_requested', comment: 'Add detail' });
  await call(rafiq, 'PATCH', `/tasks/${tid}/status`, { status: 'in_progress' });
  await call(rafiq, 'POST', `/tasks/${tid}/submit`, { note: 'Revised' });
  await call(chair, 'POST', `/tasks/${tid}/approve`, { decision: 'approved', comment: 'Great' });
  const done = await call(chair, 'GET', `/tasks/${tid}`);
  check(done.status === 'completed', `approval workflow -> ${done.status}`);
  const approvals = await call(chair, 'GET', `/tasks/${tid}/approvals`);
  check(approvals.length === 2, 'approval history');
  const activity = await call(chair, 'GET', `/tasks/${tid}/activity`);
  check(activity.length >= 6, `activity timeline (${activity.length})`);
  const dup = await call(chair, 'POST', `/tasks/${tid}/duplicate`);
  await call(chair, 'POST', '/tasks/bulk/status', { taskIds: [dup.id || dup._id], status: 'cancelled' });
  await call(chair, 'DELETE', `/tasks/${dup.id || dup._id}`);
  const bin = await call(chair, 'GET', '/tasks/recycle-bin');
  check(bin.some((t) => String(t._id) === String(dup.id || dup._id)), 'recycle bin');
  await call(chair, 'POST', `/tasks/${dup.id || dup._id}/restore`);
  const personal = await call(rafiq, 'POST', '/tasks', { title: 'My personal reminder', assignees: [{ user: uid('sadia@dwmt.local') }] }, { expect: 403 });
  const personal2 = await call(rafiq, 'POST', '/tasks', { title: 'My personal reminder' });
  check(personal2.isPersonal === true, 'personal task');
  await call(chair, 'POST', '/tasks/bulk', { tasks: [{ title: 'Bulk one', assignees: [{ user: uid('mitu@dwmt.local') }] }, { title: 'Bulk two', assignees: [{ user: uid('imran@dwmt.local') }] }] });
  const kb = await call(chair, 'GET', '/tasks/kanban');
  const assigned = kb.filter((t) => t.status === 'assigned');
  if (assigned[0]) await call(chair, 'PATCH', `/tasks/${assigned[0]._id}/kanban`, { status: 'in_progress', orderedIds: [assigned[0]._id] });

  // Projects
  const projects = await call(chair, 'GET', '/projects');
  check(projects.length === 5 && projects[0].stats, 'projects with stats');
  const p = await call(chair, 'GET', `/projects/${projects[0]._id}`);
  check(Array.isArray(p.milestones), 'project detail');
  await call(chair, 'GET', `/projects/${projects[0]._id}/timeline`);
  const np = await call(chair, 'POST', '/projects', { title: 'Department website revamp', manager: uid('imran@dwmt.local'), members: [uid('mitu@dwmt.local')], status: 'planning' });
  await call(chair, 'POST', `/projects/${np.id || np._id}/milestones`, { title: 'Design', dueDate: new Date(Date.now() + 10 * 86400000).toISOString() });
  await call(rafiq, 'PATCH', `/projects/${np.id || np._id}`, { title: 'hack' }, { expect: 403 });
  await call(rafiq, 'POST', '/projects', { title: 'x', manager: uid('rafiq@dwmt.local') }, { expect: 403 });

  // Committees
  const committees = await call(chair, 'GET', '/committees');
  check(committees.length === 7, 'committees');
  const c0 = await call(chair, 'GET', `/committees/${committees[0]._id}`);
  check(c0.stats && Array.isArray(c0.meetings), 'committee detail');
  const nc = await call(chair, 'POST', '/committees', { name: 'Admission Committee', coordinator: uid('sadia@dwmt.local'), members: [{ user: uid('mitu@dwmt.local') }] });
  check(nc.members.length === 2, 'committee coordinator auto-member');

  // Meetings
  const meetings = await call(chair, 'GET', '/meetings');
  check(meetings.length >= 3, 'meetings list');
  const rm = await call(rafiq, 'GET', '/meetings');
  check(rm.length >= 1 && rm.length <= meetings.length, 'meeting scoping');
  const nm = await call(chair, 'POST', '/meetings', { title: 'Smoke meeting', participants: [uid('rafiq@dwmt.local'), uid('sadia@dwmt.local')], startAt: new Date(Date.now() + 86400000).toISOString(), endAt: new Date(Date.now() + 90000000).toISOString(), agenda: [{ title: 'Item 1' }] });
  const mid = nm.id || nm._id;
  await call(rafiq, 'PATCH', `/meetings/${mid}/attendance`, { rsvp: 'accepted' });
  await call(chair, 'PATCH', `/meetings/${mid}/attendance`, { entries: [{ user: uid('rafiq@dwmt.local'), attendance: 'present' }] });
  await call(chair, 'PUT', `/meetings/${mid}/minutes`, { body: '<p>Minutes</p>' });
  const dec = await call(chair, 'POST', `/meetings/${mid}/decisions`, { title: 'Follow up with registrar', responsible: [uid('rafiq@dwmt.local')] });
  const conv = await call(chair, 'POST', `/meetings/${mid}/decisions/${dec.id || dec._id}/convert`, { priority: 'high' });
  check(conv.task?.taskId, 'decision -> task');
  await call(chair, 'POST', `/meetings/${mid}/decisions/${dec.id || dec._id}/convert`, {}, { expect: 409 });
  const mfull = await call(chair, 'GET', `/meetings/${mid}`);
  check(mfull.minutes && mfull.decisions.length === 1, 'meeting detail');

  // Documents
  const dfd = new FormData();
  dfd.append('file', new Blob(['%PDF-1.4 demo'], { type: 'application/pdf' }), 'notice.pdf');
  dfd.append('title', 'Exam notice');
  dfd.append('category', 'Official Notices');
  dfd.append('tags', 'exam,notice');
  const doc = await call(chair, 'POST', '/documents', undefined, { form: dfd });
  const did = doc.id || doc._id;
  const vfd = new FormData();
  vfd.append('file', new Blob(['%PDF-1.4 demo v2'], { type: 'application/pdf' }), 'notice-v2.pdf');
  await call(chair, 'POST', `/documents/${did}/versions`, undefined, { form: vfd });
  const dl = await fetch(`${BASE}/documents/${did}/download?version=1`, { headers: { Authorization: `Bearer ${rafiq}` } });
  check(dl.status === 200 && (await dl.text()) === '%PDF-1.4 demo', 'document download v1');
  const rfd = new FormData();
  rfd.append('file', new Blob(['secret'], { type: 'text/plain' }), 's.txt');
  rfd.append('visibility', 'restricted');
  rfd.append('allowedUsers', JSON.stringify([uid('pc@dwmt.local')]));
  const rdoc = await call(chair, 'POST', '/documents', undefined, { form: rfd });
  await call(rafiq, 'GET', `/documents/${rdoc.id || rdoc._id}`, undefined, { expect: 403 });
  await call(pc, 'GET', `/documents/${rdoc.id || rdoc._id}`);
  const bad = new FormData();
  bad.append('file', new Blob(['MZ'], { type: 'application/x-msdownload' }), 'evil.exe');
  await call(chair, 'POST', '/documents', undefined, { form: bad, expect: 400 });
  const docs = await call(rafiq, 'GET', '/documents?q=exam');
  check(docs.length >= 1, 'document search');
  const privateProbe = await fetch(`${BASE.replace('/api/v1', '')}/uploads/private/x?token=${rafiq}`);
  check(privateProbe.status === 404, 'private storage not served statically');

  // Announcements
  await call(chair, 'POST', '/announcements', { title: 'Smoke announcement', body: '<p>Hello all</p>', priority: 'important', isPinned: true });
  await call(rafiq, 'POST', '/announcements', { title: 'x', body: 'y' }, { expect: 403 });
  const ann = await call(rafiq, 'GET', '/announcements');
  check(ann[0]?.isPinned, 'pinned first');

  // Notifications
  const notes = await call(rafiq, 'GET', '/notifications?limit=100');
  check(notes.length > 0, `notifications (${notes.length})`);
  // Every kind of event must reach the recipient, not just the first one ever created.
  for (const type of ['task_assigned', 'approval_decided', 'extension_decided', 'meeting_invited', 'announcement']) {
    check(notes.some((n) => n.type === type), `rafiq received a ${type} notification`);
  }
  const chairNotes = await call(chair, 'GET', '/notifications?limit=100');
  check(chairNotes.some((n) => n.type === 'approval_requested') && chairNotes.some((n) => n.type === 'mention'), 'chairman received approval request and mention');
  await call(rafiq, 'PATCH', `/notifications/${notes[0]._id}/read`);
  await call(rafiq, 'PATCH', '/notifications/read-all');
  const cnt = await call(rafiq, 'GET', '/notifications/unread-count');
  check(cnt.count === 0, 'mark all read');

  // Calendar
  const from = new Date(Date.now() - 40 * 86400000).toISOString();
  const to = new Date(Date.now() + 60 * 86400000).toISOString();
  const ev = await call(chair, 'GET', `/calendar/events?from=${from}&to=${to}`);
  const types = new Set(ev.map((e) => e.type));
  check(['task', 'meeting', 'milestone', 'exam'].every((t) => types.has(t)), `calendar types ${[...types]}`);
  const ce = await call(chair, 'POST', '/calendar/events', { title: 'Orientation', type: 'event', startAt: new Date(Date.now() + 5 * 86400000).toISOString(), endAt: new Date(Date.now() + 5 * 86400000 + 7200000).toISOString() });
  await call(chair, 'PATCH', '/calendar/reschedule', { type: 'event', id: ce.id || ce._id, start: new Date(Date.now() + 6 * 86400000).toISOString() });
  await call(chair, 'PATCH', '/calendar/reschedule', { type: 'task', id: tid, start: new Date(Date.now() + 8 * 86400000).toISOString() });
  const ics = await fetch(`${BASE}/calendar/export.ics?from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${chair}` } });
  check((await ics.text()).startsWith('BEGIN:VCALENDAR'), 'ics export');

  // Reports
  const fr = await call(chair, 'GET', '/reports/faculty');
  check(fr.rows.length >= 9 && 'effortCompleted' in fr.rows[0], 'faculty report');
  const self = await call(rafiq, 'GET', `/reports/faculty?user=${uid('chairman@dwmt.local')}`);
  check(self.rows.length === 1 && self.rows[0].user.email === 'rafiq@dwmt.local', 'faculty report self-scope');
  const dr = await call(chair, 'GET', '/reports/department');
  check(dr.committees.length >= 7 && dr.overdue.byAge, 'department report');
  await call(rafiq, 'GET', '/reports/department', undefined, { expect: 403 });
  const rt = await call(chair, 'GET', '/reports/tasks');
  check(rt.length > 20, 'tasks export rows');

  // Search, recurring, system
  const s = await call(rafiq, 'GET', '/search?q=exam');
  check(s.tasks.length + s.documents.length + s.meetings.length > 0, 'global search');
  const rec = await call(chair, 'GET', '/recurring-tasks');
  check(rec.length === 1, 'recurring list');
  const gen = await call(chair, 'POST', `/recurring-tasks/${rec[0]._id}/run`);
  check(gen.taskId, 'recurring run');
  await call(chair, 'GET', '/system/export');
  await call(rafiq, 'GET', '/system/export', undefined, { expect: 403 });

  // Department isolation
  const dept2 = await call(admin, 'POST', '/departments', { name: 'Department of EEE', code: 'EEE' });
  const eeeUser = await call(admin, 'POST', '/users', { name: 'EEE Chair', email: 'eee@dwmt.local', password: 'Demo@12345', department: dept2.id || dept2._id, roles: ['chairman'] });
  check(eeeUser, 'create cross-dept user');
  const eee = await login('eee@dwmt.local');
  await call(eee, 'GET', `/tasks/${tid}`, undefined, { expect: 403 });
  const eeeTasks = await call(eee, 'GET', '/tasks');
  check(eeeTasks.length === 0, 'department isolation (tasks)');
  await call(eee, 'GET', `/projects/${projects[0]._id}`, undefined, { expect: 403 });
  await call(eee, 'GET', `/documents/${did}`, undefined, { expect: 403 });

  // Auth hardening
  await call(null, 'GET', '/tasks', undefined, { expect: 401 });
  await call(null, 'POST', '/auth/login', { email: 'chairman@dwmt.local', password: 'wrong' }, { expect: 401 });
  const noCsrf = await fetch(`${BASE}/auth/refresh`, { method: 'POST' });
  check(noCsrf.status === 403, 'refresh requires CSRF header');
  const spec = await fetch(`${BASE}/openapi.json`).then((r) => r.json());
  check(Object.keys(spec.paths).length > 80, `openapi paths (${Object.keys(spec.paths).length})`);

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
