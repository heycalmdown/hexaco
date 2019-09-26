import { ContextMessageUpdate } from 'telegraf';
import _ from 'lodash';

import { MyContext } from './context';
import { TYPE_STRINGS, INTRODUCTION, DESCRIPTIONS } from './strings';
import { makeScoreKeyboard, makeInlineKeyboard, makeCallbackKeyboard } from './keyboard';
import { COMMANDS } from './defs';
import * as s3 from '../s3';

const DESCRIPTION_KEYBOARD = [
  [{ text: '정직-겸손성', data: [COMMANDS.DESCRIPTION, 0] }, { text: '정서성', data: [COMMANDS.DESCRIPTION, 1] }, { text: '외향성', data: [COMMANDS.DESCRIPTION, 2]}],
  [{ text: '원만성', data: [COMMANDS.DESCRIPTION, 3] }, { text: '성실성', data: [COMMANDS.DESCRIPTION, 4] }, { text: '경험 개방성', data: [COMMANDS.DESCRIPTION, 5]}],
  [{ text: '처음 본 사람을 평가할 수 있나요?', data: [COMMANDS.DESCRIPTION, 6]}],
  [{ text: '다른 사람 평가가 의미 있나요?', data: [COMMANDS.DESCRIPTION, 7]}],
  [{ text: '부부는 점점 닮아가나요?', data: [COMMANDS.DESCRIPTION, 8]}],
  [{ text: '어떤 사람과 친해질지 예측할 수 있나요?', data: [COMMANDS.DESCRIPTION, 9]}]
];

async function failback(ctx: MyContext) {
  return ctx.editMessageText('ㅇㅇ 다 없던 걸로 합니다\n다시 시작하려면 /start 입력하세요\n이것 저것 궁금하면 /help 하세요');
}

async function sendQuestion(ctx: MyContext, progress: s3.Progress) {
  const name = ctx.getSenderName();
  const nextQuestion = question(name, progress);
  if (!nextQuestion) {
    await progress.save();
    return finish(['테스트가 모두 끝났습니다', ''], ctx, progress);
  }

  const q = progress.answers.length + 1;
  return ctx.editMessageText(nextQuestion, makeScoreKeyboard(ctx.getSenderId(), q));
}

async function requestNewStart(ctx: MyContext) {
  const messages = [
    ...INTRODUCTION,
    '',
    '어떤 테스트를 진행할까요?'
  ]
  return ctx.reply(messages.join('\n'), makeInlineKeyboard(TYPE_STRINGS.slice(1), COMMANDS.TYPE))
}

function question(name: string, progress: s3.Progress): string | null {
  const q = progress.getNextQuestion();
  if (!q) return null;
  const type = TYPE_STRINGS[progress.type];
  const text = [
    `${name}님의 ${type} 테스트입니다. 아래 질문에 대해 5점 척도로 입력하세요.`,
    '',
    q
  ];
  return text.join('\n');
}

async function finish(response: string[], ctx: MyContext, progress: s3.Progress) {
  const result = progress.complete() as any;
  for (const key in result) {
    response.push(`${key} - ${result[key].description} (${result[key].score}/50)`);
  }

  response.push('');
  response.push('각 항목에 대해서는 /description 을 참조하세요');
  return ctx.editMessageText(response.join('\n'));
}

async function handleType(ctx: MyContext, type: number) {
  const progress = new s3.Progress(ctx.getSenderId(), type, []);
  await progress.updateProgress();
  return sendQuestion(ctx, progress);
}

async function handleStart(ctx: MyContext, yesno: number) {
  const progress = await s3.getPreviousProgress(ctx.getSenderId());
  if (!progress) return failback(ctx);

  if (yesno === 2) {
    await progress.cancelProgress();
    return ctx.editMessageText([
      '기존 자료를 삭제했습니다',
      '다시 시작하려면 /start 입력하세요',
      '이것 저것 궁금하면 /help 하세요'
    ].join('\n'));
  }

  return sendQuestion(ctx, progress);
}

async function handleHistory(ctx: MyContext, senderId: string, type: number) {
  if (await ctx.preventHijacking(senderId)) return;
  if (0 < type) {
    const filename = type === 1 && 'mine.json' || 'theirs.json';
    const history = await s3.getObject(senderId, filename);
    if (!history.Body) return failback(ctx);

    const answers = JSON.parse(history.Body.toString('utf-8'));
    const progress = new s3.Progress(senderId, type, answers);
    return finish([], ctx, progress);
  } else {
    await s3.deleteObject(senderId, type === -1 && 'mine.json' || 'theirs.json');
    return ctx.editMessageText('내가 남긴 보고를 삭제했습니다')
  }
}

async function handleDescription(ctx: MyContext, offset: number) {
  return ctx.editMessageText(DESCRIPTIONS[offset].join('\n'), makeCallbackKeyboard(DESCRIPTION_KEYBOARD));
}

