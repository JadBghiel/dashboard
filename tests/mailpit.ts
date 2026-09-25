/*
reads mail from mailpit's own http api
Lets tests grab a verification link without a real inbox
Only works against a running mailpit instance (docker-compose.dev.yml)
*/

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

export async function getLatestMail(to: string) {
    const res = await fetch( `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}` );

    if(!res.ok)
        throw new Error(`mailpit search failed: ${res.status}`);

    const { messages } = await res.json();

    if(messages.length === 0)
        throw new Error(`no mail found for ${to}`);

    const latestId = messages[0].ID;
    const messageRes = await fetch(`${MAILPIT_URL}/api/v1/message/${latestId}`);

    if(!messageRes.ok)
        throw new Error(`mailpit fetch message failed: ${messageRes.status}`);
    return messageRes.json();
}
