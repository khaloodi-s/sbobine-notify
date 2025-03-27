const axios = require('axios');

const proxyUrl = process.env.FIXIE_PROXY;
const proxy = new URL(proxyUrl);

async function checkIP() {
    try {
        const response = await axios.get('https://api64.ipify.org?format=json', {
            proxy: {
                host: proxy.hostname,
                port: proxy.port,
                auth: {
                    username: proxy.username,
                    password: proxy.password
                }
            }
        });
        console.log('External IP (via Fixie Proxy):', response.data.ip);
    } catch (error) {
        console.error('Proxy test failed:', error.message);
    }
}

checkIP();