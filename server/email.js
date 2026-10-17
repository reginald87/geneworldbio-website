function config() {
  const apiKey = process.env.RESEND_API_KEY || '';
  const notifyTo = (process.env.ENQUIRY_NOTIFY_TO || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const smtpHost = process.env.SMTP_HOST || '';
  const smtpPort = Number(process.env.SMTP_PORT || 587) || 587;
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';
  const smtpSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || smtpPort === 465;
  const resendConfigured = Boolean(apiKey && notifyTo.length);
  const smtpConfigured = Boolean(smtpHost && notifyTo.length && (!smtpUser || smtpPass));
  const fallbackFrom = resendConfigured || !smtpUser
    ? 'GeneWorldBio Website <onboarding@resend.dev>'
    : `GeneWorldBio Website <${smtpUser}>`;
  const siteUrl = (process.env.SITE_URL || '').replace(/\/+$/, '');
  const from = process.env.ENQUIRY_FROM || fallbackFrom;
  return { apiKey, from, notifyTo, smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, resendConfigured, smtpConfigured, configured: resendConfigured || smtpConfigured, siteUrl };
}

export const mailerConfigured = () => config().configured;

export const mailerProvider = () => {
  const settings = config();
  return settings.resendConfigured ? 'resend' : settings.smtpConfigured ? 'smtp' : null;
};

const labels = {
  reference: 'Reference',
  category: 'Enquiry type',
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  contactMethod: 'Preferred contact',
  organisation: 'Organisation',
  orgType: 'Organisation type',
  institutionType: 'Institution type',
  role: 'Role or department',
  location: 'Location',
  language: 'Preferred language',
  subject: 'Subject',
  needs: 'Testing, research or supply needs',
  volume: 'Estimated volume',
  volumeUnit: 'Volume period',
  logistics: 'Logistics requirements',
  ethicsStatus: 'Ethics approval',
  timeline: 'Expected timeline',
  website: 'Website',
  registrationNumber: 'Registration number',
  message: 'Message',
};

const order = [
  'reference', 'category', 'name', 'email', 'phone', 'contactMethod', 'organisation', 'orgType',
  'institutionType', 'role', 'location', 'language', 'subject', 'needs', 'volume', 'volumeUnit',
  'logistics', 'ethicsStatus', 'timeline', 'website', 'registrationNumber', 'message',
];

const esc = (value = '') =>
  String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

function detailTable(record, reference) {
  const rows = order
    .map((key) => {
      const value = key === 'reference' ? reference : record[key];
      if (value === undefined || value === null || value === '') return '';
      return `<tr style="background:#fff"><td style="padding:10px 12px;color:#0b3f78;vertical-align:top;white-space:nowrap;border-top:1px solid #e6eef5"><b>${esc(labels[key] || key)}</b></td><td style="padding:10px 12px;color:#163247;border-top:1px solid #e6eef5">${esc(value).replace(/\n/g, '<br>')}</td></tr>`;
    })
    .filter(Boolean)
    .join('');
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;width:100%" cellpadding="0" cellspacing="0">
    ${rows}
  </table>`;
}

function wrap(title, body) {
  const { siteUrl } = config();
  const logoSrc = siteUrl ? `${siteUrl}/logo-wordmark.png` : '';
  const logo = logoSrc
    ? `<div style="text-align:center;padding:20px 0 16px 0"><img src="${logoSrc}" alt="GeneWorldBio" width="210" height="38" style="display:block;margin:0 auto;border:0;max-width:100%;height:auto" /></div>`
    : `<div style="text-align:center;padding:20px 0 16px 0;font-family:Arial,sans-serif;font-size:18px;font-weight:600;color:#0b3f78;letter-spacing:0.06em;text-transform:uppercase">GENEWORLDBIO</div>`;
  return `<!doctype html><html><body style="margin:0;padding:0;background-color:#f4f8fb">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f4f8fb">
      <tr><td align="center" style="padding:24px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;background:#fff;border:1px solid #e1ecf5;border-radius:10px;overflow:hidden">
          <tr><td style="background:linear-gradient(90deg,#0b3f78 0%,#2e7d21 100%);height:4px;font-size:0;line-height:0">&nbsp;</td></tr>
          <tr>${logo}</tr>
          <tr><td style="padding:0 24px"><h1 style="font-family:Arial,sans-serif;font-size:18px;color:#0b3f78;margin:0 0 16px 0">${esc(title)}</h1>${body}</td></tr>
          <tr><td style="padding:24px;font-family:Arial,sans-serif;font-size:12px;color:#5f7480;line-height:1.6;background:#f9fbfd">
            <div style="margin-bottom:6px"><b>GENEWORLDBIO LTD</b> · RC 9795367</div>
            <div>No. 7B, Azikoro Road, Ekeki, Yenagoa, Bayelsa State, Nigeria</div>
            <div style="margin-top:10px;color:#7c8f9c">This mailbox is not monitored for emergencies. For urgent medical needs, contact your care team or local emergency services.</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

let transporterPromise = null;

async function smtpTransport() {
  if (!transporterPromise) {
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure } = config();
    transporterPromise = import('nodemailer').then(({ default: nodemailer }) =>
      nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
      })
    );
  }
  return transporterPromise;
}

async function deliver({ to, replyTo, subject, html }) {
  const c = config();
  if (c.resendConfigured) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${c.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: c.from, to, reply_to: replyTo, subject, html }),
    });
    if (!response.ok) throw new Error(`email provider responded ${response.status}`);
    return response.json().catch(() => ({}));
  }
  const transporter = await smtpTransport();
  return transporter.sendMail({ from: c.from, to, replyTo, subject, html });
}

export async function sendEnquiryEmails(record, reference) {
  const { notifyTo, configured } = config();
  if (!configured) return { status: 'skipped' };
  const result = { owner: 'pending', enquirer: 'pending' };

  try {
    await deliver({
      to: notifyTo,
      replyTo: record.email || undefined,
      subject: `[GeneWorldBio] New ${record.category || 'general'} enquiry (${reference})`,
      html: wrap('New website enquiry', `<p style="font-family:Arial,sans-serif;font-size:14px;color:#163247;line-height:1.7;margin:0 0 20px 0">A new enquiry was submitted through the website.</p>${detailTable(record, reference)}`),
    });
    result.owner = 'sent';
  } catch (error) {
    result.owner = `error: ${error.message}`;
  }

  if (record.email) {
    try {
      await deliver({
        to: [record.email],
        replyTo: notifyTo[0],
        subject: `We have received your enquiry (${reference})`,
        html: wrap(
          'Thank you — we have received your enquiry',
          `<p style="font-family:Arial,sans-serif;font-size:15px;color:#163247;line-height:1.7">Hello ${esc(record.name || 'there')},</p><p style="font-family:Arial,sans-serif;font-size:14px;color:#163247;line-height:1.7">Thank you for contacting GeneWorldBio. Your reference is <b style="color:#2e7d21">${esc(reference)}</b>.</p><p style="font-family:Arial,sans-serif;font-size:14px;color:#5f7480;line-height:1.7">We aim to respond within two business days. This mailbox is not monitored for emergencies — for urgent medical needs, please contact your care team or local emergency services.</p><p style="font-family:Arial,sans-serif;font-size:14px;color:#163247;line-height:1.7;margin-top:24px">For your records, here is what you sent:</p>${detailTable(record, reference)}`
        ),
      });
      result.enquirer = 'sent';
    } catch (error) {
      result.enquirer = `error: ${error.message}`;
    }
  } else {
    result.enquirer = 'skipped';
  }

  return result;
}
