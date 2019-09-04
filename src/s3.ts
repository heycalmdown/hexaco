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

export async function getPreviousProgress(owner: string): Promise<Progress | null> {
    try {
        const result = await s3.getObject({Bucket: 'hexaco-bot', Key: `v1/${owner}/progress.json`}).promise();
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
        await s3.putObject({Bucket: 'hexaco-bot', Key: `v1/${this.owner}/progress.json`, Body: body}).promise();
    }

    async cancelProgress() {
        await s3.deleteObject({Bucket: 'hexaco-bot', Key: `v1/${this.owner}/progress.json`}).promise();
    }

    complete() {
        const scores = this.answers.map((a, i) => flip(a, FLIP[i]));
        const factorScores = [0, 0, 0, 0, 0, 0];
        scores.forEach((score, i) => {
            factorScores[i % 6] += score;
        });
        const factorDescriptions = factorScores.map(s => {
            if (s < 19) return '평균보다 매우 낮음';
            if (s < 27) return '평균보다 다소 낮음';
            if (s < 35) return '평균 정도';
            if (s < 43) return '평균보다 다소 높음';
            return '평균보다 매우 높음';
        });
        return _.zipObject(FACTORS, factorDescriptions);
    }
}
