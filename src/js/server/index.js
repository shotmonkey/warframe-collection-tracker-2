import fs from 'fs';

import uuid from 'node-uuid';
import BluebirdPromise from 'bluebird';
global.Promise = BluebirdPromise;

import http from 'http';
import app from './app';
import log from './logging';

const port = 9002;

let server = http.createServer(app);
log.info('Starting HTTP server');

server.listen(port, function() {
    log.debug(`Successfully started server, listening on port ${port}`);
});

const masteryData = JSON.parse(fs.readFileSync('./mastery_data.json'));
let newMasteryData = {};

let type = null;
masteryData.data.forEach(item => {
    type = item.type || type;
    let name = item.name;
    newMasteryData[type] = newMasteryData[type] || {};
    newMasteryData[type][name] = { id: uuid.v4() };
});
fs.writeFileSync('./new_mastery_data.json', JSON.stringify(newMasteryData, null, 4));

const primeData = JSON.parse(fs.readFileSync('./prime_data.json'));
let newPrimeData = {};

let primeType = null;
let primeName = null;
let primePartName = null;
primeData.data.forEach(item => {
    primeType = item.primetype || primeType;
    primeName = item.primename || primeName;
    primePartName = item.partname || primePartName;
    let newPrimeType = newPrimeData[primeType] = newPrimeData[primeType] || {};
    let newPrimeName = newPrimeType[primeName] = newPrimeType[primeName] || { id: uuid.v4(), parts: {}};
    newPrimeName.parts[primePartName] = newPrimeName.parts[primePartName] || { id: uuid.v4() };
});

fs.writeFileSync('./new_prime_data.json', JSON.stringify(newPrimeData, null, 4));