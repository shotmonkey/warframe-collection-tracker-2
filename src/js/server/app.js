import path from 'path';

import express from 'express';
import compress from 'compression';
import sqlite3 from 'sqlite3';

import log from './logging';
import { getPrimeDropData } from './prime-drop-data';

const app = express();

process.on('uncaughtException', err => log.error(err));

app.use(compress());

app.get('/db/:privatekey', (req, res) => {
    let key = req.params.privatekey;

    let db = new sqlite3.Database('./warframe.live.sqlite');

    db.serialize(() => {

        let stmt = db.prepare('SELECT publickey, jsondata, timestamp FROM wf_user_data WHERE privatekey = ?');
        stmt.get(key, (err, result) => {
            if (err) { throw err; }
            if (!result) { throw 'No result'; }
            res.json(result);
        });
        stmt.finalize();

    });

    db.close();
});

app.get('/prime-data', (req, res) => {

    getPrimeDropData()
        .then(data => {
            res.json(data);
        })
        .catch(err => {
            throw err;
        });
});

app.get('/app.js', (req, res) => {
    res.sendFile('app.js', {
        root: path.join(__dirname, '../../client/js')
    });
});

app.get('/', (req, res) => {
    res.sendFile('index.html', {
        root: path.join(__dirname, '../../templates')
    });
});

app.get('*', (req, res) => {
    res.status(404)
        .json({
            error: 'Not Found',
            endpoint: req.path
        });
});

app.use((err, req, res, next) => {
    if (err) {
        res.status(500).send('');
        log.error(err);
    }
    next();
});

export default app;