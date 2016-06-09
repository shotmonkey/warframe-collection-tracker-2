import express from 'express';
import compress from 'compression';

import log from './logging';
import { getPrimeData } from './prime-data';

const app = express();

process.on('uncaughtException', err => log.error(err));

app.use(compress());

app.get('/prime-data', (req, res) => {

    getPrimeData()
        .then(data => {
            res.json(data);
        })
        .catch(err => {
            throw err;
        });
});

app.get('*', (req, res) => {
    res.send(404, 'Not Found');
});

app.use((req, res, err, next) => {
    if (err) {
        res.send(500, err);
    }
    next();
});

export default app;