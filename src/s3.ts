import AWS from 'aws-sdk';
AWS.config.loadFromPath(__dirname + '/../config/awsconfig.json');

const s3 = new AWS.S3();

 export async function getPreviousProgress(owner: string): Promise<{type: number, answers: number[]}> {
    try {
        const result = await s3.getObject({Bucket: 'hexaco-bot', Key: `v1/${owner}/progress.json`}).promise();
        const body = result.Body!.toString('utf-8');
        return JSON.parse(body);
    } catch (e) {
        if (e.code !== 'NoSuchKey') {
            throw e;
        }
    }
    return { type: 1, answers: [] };
}

export async function updateProgress(owner: string, type: number, answers: number[]) {
    const body = JSON.stringify({type, answers});
    await s3.putObject({Bucket: 'hexaco-bot', Key: `v1/${owner}/progress.json`, Body: body}).promise();
}

export async function cancelProgress(owner: string) {
    await s3.deleteObject({Bucket: 'hexaco-bot', Key: `v1/${owner}/progress.json`}).promise();
}