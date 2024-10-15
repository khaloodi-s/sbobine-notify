import { Boom } from '@hapi/boom';
import NodeCache from 'node-cache';
import readline from 'readline';
import makeWASocket, { AnyMessageContent, delay, DisconnectReason, fetchLatestBaileysVersion, isJidNewsletter, makeCacheableSignalKeyStore, makeInMemoryStore, proto, useMultiFileAuthState, WAMessageKey } from 'baileys';
import open from 'open';
import fs from 'fs';
import P from 'pino';

// Create a logger with logs stored in /data/wa-logs.txt
const logger = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` }, P.destination('/data/wa-logs.txt'));
logger.level = 'trace';

const useStore = !process.argv.includes('--no-store');
const doReplies = process.argv.includes('--do-reply');
const usePairingCode = process.argv.includes('--use-pairing-code');

// External cache for retry counts when decryption/encryption fails
const msgRetryCounterCache = new NodeCache();
const onDemandMap = new Map<string, string>();

// Readline interface for user input
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text: string) => new Promise<string>((resolve) => rl.question(text, resolve));

// Store connection data in memory and write it to /data/baileys_store_multi.json
const store = useStore ? makeInMemoryStore({ logger }) : undefined;
store?.readFromFile('/data/baileys_store_multi.json');

// Save store data every 10 seconds
setInterval(() => {
    store?.writeToFile('/data/baileys_store_multi.json');
}, 10_000);

// Start a new WhatsApp connection
export const startSock = async () => {  // Exporting the startSock function
    const { state, saveCreds } = await useMultiFileAuthState('/data/baileys_auth_info');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: !usePairingCode,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        getMessage,
    });

    store?.bind(sock.ev);

    // Handle pairing code for Web clients
    if (usePairingCode && !sock.authState.creds.registered) {
        const phoneNumber = await question('Please enter your phone number:\n');
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`Pairing code: ${code}`);
    }

    const sendMessageWTyping = async (msg: AnyMessageContent, jid: string) => {
        await sock.presenceSubscribe(jid);
        await delay(500);

        await sock.sendPresenceUpdate('composing', jid);
        await delay(2000);

        await sock.sendPresenceUpdate('paused', jid);
        await sock.sendMessage(jid, msg);
    };

    sock.ev.process(
        async (events) => {
            if (events['connection.update']) {
                const update = events['connection.update'];
                const { connection, lastDisconnect } = update;

                if (connection === 'close') {
                    if ((lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
                        startSock();
                    } else {
                        console.log('Connection closed. You are logged out.');
                    }
                }
                console.log('connection update', update);
            }

            if (events['creds.update']) {
                await saveCreds();
            }

            if (events['messages.upsert']) {
                const upsert = events['messages.upsert'];
                console.log('recv messages ', JSON.stringify(upsert, undefined, 2));

                if (upsert.type === 'notify') {
                    for (const msg of upsert.messages) {
                        if (!msg.key.fromMe && doReplies && !isJidNewsletter(msg.key?.remoteJid!)) {
                            console.log('replying to', msg.key.remoteJid);
                            await sock!.readMessages([msg.key]);
                            await sendMessageWTyping({ text: 'Hello there!' }, msg.key.remoteJid!);
                        }
                    }
                }
            }

            if (events['messages.update']) {
                console.log(JSON.stringify(events['messages.update'], undefined, 2));
            }

            if (events['presence.update']) {
                console.log(events['presence.update']);
            }

            if (events['contacts.update']) {
                for (const contact of events['contacts.update']) {
                    if (typeof contact.imgUrl !== 'undefined') {
                        const newUrl = contact.imgUrl === null
                            ? null
                            : await sock!.profilePictureUrl(contact.id!).catch(() => null);
                        console.log(`contact ${contact.id} has a new profile pic: ${newUrl}`);
                    }
                }
            }
        }
    );

    return sock;

    // Helper function to retrieve messages from the store
    async function getMessage(key: WAMessageKey): Promise<proto.IMessage | undefined> {
        if (store) {
            const msg = await store.loadMessage(key.remoteJid!, key.id!);
            return msg?.message || undefined;
        }
        return proto.Message.fromObject({});
    }
};

startSock();
