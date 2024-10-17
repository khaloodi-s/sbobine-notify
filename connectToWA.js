// require('dotenv').config(); THIS IS FOR LOCAL TESTING PURPOSES ONLY - COMMENT IT OUT BEFORE DEPLOYING
const Boom = require('@hapi/boom');
const NodeCache = require('node-cache');
const readline = require('readline');
const p = require('pino');
const fs = require('fs');
const path = require('path');
const { default: AnyMessageContent, BinaryInfo, delay, DisconnectReason, downloadAndProcessHistorySyncNotification, encodeWAM, fetchLatestBaileysVersion, getAggregateVotesInPollMessage, getHistoryMsg, isJidNewsletter, makeCacheableSignalKeyStore, makeInMemoryStore, proto, useMultiFileAuthState, WAMessageContent, WAMessageKey } = require('baileys');

//----------------

const usePairingCode = true // process.argv.includes('--use-pairing-code')
const useStore = !process.argv.includes('--no-store')
const doReplies = process.argv.includes('--do-reply')

const msgRetryCounterCache = new NodeCache()

const onDemandMap = new Map()

const rl = readline.createInterface({input: process.stdin, output: process.stdout})
const question = (text) => new Promise<string>((resolve) => rl.question(text, resolve))

const store = useStore ? makeInMemoryStore({logger}) : undefined
store?.readFromFile('/data/baileys_store_multi.json')
setInterval(() => {store?.writeToFile('/data/baileys_store_multi.json')}, 10_000)

//----------------

async function connectToWA() {
    const { state, saveCreds } = await useMultiFileAuthState('/data/baileys_auth_info') // Might have to switch state and saveCreds order around

    // Check for later WA web versions
    const { version, isLatest } = await fetchLatestBaileysVersion()
    console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: usePairingCode,
        auth:{
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        getMessage,
    })

    store?.bind(sock.ev)
    
    if (usePairingCode && !sock.authState.creds.registered) {
        const phoneNumber = await question('Please enter your phone number: \n')
        const code = await sock.requestPairingCode(phoneNumber)
        console.log(`Pairing code: ${code}`) 
    }

    async function sendMessageWTyping(msg, jid){
        await sock.presenceSubscribe(jid)
        await delay(500)

        await sock.sendPresenceUpdate('composing', jid)
        await delay(2000)

        await sock.sendPresenceUpdate('paused', jid)

        await sock.sendMessage(jid, msg)
    }

    sock.ev.process(
        async(events) => {
            if(events['connection.update']){
                const update = events['connection.update']
                const {connection, lastDisconnect} = update
                if(connection === 'close'){
                    if((lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut){
                        connectToWA()
                    } else{console.log('Connection closed. You are logged out.')}
                }
                console.log('connection update', update)
            }
            if(events['creds.update']){await saveCreds()}
            if(events['labels.association']){console.log(events['log.association'])}
            if(events['labels.edit']){console.log(events['labels.edit'])}
            if(events.call){console.log('recv call event', events.call)}
            if(events['messaging-history.set']){
                const{ chats, contacts, messages, isLatest, progress, syncType} = events['messaging-history.set']
                if(syncType === proto.HistorySync.HistorySyncType.ON_DEMAND){console.log(`recv ${chats.length} chats, ${contacts.length} contacts, ${messages.length} msgs (isLatest: ${isLatest}, progress: ${progress}%), type: ${synctype}`)}
            }
            if(events['messages.upsert']){
                const upsert = events['messages.upsert']
                console.log('recv messages ', JSON.stringify(upsert, undefined, 2))

                if(upsert.type === 'notify'){
                    for(const msg of upsert.messages){
                        if(msg.message?.conversation || msg.message?.extendedTextMessage?.text){
                            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text
                            if(text == "requestPlaceholder" && !upsert.requestId){
                                const messageId = await sock.requestPlaceholderResend(msg.key)
                                console.log('requested placeholder resync, id=', messageId)
                            } else if(upsert.requestId){
                                console.log('Message rexeived from phone, id=', upsert.requestId, msg)
                            }

                            if(text == "onDemandHistSync"){
                                const messageId = await sock.fetchMessageHistory(50, msg.key, msg.messageTimestamp)
                                console.log('requested on-demanc sync, id=', messageId)
                            }
                        }

                        if(!msg.key.fromMe && doReplies && !isJidNewsletter(msg.key?.remoteJid)){
                            console.log('replying to ', msg.key.remoteJid)
                            await sock.readMessages([msg.key])
                            await sendMessageWTyping({text: 'Hello there!'}, msg.key.remoteJid)
                        }
                    }
                }
            }
            if(events['messages.update']){
                console.log(JSON.stringify(events['messages.update'], undefined, 2))
                for(const{key, update} of events['messages.update']) {
                    if(update.pollUpdates){
                        const pollCreation = await getMessage(key)
                        if(pollCreation){console.log('got poll updates, aggregation: ', getAggregateVotesInPollMessage({message: pollCreation, pollUpdates: update.pollUpdates}))}
                    }
                }
            }
            if(events['message-receipt.update']){console.log(events['message-receipt.update'])}
            if(events['messages.reaction']){console.log(events['message.reaction'])}
            if(events['presence.update']){console.log(events['presence.update'])}
            if(events['chat.update']){console.log(events['chat.update'])}
            if(events['contacts.update']){
                for(const contact of events['contacts.update']){
                    if(typeof contact.imgUrl !== 'undefined'){
                        const newUrl = contact.imgUrl === null
                            ?null
                            :await sock.profilePictureUrlUrl(contact.id).catch(() => null)
                        console.log(`contact: ${contact.id} has a new profile pic: ${newUrl}`)
                    }
                }
            }
            if(events['chats.delete']){console.log('chats deleted', events['chats.delete'])}
        }
    )

    return sock

    async function getMessage(key){
        if(store){
            const msg = await store.loadMessage(key.remoteJid, key.id)
            return msg?.message || undefined
        }
        return proto.Message.fromObject({})
    }

}

connectToWA()

module.exports = connectToWA; // Export the function