async function handleMore(ctx: MyContext, senderId: string, type: number) {
  if (await ctx.preventHijacking(senderId)) return;

  const progress = await s3.getPreviousProgress(ctx.getSenderId());
  if (!progress) return failback(ctx);

  if (type === 1) {
    return handleStart(ctx, 1);
  } else if (type === 2) {
    return ctx.editMessageText('좀 길죠? 나중에 /start 해서 마저 진행할 수 있어요');
  } else if (type === 3) {
    await progress.cancelProgress();
    return failback(ctx);
  }
}

async function handleQuestion(ctx: MyContext, q: number, score: number, senderId: string) {
  if (await ctx.preventHijacking(senderId)) return;

  const progress = await s3.getPreviousProgress(ctx.getSenderId());
  if (!progress) return failback(ctx);

  const answers = progress.answers.length + 1;
  if (q < answers) return ctx.answerCbQuery('옛날 것이 한 번 더 들어옴');

  if (1 <= score && score <= 5) {
    await progress.addAnswer(score);
    return sendQuestion(ctx, progress);
  } else if (score === 0) {
    const message = question(ctx.getSenderName(), progress);
    return ctx.editMessageText(message || 'haha', makeCallbackKeyboard([
      [{ text: '계속하기', data: [COMMANDS.MORE, senderId, 1] }, { text: '나중에 마저 하기', data: [COMMANDS.MORE, senderId, 2] }],
      [{ text: '삭제하기', data: [COMMANDS.MORE, senderId, 3] }],
    ]));
  }
}

export async function onStart(_ctx: ContextMessageUpdate) {
  const ctx = new MyContext(_ctx);
  const previousProgress = await s3.getPreviousProgress(ctx.getSenderId());
  if (!previousProgress) return requestNewStart(ctx);

  const name = ctx.getSenderName();
  const type = TYPE_STRINGS[previousProgress.type];
  const q = previousProgress.answers.length;
  const text = `${q}번까지 진행된 ${name}님의 ${type} 테스트가 있습니다.`;
  return ctx.reply(text, makeInlineKeyboard(['계속합니다', '삭제합니다'], COMMANDS.START));
}

export async function onDescription(ctx: ContextMessageUpdate) {
  const myContext = new MyContext(ctx);
  return myContext.reply(INTRODUCTION.join('\n'), { ...makeCallbackKeyboard(DESCRIPTION_KEYBOARD),
                                                    disable_web_page_preview: true
                                                  });
}

export async function onHistory(ctx: ContextMessageUpdate) {
  const myContext = new MyContext(ctx);
  const owner = myContext.getSenderId();
  const [mine, theirs] = await Promise.all([
    s3.getObject(owner, 'mine.json'),
    s3.getObject(owner, 'theirs.json')
  ]);

  const buttons = [];
  if (mine.Body) {
    buttons.push([
      { text: '내가 남긴 자기 보고 보기', data: [COMMANDS.HISTORY, owner, 1]},
      { text: '자기 보고 삭제', data: [COMMANDS.HISTORY, owner, -1]}
    ]);
  }
  if (theirs.Body) {
    buttons.push([
      { text: '내가 남긴 타인 보고 보기', data: [COMMANDS.HISTORY, owner, 2]},
      { text: '타인 보고 삭제', data: [COMMANDS.HISTORY, owner, -2]}
    ]);
  }
  if (buttons.length === 0) {
    return myContext.reply('남겨진 기록이 없습니다');
  } else {
    return myContext.reply('남겨진 기록이 있습니다', makeCallbackKeyboard(buttons));
  }
}

export async function onCallback(ctx: ContextMessageUpdate) {
  const myContext = new MyContext(ctx);
  const data = ctx.callbackQuery!.data!.split('|');
  const command = +data[0];
  switch (command) {
    case COMMANDS.START: {
      const yesno = +data[1];
      return handleStart(myContext, yesno);
    }
    
    case COMMANDS.TYPE: {
      const type = +data[1];
      return handleType(myContext, type);
    }

    case COMMANDS.QUESTION: {
      const senderId = data[1];
      const q = +data[2];
      const score = +data[3];
      return handleQuestion(myContext, q, score, senderId);
    }

    case COMMANDS.MORE: {
      const senderId = data[1];
      const type = +data[2];
      return handleMore(myContext, senderId, type);
    }
    
    case COMMANDS.DESCRIPTION: {
      const type = +data[1];
      return handleDescription(myContext, type);
    }

    case COMMANDS.HISTORY: {
      const senderId = data[1];
      const type = +data[2];
      return handleHistory(myContext, senderId, type);
    }
    
    default:
      return failback(myContext);
  }
}

export function onHelp(ctx: ContextMessageUpdate) {
  const messages = [
    ...INTRODUCTION,
    '',
    '/start - 시작',
    '/help - 이 내용',
    '/history - 내가 남긴 지난 보고 확인',
    '/description - 설명 보기'
  ]
  return ctx.replyWithHTML(messages.join('\n'), {disable_web_page_preview: true});
}
