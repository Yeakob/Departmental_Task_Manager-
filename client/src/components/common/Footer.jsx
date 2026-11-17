import { Mail } from 'lucide-react';
import { siteConfig } from '@/app/siteConfig';

/**
 * Global footer with copyright and developer credit.
 * Rendered at the bottom of every layout (app shell and sign-in page).
 */
export default function Footer({ className = '' }) {
  const year = new Date().getFullYear();
  const { developer } = siteConfig;

  return (
    <footer className={`border-t px-4 py-4 text-xs text-muted-foreground sm:px-6 ${className}`}>
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
        <p>
          © {year} {siteConfig.copyrightHolder}. All rights reserved.
        </p>
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span>
            Developed by <span className="font-medium text-foreground">{developer.name}</span>, {developer.title}, {developer.department}, {developer.institution}
          </span>
          <a href={`mailto:${developer.email}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            {developer.email}
          </a>
        </p>
      </div>
    </footer>
  );
}
