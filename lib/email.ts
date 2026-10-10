import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";

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

async function sendViaSendGrid(input: MailInput) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

  await sgMail.send({
    from: process.env.MAIL_FROM as string,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}

export async function sendMail(input: MailInput) {
  if (process.env.SENDGRID_API_KEY) {
    await sendViaSendGrid(input);
    return;
  }
  await sendViaNodemailer(input);
}
