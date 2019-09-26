import fs from 'fs';
import * as _ from 'lodash';
import AWS from 'aws-sdk';
AWS.config.loadFromPath(__dirname + '/../config/awsconfig.json');

const s3 = new AWS.S3();

const MINE = fs.readFileSync(__dirname + '/../md/mine.md', 'utf-8').trim().split('\n');
const THEIRS = fs.readFileSync(__dirname + '/../md/theirs.md', 'utf-8').trim().split('\n');

const FACTORS = ['개방성', '성실성', '원만성', '외향성', '정서성', '정직-겸손성'];
const FLIP = [
    1, 0, 0, 0, 0, 0, 0, 0, 1, 1,
    0, 1, 0, 1, 1, 0, 0, 0, 1, 1,
    1, 0, 0, 1, 0, 1, 0, 1, 0, 1,
    1, 1, 0, 0, 1, 0, 0, 0, 0, 0,
    1, 1, 0, 1, 0, 1, 0, 1, 1, 0,
    0, 1, 1, 0, 1, 1, 1, 0, 1, 1
];

function flip(a: number, flag: number) {
    if (flag) {
        return 5 - a + 1;
    }
    return a;
}

export async function getObject(owner: string, filename: string) {
    try {
        return await s3.getObject({Bucket: 'hexaco-bot', Key: `v1/${owner}/${filename}`}).promise();
    } catch (e) {
        if (e.code === 'NoSuchKey') return { Body: null };
        throw e;
    }
}

export async function deleteObject(owner: string, filename: string) {
    return s3.deleteObject({
        Bucket: 'hexaco-bot',
        Key: `v1/${owner}/${filename}`
    }).promise();
}

export async function getPreviousProgress(owner: string): Promise<Progress | null> {
    try {
        const result = await getObject(owner, 'progress.json');
        const text = result.Body!.toString('utf-8');
        const body = JSON.parse(text);

        return new Progress(owner, body.type, body.answers);
    } catch (e) {
    }
    return null;
}

export class Progress {
    constructor(public owner: string, public type: number, public answers: number[]) {
    }

    getNextQuestion() {
        return (this.type === 1 && MINE || THEIRS)[this.answers.length];
    }

    async addAnswer(answer: number) {
        this.answers.push(answer);
        return this.updateProgress();
    }

    async updateProgress() {
        const body = JSON.stringify({type: this.type, answers: this.answers});
        await s3.putObject({
            Bucket: 'hexaco-bot',
            Key: `v1/${this.owner}/progress.json`,
            Body: body
        }).promise();
    }

    async cancelProgress() {
        await s3.deleteObject({
            Bucket: 'hexaco-bot',
            Key: `v1/${this.owner}/progress.json`
        }).promise();
    }

    async saveHistory() {
        const as = this.type === 1 && 'mine' || 'theirs';
        const body = JSON.stringify(this.answers);
        await s3.putObject({
            Bucket: 'hexaco-bot',
            Key: `v1/${this.owner}/${as}.json`,
            Body: body
        }).promise();
    }

    async save() {
        if (this.answers.length !== 60) return;
        await this.saveHistory();
        await this.cancelProgress();
    }

    complete() {
        const scores = this.answers.map((a, i) => flip(a, FLIP[i]));
        const factorScores = [0, 0, 0, 0, 0, 0];
        scores.forEach((score, i) => {
            factorScores[i % 6] += score;
        });
        const factorDescriptions = factorScores.map(s => {
            if (s < 19) return { description: '평균보다 매우 낮음', score: s };
            if (s < 27) return { description: '평균보다 다소 낮음', score: s };
            if (s < 35) return { description: '평균 정도', score: s };
            if (s < 43) return { description: '평균보다 다소 높음', score: s };
            return { description: '평균보다 매우 높음', score: s };
        });
        return _.zipObject(FACTORS, factorDescriptions);
    }
}
