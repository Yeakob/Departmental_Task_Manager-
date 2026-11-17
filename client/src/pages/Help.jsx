import { Link } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { Panel } from '@/components/ui/panel';
import { siteConfig } from '@/app/siteConfig';

const FAQ = [
  ['How do I respond to a new assignment?', 'Open the task from your notification or My Tasks and choose Acknowledge. The person who assigned it can then see you’ve received it. Start work when you begin, and update progress or tick checklist items as you go.'],
  ['How does approval work?', 'When you finish, choose Submit for approval and select your deliverable files. The reviewer can approve it, request a revision with comments, or reject it. Every round is kept in the Approvals tab with the files submitted.'],
  ['I need more time. What should I do?', 'Use More actions, Request deadline extension. Give the new date and a reason. The deadline only changes if the person who assigned the task approves.'],
  ['Who can see my tasks?', 'Tasks are visible to the people on them (assignees, supporters, watchers, reviewers) and to the chairman and program coordinator. Nobody outside your department can see them.'],
  ['How are reminders sent?', 'You get reminders 7 days, 3 days, 1 day and 1 hour before a deadline, and once when a task becomes overdue. Each reminder is sent once. You can mute types or turn off email in Settings, Notifications.'],
  ['What do the colored edges on tasks mean?', 'They show deadline urgency: red is overdue, solid amber is due within two days, and pale amber is due within a week. No edge means there’s time.'],
  ['How is performance measured in reports?', 'Reports weight work by estimated effort and priority, not just the number of tasks. Committee roles, project leadership and open workload against capacity are shown alongside, so a single number never stands in for someone’s contribution.'],
  ['Can I use DWMT on my phone?', 'Yes. Open it in your phone’s browser and choose Add to Home Screen to install it like an app.'],
  ['Keyboard shortcuts', 'Ctrl + K (or Cmd + K) opens search from anywhere. In comments, type @ to mention someone and Ctrl + Enter to send.'],
];

export default function Help() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Help center" description="Answers to common questions about working in DWMT." />
      <Panel className="divide-y">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group px-5 py-4">
            <summary className="cursor-pointer list-none font-medium marker:hidden">{q}</summary>
            <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">{a}</p>
          </details>
        ))}
      </Panel>
      <p className="mt-6 text-sm text-muted-foreground">
        Still stuck? Ask your department chairman or system administrator. For problems with the software itself, contact the developer at{' '}
        <a className="text-primary hover:underline" href={`mailto:${siteConfig.developer.email}`}>{siteConfig.developer.email}</a>. See also <Link to="/settings" className="text-primary hover:underline">Settings</Link>.
      </p>
    </div>
  );
}
