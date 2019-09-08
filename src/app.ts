import Telegraf, { ContextMessageUpdate } from 'telegraf';
import * as TT from 'telegram-typings';
import * as tt from 'telegraf/typings/telegram-types';
import * as s3 from './s3';

enum COMMANDS {
  TYPE,
  QUESTION,
  START
};

function makeInlineKeyboard(keyboard: string[], command: COMMANDS) {
  return {
    reply_markup: {
      inline_keyboard: [
        keyboard.map((text, i) => ({ text, callback_data: [command, i + 1].map(String).join('|') }))
      ]
    }
  };
}

function makeKeyboard(keyboard: string[]) {
  return {
    reply_markup: {
      inline_keyboard: [
        keyboard.map((text, i) => ({ text, callback_data: [COMMANDS.TYPE, i + 1].map(String).join('|') }))
      ]
    }
  };
}

const SCORE_STRINGS = [
  '전혀 그렇지 않다',
  '그렇지 않은 편이다',
  '보통이다',
  '그런 편이다',
  '매우 그렇다'
];

function makeCallbackData(text: string, senderId: string, q: number, score: number) {
  return {
    text,
    callback_data: [COMMANDS.QUESTION, senderId, q, score].map(String).join('|')
  };
}

function makeScoreButton(senderId: string, q: number): { reply_markup: TT.InlineKeyboardMarkup } {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          makeCallbackData(SCORE_STRINGS[0], senderId, q, 1),
          makeCallbackData(SCORE_STRINGS[1], senderId, q, 2),
        ], [
          makeCallbackData(SCORE_STRINGS[2], senderId, q, 3),
          makeCallbackData(SCORE_STRINGS[3], senderId, q, 4),
        ], [
          makeCallbackData(SCORE_STRINGS[4], senderId, q, 5),
          makeCallbackData('...나중에...', senderId, q, 0),
        ], [
          makeCallbackData('취소', senderId, q, -1)
        ]
      ]
    }
  };
}

async function requestNewStart(ctx: MyContext) {
  return ctx.reply('어떤 테스트를 진행할까요?', makeKeyboard(['자기 보고용', '타인 보고용']))
}

const TYPE_STRINGS = [
  'EMPTY',
  '자기 보고용',
  '타인 보고용'
];

function question(name: string, progress: s3.Progress): string | null {
  const q = progress.getNextQuestion();
  if (!q) return null;
  const type = progress.type === 1 && '자기 보고용' || '타인 보고용';
  const text = [
    `${name}님의 ${type} 테스트입니다.`,
    '',
    q
  ];
  return text.join('\n');
}

async function onStart(_ctx: ContextMessageUpdate) {
  const ctx = new MyContext(_ctx);
  const previousProgress = await s3.getPreviousProgress(ctx.getSenderId());
  if (!previousProgress) return requestNewStart(ctx);

  const name = ctx.getSenderName();
  const type = TYPE_STRINGS[previousProgress.type];
  const q = previousProgress.answers.length;
  const text = `${q}번까지 진행된 ${name}님의 ${type} 테스트가 있습니다.`;
  return ctx.reply(text, makeInlineKeyboard(['계속 합니다', '그만 합니다'], COMMANDS.START));
}

async function onTypeCallback(ctx: MyContext, type: number) {
  const progress = new s3.Progress(ctx.getSenderId(), type, []);
  await progress.updateProgress();
  return sendQuestion(ctx, progress);
}

async function failback(ctx: MyContext) {
  // await ctx.answerCbQuery('failback');
  return ctx.editMessageText('ㅇㅇ 다 없던 걸로 합니다\n다시 시작하려면 /start 입력하세요\n이것 저것 궁금하면 /help 하세요');
}

async function sendQuestion(ctx: MyContext, progress: s3.Progress) {
  const name = ctx.getSenderName();
  const nextQuestion = question(name, progress);
  if (!nextQuestion) return onCompleted(ctx, progress);

  const q = progress.answers.length + 1;
  return ctx.editMessageText(nextQuestion, makeScoreButton(ctx.getSenderId(), q));
}

