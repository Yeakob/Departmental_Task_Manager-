import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="task-code text-sm">404</p>
      <h1 className="mt-2 text-xl font-semibold">This page doesn’t exist</h1>
      <p className="mt-1 text-sm text-muted-foreground">Check the address, or go back to your dashboard.</p>
      <Button asChild className="mt-4"><Link to="/">Go to dashboard</Link></Button>
    </div>
  );
}
