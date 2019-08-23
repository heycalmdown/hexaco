const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const FACTORS = ['개방성', '성실성', '원만성', '외향성', '정서성', '정직-겸손성'];
const FLIP = [
    1, 0, 0, 0, 0, 0, 0, 0, 1, 1,
    0, 1, 0, 1, 1, 0, 0, 0, 1, 1,
    1, 0, 0, 1, 0, 1, 0, 1, 0, 1,
    1, 1, 0, 0, 1, 0, 0, 0, 0, 0,
    1, 1, 0, 1, 0, 1, 0, 1, 1, 0,
    0, 1, 1, 0, 1, 1, 1, 0, 1, 1
];

function flip(a, flag) {
    if (flag) {
        return 5 - a + 1;
    }
    return a;
}

async function ask(q) {
    const answer = parseInt(await new Promise(res => {
        rl.question(q + ' - ', res);
    }), 10);
    if (isNaN(answer) || answer < 1 || answer > 5) {
        console.log('1 - 5로 응답하세요');
        return ask(q);
    }
    return answer;
}

async function main() {
    const type = parseInt(process.argv[2], 10);
    if (!(type === 1 || type === 2)) {
        console.log('1. 자기 보고용  2. 타인 보고용');
        process.exit(0);
    }
    let text;
    if (type === 1) {
        console.log('자기 보고용 질문입니다')
        text = fs.readFileSync('../md/mine.md', 'utf-8');
    } else {
        console.log('타인 보고용 질문입니다')
        text = fs.readFileSync('../md/theirs.md', 'utf-8');
    }
    console.log('총 60개 문항이 있습니다. 각각 1 - 5 스케일로 대답하세요.');
    console.log('1 - 전혀 그렇지 않다 2 - 그렇지 않은 편이다 3 - 보통이다 4 - 그런 편이다 5 - 매우 그렇다')
    console.log('----');
    const questions = text.trim().split('\n');
    const answers = [];
    for (const q of questions) {
        const answer = parseInt(await ask(q), 10);
        answers.push(answer);
    }
    rl.close();
    const scores = answers.map((a, i) => flip(a, FLIP[i]));
    const factorScores = [0, 0, 0, 0, 0, 0];
    scores.forEach((score, i) => {
        factorScores[i % 6] += score;
    });
    console.log(factorScores);
    const factorDescriptions = factorScores.map(s => {
        if (s < 19) return '평균보다 매우 낮음';
        if (s < 27) return '평균보다 다소 낮음';
        if (s < 35) return '평균 정도';
        if (s < 43) return '평균보다 다소 높음';
        return '평균보다 매우 높음';
    });
    factorDescriptions.forEach((d, i) => {
        console.log(FACTORS[i], d);
    });
}

main();