async function onQuestionCallback(ctx: MyContext, q: number, score: number, senderId: string) {
  if (senderId !== ctx.getSenderId()) return ctx.answerCbQuery('남의 것 누르지 마세요');

  const progress = await s3.getPreviousProgress(ctx.getSenderId());
  if (!progress) return failback(ctx);

  const answers = progress.answers.length + 1;
  if (q < answers) return ctx.answerCbQuery('옛날 것이 한 번 더 들어옴');

  if (1 <= score && score <= 5) {
    await progress.addAnswer(score);
    // await ctx.answerCbQuery();
    return sendQuestion(ctx, progress);
  } else if (score === 0) {
    // await ctx.answerCbQuery('ㅇㅇ');
    return ctx.editMessageText('ㅇㅇ 나중에 계속...\n다시 시작하려면 /start 입력하세요\n이것 저것 궁금하면 /help 하세요');
  }
  await progress.cancelProgress();
  return failback(ctx);
}

class MyContext {
  constructor(private ctx: ContextMessageUpdate) {
  }

  getSenderId() {
    return this.ctx.from!.id.toString();
  }

  getSenderName() {
    const sender = this.ctx.callbackQuery && this.ctx.callbackQuery.from || this.ctx.from;
    if (!sender) return '아무개씨';
    return `${sender.first_name} ${sender.last_name}`;
  }

  async reply(text: string, extra?: tt.ExtraReplyMessage) {
    try {
      return await this.ctx.reply(text, extra);
    } catch (e) {
      return false;
    }
  }

  async answerCbQuery(text?: string) {
    try {
      return await this.ctx.answerCbQuery(text);
    } catch (e) {
      return false;
    }
  }

  async editMessageText(text: string, extra?: tt.ExtraEditMessage) {
    try {
      return await this.ctx.editMessageText(text, extra);
    } catch (e) {
      return false;
    }
  }
}

async function onStartCallback(ctx: MyContext, yesno: number) {
  if (yesno === 2) {
    // await ctx.answerCbQuery('ㅇㅇ');
    return ctx.editMessageText('ㅇㅇ 나중에 계속...\n다시 시작하려면 /start 입력하세요\n이것 저것 궁금하면 /help 하세요');
  }
  const progress = await s3.getPreviousProgress(ctx.getSenderId());
  if (!progress) return failback(ctx);
  sendQuestion(ctx, progress);
}

async function onCallback(ctx: ContextMessageUpdate) {
  const myContext = new MyContext(ctx);
  const data = ctx.callbackQuery!.data!.split('|');
  const command = +data[0];
  switch (command) {
    case COMMANDS.START: {
      const yesno = +data[1];
      return onStartCallback(myContext, yesno);
    }
    
    case COMMANDS.TYPE: {
      const type = +data[1];
      return onTypeCallback(myContext, type);
    }

    case COMMANDS.QUESTION: {
      const senderId = data[1];
      const q = +data[2];
      const score = +data[3];
      return onQuestionCallback(myContext, q, score, senderId);
    }
    
    default:
      return failback(myContext);
  }
}

async function onCompleted(ctx: MyContext, progress: s3.Progress) {
  const response = ['다 끝났슈'];
  const result = progress.complete() as any;
  for (const key in result) {
    response.push(`${key} - ${result[key].description} (${result[key].score}/50)`);
  }
  return ctx.editMessageText(response.join('\n'));
}

async function onCancel(ctx: ContextMessageUpdate) {
  const progress = new s3.Progress(ctx.from!.id.toString(), 1, []);
  await progress.cancelProgress();
  ctx.reply('ㅇㅇ 취소', { reply_markup: { remove_keyboard: true }})
}

function onHelp(ctx: ContextMessageUpdate) {
  const messages = [
    '/start - 시작',
    '/cancel - 진행중이던 내용 삭제'
  ]
  ctx.reply(messages.join('\n'));
}

async function main() {
  const bot = new Telegraf(process.env.BOT_TOKEN!)
  bot.start(onStart);
  bot.command('cancel', onCancel);
  bot.help(onHelp);
  bot.on('callback_query', onCallback);

  bot.startWebhook('/secret-path', null, parseInt(process.env.PORT!, 10) || 3000)

  await bot.launch()

  if (process.env.WEBHOOK) {
    await bot.telegram.setWebhook(process.env.WEBHOOK + 'secret-path')
  }
}

main();
