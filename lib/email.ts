import nodemailer from "nodemailer";
import { Resend } from "resend";

type MailInput = {
  to: string;
  subject: string;
  html: string;
};

async function sendViaNodemailer(input: MailInput) {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
  });

  await transport.sendMail({
    from: process.env.MAIL_FROM ?? "dashboard@localhost",
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}

async function sendViaResend(input: MailInput) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM ?? "Dashboard <onboarding@resend.dev>",
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  if (error)
    throw new Error(`resend: ${error.message}`);
}

export async function sendMail(input: MailInput) {
  if (process.env.RESEND_API_KEY) {
    await sendViaResend(input);
    return;
  }
  await sendViaNodemailer(input);
}
