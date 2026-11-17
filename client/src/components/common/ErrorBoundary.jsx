import { Component } from 'react';
import { Button } from '@/components/ui/button';

/** Catches render errors and lazy-chunk failures (e.g. after a deploy). */
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error(error, info); // eslint-disable-line no-console
  }
  render() {
    if (!this.state.error) return this.props.children;
    const chunk = /Loading chunk|dynamically imported module/i.test(String(this.state.error?.message));
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <p className="text-lg font-semibold">{chunk ? 'A new version is available' : 'This page hit an error'}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{chunk ? 'Reload to get the latest version of DWMT.' : 'Reload the page. If it keeps happening, tell your administrator what you were doing.'}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>Reload</Button>
      </div>
    );
  }
}
