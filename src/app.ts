import Telegraf, { ContextMessageUpdate } from 'telegraf';
import * as TT from 'telegram-typings';
import * as s3 from './s3';

function makeButton(text: string, score: number): TT.InlineKeyboardButton {
  return { text, callback_data: score.toString() };
}

function makeKeyboard(keyboard: string[]) {
  return {
    reply_markup: {
      inline_keyboard: [
        keyboard.map((text, i) => ({ text, callback_data: (i + 1).toString() }))
      ]
    }
  };
}

function makeScoreButton(): { reply_markup: TT.InlineKeyboardMarkup } {
  return {
    reply_markup: {
      inline_keyboard: [
        [makeButton('전혀 그렇지 않다', 1), makeButton('그렇지 않은 편이다', 2)],
        [makeButton('보통이다', 3), makeButton('그런 편이다', 4)],
        [makeButton('매우 그렇다', 5), makeButton('...나중에...', 0)],
        [makeButton('취소', -1)]
      ]
    }
  };
}

async function reply(ctx: ContextMessageUpdate, text: string) {
  await bot.telegram.sendMessage(ctx.message!.from!.id, text);
}

async function requestNewStart(ctx: ContextMessageUpdate) {
  return ctx.reply('선택해주세요', makeKeyboard(['자기 보고용', '타인 보고용']))
}

function question(name: string, progress: s3.Progress): string {
  const type = progress.type === 1 && '자기 보고용' || '타인 보고용';
  const text = [
    `${name}님의 ${type} 테스트입니다.`,
    '',
    progress.getNextQuestion()
  ];
  return text.join('\n');
}

async function onStart(ctx: ContextMessageUpdate) {
  const previousProgress = await s3.getPreviousProgress(ctx.from!.id.toString());
  if (!previousProgress) return requestNewStart(ctx);

  const sender = ctx.from!;
  const name = `${sender.last_name} ${sender.first_name}(${sender.username})`;
  return ctx.reply(question(name, previousProgress), makeScoreButton());
}

async function xxx(ctx: ContextMessageUpdate, name: string, data: number, progress: s3.Progress | null) {
  console.log(ctx.callbackQuery);
  if (!progress) {
    if (data === 1 || data === 2) {
      const progress = new s3.Progress(ctx.from!.id.toString(), data, []);
      await progress.updateProgress();
      return ctx.editMessageText(question(name, progress), makeScoreButton());
    } else {
      return ctx.editMessageText('ㅇㅇ 다 없던 걸로 합니다\n다시 시작하려면 /start 입력하세요\n이것 저것 궁금하면 /help 하세요');
    }
  }

  if (1 <= data && data <= 5) {
    await progress.addAnswer(data);
    return ctx.editMessageText(question(name, progress), makeScoreButton());
  } else if (data === 0) {
    return ctx.editMessageText('ㅇㅇ 나중에 계속...\n다시 시작하려면 /start 입력하세요\n이것 저것 궁금하면 /help 하세요');
  }
  await progress.cancelProgress();
  return ctx.editMessageText('ㅇㅇ 다 없던 걸로 합니다\n다시 시작하려면 /start 입력하세요\n이것 저것 궁금하면 /help 하세요');
}

async function onMyCallback(ctx: ContextMessageUpdate) {
  const data = parseInt(ctx.callbackQuery!.data!, 10);
  const sender = ctx.callbackQuery!.message!.chat;
  const name = `${sender.last_name} ${sender.first_name}(${sender.username})`;
  const progress = await s3.getPreviousProgress(ctx.from!.id.toString());
  return xxx(ctx, name, data, progress);
}

async function onCompleted(ctx: ContextMessageUpdate, progress: s3.Progress) {
  const response = ['다 끝났슈'];
  const result = progress.complete() as any;
  for (const key in result) {
    response.push(`${key} - ${result[key]}`);
  }
  await ctx.reply(response.join('\n'), { reply_markup: { remove_keyboard: true }})
}

async function sendQuestion(ctx: ContextMessageUpdate, progress: s3.Progress) {
    const q = progress.getNextQuestion();
    if (!q) return onCompleted(ctx, progress);

    return ctx.reply(progress.getNextQuestion(), makeScoreButton());
}

function makeScoreHandler(score: number) {
  return async (ctx: ContextMessageUpdate) => {
    const progress = await s3.getPreviousProgress(ctx.from!.id.toString());
    if (!progress) return ctx.reply('선택해주세요', makeKeyboard(['자기 보고용', '타인 보고용']));

    await progress.addAnswer(score);
    await sendQuestion(ctx, progress);
  };
}

async function onCancel(ctx: ContextMessageUpdate) {
  const progress = new s3.Progress(ctx.from!.id.toString(), 1, []);
  await progress.cancelProgress();
  ctx.reply('ㅇㅇ 취소', { reply_markup: { remove_keyboard: true }})
}

async function onPause(ctx: ContextMessageUpdate) {
  ctx.reply('ㅇㅇ 나중에...', { reply_markup: { remove_keyboard: true }});
}

function onHelp(ctx: ContextMessageUpdate) {
  ctx.reply('/start - 시작\n/cancel - 진행중이던 내용 삭제');
}

const bot = new Telegraf(process.env.BOT_TOKEN!)
bot.start(onStart);
bot.help(onHelp);
bot.on('callback_query', onMyCallback);
bot.hears('전혀 그렇지 않다', makeScoreHandler(1));
bot.hears('그렇지 않은 편이다', makeScoreHandler(2));
bot.hears('보통이다', makeScoreHandler(3));
bot.hears('그런 편이다', makeScoreHandler(4));
bot.hears('매우 그렇다', makeScoreHandler(5));
bot.hears('...나중에...', onPause);
bot.command('cancel', onCancel);

if (process.env.WEBHOOK) {
  bot.telegram.setWebhook(process.env.WEBHOOK + 'secret-path')
}
bot.startWebhook('/secret-path', null, parseInt(process.env.PORT!, 10) || 3000)

bot.launch()
