const Escalation = require('../models/Escalation');
const fetch = require('node-fetch');
const nodemailer = require('nodemailer');

async function sendDashboard(payload) { return true; }
async function sendWebhook(payload) {
  if (!process.env.ALERT_WEBHOOK_URL) return false;
  await fetch(process.env.ALERT_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return true;
}
async function sendEmail(payload) {
  if (!process.env.SMTP_HOST) return false;
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await t.sendMail({
    from: `SafeOwnerZone <${process.env.SMTP_USER}>`,
    to: process.env.ALERT_EMAIL_TO || process.env.SMTP_USER,
    subject: `[${payload.level}] ${payload.title}`,
    text: `${payload.text}\n\n${JSON.stringify(payload.data ?? {}, null, 2)}`
  });
  return true;
}
async function sendSMS(payload) {
  if (!process.env.TWILIO_SID) return false;
  const u = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_SID}/Messages.json`;
  const body = new URLSearchParams({
    To: process.env.ALERT_SMS_TO,
    From: process.env.TWILIO_FROM,
    Body: `[${payload.level}] ${payload.title}: ${payload.text}`
  });
  await fetch(u, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${process.env.TWILIO_SID}:${process.env.TWILIO_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  return true;
}

async function runEscalation(event, level, payload) {
  const cfg = await Escalation.findOne().lean();
  const row = cfg?.levels.find(l => l.level === level);
  if (!row) return false;
  const p = { ...payload, level, event };
  row.channels?.dashboard && await sendDashboard(p);
  row.channels?.email && await sendEmail(p);
  row.channels?.sms && await sendSMS(p);
  row.channels?.webhook && await sendWebhook(p);
  if (level === 'L3' && row.autoLockdown) {
    // Future: could trigger auto lockdown here.
  }
  return true;
}

module.exports = { runEscalation };
