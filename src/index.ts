import readline from 'readline';
import * as s3 from './s3';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function ask(q: string): Promise<number> {
    const answer = parseInt(await new Promise(res => {
        rl.question(q + ' - ', res);
    }), 10);
    if (isNaN(answer) || answer < 0 || answer > 5) {
        console.log('1 - 5로 응답하세요');
        return ask(q);
    }
    return answer;
}


async function main() {
    const owner = 'hey';

    const type = parseInt(process.argv[2], 10);
    if (!(type === 1 || type === 2)) {
        console.log('1. 자기 보고용  2. 타인 보고용');
        process.exit(0);
    }
    const progress = (await s3.getPreviousProgress(owner)) || new s3.Progress(owner, type, []);
    if (type === 1) {
        console.log('자기 보고용 질문입니다')
    } else {
        console.log('타인 보고용 질문입니다')
    }
    console.log('총 60개 문항이 있습니다. 각각 1 - 5 스케일로 대답하세요.');
    console.log('0 - 취소 1 - 전혀 그렇지 않다 2 - 그렇지 않은 편이다 3 - 보통이다 4 - 그런 편이다 5 - 매우 그렇다')
    console.log('----');

    let q;
    while (q = progress.getNextQuestion()) {
        const answer = await ask(q);
        if (answer === 0) {
            console.log('진행 과정을 삭제할게요');
            await progress.cancelProgress();
            process.exit(0);
        }
        progress.addAnswer(answer);
    }
    rl.close();
    const result = progress.complete();
    for (const key in result) {
        console.log(key, result[key]);
    }
}

main();
