import nodemailer from "nodemailer";

type MailInput = {
    to: string,
    subject: string,
    html: string,
}

//this function is specifically for local testing
export async function sendMail(input: MailInput) {
    const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? "localhost", //local fallback
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
