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
