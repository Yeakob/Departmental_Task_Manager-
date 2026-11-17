import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import Footer from '@/components/common/Footer';
import { BrandMark } from '@/layouts/Sidebar';
import { useLoginMutation } from '@/services/endpoints';
import { apiError } from '@/lib/utils';
import { siteConfig } from '@/app/siteConfig';

const schema = z.object({
  email: z.string().trim().email('Enter the email address your department registered'),
  password: z.string().min(1, 'Enter your password'),
});

const DEMO = [
  ['Chairman', 'chairman@dwmt.local'],
  ['Program Coordinator', 'pc@dwmt.local'],
  ['Faculty', 'rafiq@dwmt.local'],
  ['Office staff', 'office@dwmt.local'],
];

export default function Login() {
  const [login, { isLoading, error }] = useLoginMutation();
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, setValue, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    try {
      await login(values).unwrap();
      navigate(location.state?.from || '/', { replace: true });
    } catch {
      /* error rendered below */
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="grid flex-1 lg:grid-cols-[1.05fr_1fr]">
        <section className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <BrandMark size={36} />
            <span className="text-lg font-semibold">{siteConfig.appName}</span>
          </div>
          <div className="my-auto max-w-[30rem]">
            <h1 className="text-[2.6rem] font-semibold leading-[1.1] tracking-tight">Every departmental responsibility, in one place.</h1>
            <p className="mt-5 text-md leading-relaxed text-sidebar-muted">
              Assignments from the chairman, committee work, exam duties, accreditation evidence and meeting decisions, tracked from assignment to approval.
            </p>
            <dl className="mt-10 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/10 text-sm">
              {[
                ['Instead of', 'Excel trackers'],
                ['Instead of', 'Paper assignments'],
                ['Instead of', 'WhatsApp instructions'],
              ].map(([k, v]) => (
                <div key={v} className="bg-white/[0.03] p-4">
                  <dt className="text-xs text-sidebar-muted">{k}</dt>
                  <dd className="mt-1 font-medium line-through decoration-[#E5A93A] decoration-2">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="text-xs text-sidebar-muted">{siteConfig.appFullName}</p>
        </section>

        <section className="flex items-center justify-center px-5 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <BrandMark size={32} />
              <span className="text-lg font-semibold">{siteConfig.appName}</span>
            </div>
            <h2 className="text-xl font-semibold">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use the account your department administrator created for you.</p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
              <Field label="Email" htmlFor="email" error={errors.email?.message}>
                <Input id="email" type="email" autoComplete="username" autoFocus aria-invalid={!!errors.email} {...register('email')} />
              </Field>
              <Field label="Password" htmlFor="password" error={errors.password?.message}>
                <div className="relative">
                  <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" aria-invalid={!!errors.password} className="pr-10" {...register('password')} />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label={show ? 'Hide password' : 'Show password'}>
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{apiError(error, 'Sign-in failed. Check your connection and try again.')}</p>}
              <Button type="submit" className="w-full" size="lg" loading={isLoading}>Sign in</Button>
              <p className="text-center text-xs text-muted-foreground">Forgot your password? Ask your department chairman or system administrator to reset it.</p>
            </form>

            {import.meta.env.DEV && (
              <div className="mt-8 rounded-lg border p-3">
                <p className="text-xs font-medium">Demo accounts (development only, password Demo@12345)</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DEMO.map(([label, email]) => (
                    <button key={email} type="button" className="rounded-full border px-2.5 py-1 text-xs hover:bg-accent" onClick={() => { setValue('email', email); setValue('password', 'Demo@12345'); }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}
