const AWS = require('aws-sdk');
const s3 = require('./s3');

AWS.config.loadFromPath(__dirname + '/../config/awsconfig.json');

// const s3 = new AWS.S3();

async function main() {
    // const objects = await s3.listObjects({Bucket: 'hexaco-bot'}).promise();
    // console.log(objects);
    // const result = await s3.getObject({Bucket: 'hexaco-bot', Key: 'v1/hey/result.json'}).promise();
    // console.log(result.Body.toString('utf-8'));

    const progress = await s3.getPreviousProgress();
    console.log(progress);
}

main();
