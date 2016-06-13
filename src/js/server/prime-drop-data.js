import tmp from 'tmp';
import git from 'nodegit';

import log from './logging';
import { repeatingCachedPromise } from './utils';
import { PrimeItem } from './data-classes';

const REPO_PATH = 'https://github.com/VoiDGlitch/WarframeData.git';
const DATA_FILE_PATH = 'MissionDecks.txt';

// eslint-disable-next-line
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

                return;
            }

            return;
        }

        let derelictMatches = line.match(DerelictMissionRegex);
        if (derelictMatches) {

            _missionLocation = 'Orokin Derelict';
            _missionType = derelictMatches[1];

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


export class PrimeDropDataImporter {

    constructor(repoPath = REPO_PATH) {
        this.repoPath = repoPath;
        this.repo = null;

        this.lastCommitId = null;
        this.data = null;

        this.getPrimeDropDataFile = repeatingCachedPromise(this.getPrimeDropDataFile);
    }

    getGitRepository() {
        if (this.repo) {
            log.debug('PrimeDropDataImporter', 'Updating and returning exising repo');
            return this.repo.mergeBranches('master', 'origin/master')
                .then(() => this.repo);
        }

        log.debug('PrimeDropDataImporter', `Cloning ${this.repoPath}`);
        return new Promise((resolve, reject) => {
            tmp.dir({ unsafeCleanup: true }, (err, tmpDir) => {

                if (err) { reject(err); }

                git.Clone(this.repoPath, tmpDir)
                    .then(repo => {
                        this.repo = repo;
                        resolve(repo);
                    })
                    .catch(err => {
                        reject(err);
                    });

            });
        });
    }

    getPrimeDropDataFile() {
        let _repo = null;

        return new Promise((resolve, reject) => {

            this.getGitRepository()
                .then(repo => { _repo = repo; return repo; })
                .then(repo => repo.getMasterCommit())
                .then(commit => {
                    let commitId = commit.id().tostrS();
                    if (!this.data || commitId !== this.lastCommitId) {
                        this.lastCommitId = commitId;
                        log.debug('PrimeDropDataImporter', 'Processing data file at commit:', commitId);
                        commit.getEntry(DATA_FILE_PATH)
                            .then(entry => _repo.getBlob(entry.oid()))
                            .then(blob => {
                                this.data = processData(blob.toString());
                                resolve(this.data);
                            })
                            .catch(reject);
                    } else {
                        log.debug('PrimeDropDataImporter', 'No new commit, returning cached processed data');
                        resolve(this.data);
                    }
                })
                .catch(reject);

        });
    }
}

const primeDropDataImporter = new PrimeDropDataImporter();

export function getPrimeDropData() {
    return primeDropDataImporter.getPrimeDropDataFile();
}