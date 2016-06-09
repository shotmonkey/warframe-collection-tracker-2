import git from 'nodegit';
import tmp from 'tmp';
import _ from 'lodash';
import Promise from 'bluebird';

import log from './logging';

const REPO_PATH = 'https://github.com/VoiDGlitch/WarframeData.git';
const DATA_FILE_PATH = 'MissionDecks.txt';
const UPDATE_DELAY = 60 * 1000;
const MAX_UPDATE_FAILS = 3;

let updatePromise = null;
let updateDelayTimer = null;

let primes = null;

export class PrimeItem {
    constructor(name) {
        this.name = name;
        this.parts = [];
    }
    getOrAddPart(name, ducats) {
        let matchingParts = this.parts.filter(part => part.name === name);
        if (matchingParts.length>0) { return matchingParts[0]; }
        let newPart = new PrimePart(name, ducats);
        this.parts.push(newPart);
        return newPart;
    }
    addPartDrop(name, ducats, location, missionType, rotation, chance) {
        let part = this.getOrAddPart(name, ducats);
        part.dropLocations.push(new DropLocation(location, missionType, rotation, chance));
        return this;
    }
}

export class PrimePart {
    constructor(name, ducats) {
        this.name = name;
        this.ducats = ducats;
        this.dropLocations = [];
    }
}

export class DropLocation {
    constructor(location, missionType, rotation, chance) {
        this.location = location;
        this.missionType = missionType;
        this.rotation = rotation;
        try {
            this.chance = parseFloat(chance);
            if (isNaN(this.chance)) {
                this.chance = null;
            }
        } catch (e) {
            this.chance = null;
        }

    }
}

function processData(text) {
    log.info(`Processing text`);

    let primes = [];

    const VoidKeyMissionRegex = /^\[VoidKeyMissionRewards\/([^\]]+)\]$/;
    const VoidKeyMissionTypeRegex = /^Orokin(.+)Rewards([ABCD])$/;
    const VoidTowerLevels = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };
    const DerelictMissionRegex = /^\[Derelict(.+)Rewards\]$/;

    const RotationRegex = /^Rotation ([ABC]):$/;

    const OtherMissionRegex = /^\[.+\]$/;

    const AttenuationLineRegex = /^Attenuation:.+$/;
    const RewardRegex = /^(\d+) ([^,]+), ([^,]+), ([^%]+)%(?:, (\d+) Ducats)?$/;
    const PrimeItemRegex = /(.+ prime) (?:(blueprint)|(.+) blueprint|(.+))$/i;

    let _missionLocation = null;
    let _missionType = null;
    let _rotation = null;

    function getPrimeItem(name) {
        let matchingPrimes = primes.filter(prime => prime.name === name);
        if (matchingPrimes.length > 0) { return matchingPrimes[0]; }
        let newPrime = new PrimeItem(name);
        primes.push(newPrime);
        return newPrime;
    }

    function addPrimeItemDrop(primeName, partName, ducats, location, missionType, rotation, chance) {
        let item = getPrimeItem(primeName);
        item.addPartDrop(partName, ducats, location, missionType, rotation, chance);
    }

    let lines = text.split('\n');
    lines.forEach(line => {

        line = line.trim();

        if (line === '') { return; }

        let missionMatches = line.match(VoidKeyMissionRegex);
        if (missionMatches) {

            let mission = missionMatches[1];

            let typeMatches = mission.match(VoidKeyMissionTypeRegex);
            if (typeMatches) {

                let missionType = typeMatches[1];
                let level = VoidTowerLevels[typeMatches[2]];

                _missionLocation = `Tower ${level}`;
                _missionType = missionType;

                log.debug(_missionLocation, _missionType);

                return;
            }

            return;
        }

        let derelictMatches = line.match(DerelictMissionRegex);
        if (derelictMatches) {

            _missionLocation = 'Orokin Derelict';
            _missionType = derelictMatches[1];

            log.debug(_missionLocation, _missionType);

            return;
        }

        let resetMatches = line.match(OtherMissionRegex);
        if (resetMatches) {

            _missionLocation = null;
            _missionType = null;
            _rotation = null;

            return;
        }

        if (!_missionType) {
            return;
        }

        let rotationMatches = line.match(RotationRegex);
        if (rotationMatches) {

            _rotation = rotationMatches[1];

            return;
        }

        if (!_rotation) {
            return;
        }

        let rewardMatches = line.match(RewardRegex);
        if (rewardMatches) {
            let reward = {
                quantity: rewardMatches[1],
                name: rewardMatches[2],
                rarity: rewardMatches[3],
                dropRate: rewardMatches[4],
                ducats: rewardMatches[5]
            };
            log.debug(reward);

            let primeItemMatches = reward.name.match(PrimeItemRegex);
            if (primeItemMatches) {
                let prime = {
                    item: primeItemMatches[1],
                    part: primeItemMatches[2] || primeItemMatches[3] || primeItemMatches[4]
                };

                addPrimeItemDrop(prime.item, prime.part, reward.ducats, _missionLocation, _missionType, _rotation, reward.dropRate);

            }

            return;
        }

        let attenuationMatches = line.match(AttenuationLineRegex);
        if (attenuationMatches) {
            return;
        }

        log.warn('Unmatched line:', line);

    });

    log.info(`Processing complete`);

    return primes;
}

