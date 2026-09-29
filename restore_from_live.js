const fs = require('fs');
const https = require('https');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && !f.includes('bak'));

console.log(`Found ${files.length} HTML files to restore.`);

async function downloadFile(filename) {
    return new Promise((resolve, reject) => {
        const url = `https://canoas-gas.web.app/${filename}`;
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                console.log(`Failed ${filename} with status ${res.statusCode} at URL ${url}`);
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    console.log(`Redirecting to ${res.headers.location}`);
                    https.get(res.headers.location, (res2) => {
                        let data = '';
                        res2.on('data', chunk => data += chunk);
                        res2.on('end', () => {
                             fs.writeFileSync(path.join(dir, filename), data, 'utf-8');
                             console.log(`Restored ${filename} after redirect`);
                             resolve(true);
                        });
                    });
                } else {
                    resolve(false);
                }
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const origPath = path.join(dir, filename);
                fs.writeFileSync(origPath, data, 'utf-8');
                console.log(`Restored ${filename} from live site`);
                resolve(true);
            });
        }).on('error', err => {
            console.error(`Failed to download ${filename}:`, err);
            resolve(false);
        });
    });
}

async function run() {
    for (const file of files) {
        if (file === 'index.html' || file === 'index2.html') continue;
        await downloadFile(file);
    }
    console.log('Restore complete.');
}

run();
