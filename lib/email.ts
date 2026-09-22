type MailInput = {
    to: string,
    subject: string,
    html: string,
}

export async function sendMail(input: MailInput) {
    console.log("sendMail called:", input) // just for testing sending emails
}