function update() {
    return new Promise((resolve, reject) => {

        try {

            log.debug('Creating tmp directory');
            tmp.dir({ unsafeCleanup: true }, (err, tmpPath, tmpDirCleanup) => {

                if (err) throw err;

                log.debug(`Created tmp directory: ${tmpPath}`);
                log.debug(`Cloning repo ${REPO_PATH}`);

                let _repo = null;

                git.Clone(REPO_PATH, tmpPath)
                    .then(repo => {
                        log.debug(`Getting 'master'`);
                        _repo = repo;
                        return repo.getMasterCommit();
                    })
                    .then(commit => {
                        log.debug(`Getting commit info`);
                        log.info(commit.id());
                        return commit;
                    })
                    .then(commit => commit.getTree())
                    .then(tree => tree.entryByPath(DATA_FILE_PATH))
                    .then(entry => {
                        if (!entry.isBlob()) reject('File not a blob');
                        return _repo.getBlob(entry.oid());
                    })
                    .then(blob => {
                        let primes = processData(blob.toString());
                        log.info(`Update complete`);
                        resolve(primes);
                    })
                    .catch(err => {
                        log.error(`Update failed`, err);
                        reject(err);
                    })
                    .finally(() => {
                        try {
                            log.debug(`Cleaning up repository`);
                            _repo.cleanup();
                            log.debug(`Cleaning up tmp directory: ${tmpPath}`);
                            tmpDirCleanup();
                        } catch (e) {
                            log.error(`Error cleaning up`, e);
                        }
                    });
            });

        } catch (err) {
            log.error(`Update error`, err);
            reject(err);
        }

    });
}

// eslint-disable-next-line no-unused-vars
function startUpdate() {
    return new Promise((resolve, reject) => {

        let updateFails = 0;

        function runUpdate() {
            update()
            .then(data => {
                updateFails = 0;
                resolve(data);
            })
            .catch(() => {
                updateFails++;
            })
            .finally(() => {
                if (updateFails > 0) {
                    if (updateFails < MAX_UPDATE_FAILS) {
                        _.defer(runUpdate);
                    } else {
                        reject('Max update attempts reached');
                    }
                }
            });
        }

        runUpdate();

    });
}

export function getPrimeData() {
    log.debug('getPrimeData');

    if (updatePromise) {
        if (primes) {
            log.debug('> Promise running, returning cached data');
            return Promise.resolve(primes);
        }
        log.debug('> Promise running, no cached data, returning promise');
        return updatePromise;
    }

    if (updateDelayTimer && primes) {
        log.debug('> Update delay timer active, returning cached data');
        return Promise.resolve(primes);
    }

    log.debug('Clearing updateDelayTimer to create new promise');
    clearTimeout(updateDelayTimer);

    updatePromise = new Promise((resolve, reject) => {

        startUpdate()
            .then(data => {
                log.debug('Caching prime data');
                primes = data;
                resolve(data);
            })
            .catch(err => {
                reject(err);
            })
            .finally(() => {

                log.debug('Clearing updatePromise');
                updatePromise = null;

                log.debug('Creating updateDelayTimer');
                updateDelayTimer = _.delay(() => {
                    log.debug('Nulling updateDelayTimer');
                    updateDelayTimer = null;
                    log.debug('Automatically running data update after timer');
                    getPrimeData();
                }, UPDATE_DELAY);
            });

    });

    if (primes) {
        log.debug('> New promise created, returning cached data');
        return Promise.resolve(primes);
    }

    log.debug('> New promise created, no cached data, returning promise');
    return updatePromise;

}