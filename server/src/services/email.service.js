import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.smtp.host) return null;
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
  return transporter;
}

function layout({ title, body, actionUrl, actionLabel }) {
  return `<!doctype html><html><body style="margin:0;background:#f5f6fa;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <div style="font-size:12px;letter-spacing:.08em;color:#6366f1;font-weight:600;text-transform:uppercase">DWMT</div>
    <h1 style="font-size:20px;margin:12px 0 16px">${title}</h1>
    <div style="font-size:15px;line-height:1.6;color:#374151">${body}</div>
    ${actionUrl ? `<a href="${actionUrl}" style="display:inline-block;margin-top:24px;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${actionLabel || 'Open'}</a>` : ''}
    <p style="margin-top:32px;font-size:12px;color:#9ca3af">You are receiving this because of your notification preferences in DWMT.</p>
  </div></body></html>`;
}

/** Sends an email if SMTP is configured; otherwise logs it. Never throws. */
export async function sendEmail({ to, subject, title, body, actionPath, actionLabel }) {
  const actionUrl = actionPath ? `${env.clientUrl}${actionPath}` : undefined;
  const html = layout({ title: title || subject, body, actionUrl, actionLabel });
  const t = getTransporter();
  if (!t) {
    logger.info({ to, subject }, '[email:dry-run]');
    return { dryRun: true };
  }
  try {
    await t.sendMail({ from: env.smtp.from, to, subject, html });
    return { sent: true };
  } catch (err) {
    logger.warn({ err, to, subject }, 'email send failed');
    return { sent: false };
  }
}
