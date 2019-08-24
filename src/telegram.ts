import Telegraf, { ContextMessageUpdate } from 'telegraf';
import * as _ from 'lodash';
import * as TT from 'telegram-typings';
import * as s3 from './s3';

const ANSWER = [
  '전혀 그렇지 않다',
  '그렇지 않은 편이다',
  '보통이다',
  '그런 편이다',
  '매우 그렇다'
];

function makeButtons(text: string) {
  return [{ text }];
}

function makeButton(text: string) {
  return { text };
}

function makeKeyboard(keyboard: string[]) {
  return {
    reply_markup: {
      keyboard: [
        keyboard.map(text => ({ text }))
      ],
      one_time_keyboard: true
    }
  };
}

function makeScoreButton(): { reply_markup: TT.ReplyKeyboardMarkup } {
  return {
    reply_markup: {
      keyboard: [
        ['전혀 그렇지 않다', '그렇지 않은 편이다'].map(makeButton),
        ['보통이다', '그런 편이다'].map(makeButton),
        ['매우 그렇다', '...나중에...'].map(makeButton)
      ],
      resize_keyboard: true
    }
  };
}

async function onStart(ctx: ContextMessageUpdate) {
  const previousProgress = await s3.getPreviousProgress(ctx.from!.id.toString());
  if (!previousProgress) return ctx.reply('선택해주세요', makeKeyboard(['자기 보고용', '타인 보고용']));

  const type = previousProgress.type === 1 && '자기 보고용' || '타인 보고용';
  await ctx.reply('진행하던 내용이 있네요 - ' + type);
  await ctx.reply(previousProgress.answers.length + '번까지 진행했습니다');
  await sendQuestion(ctx, previousProgress);
}

async function onMy(ctx: ContextMessageUpdate) {
  const progress = new s3.Progress(ctx.from!.id.toString(), 1, []);
  await progress.updateProgress();
  return ctx.reply(progress.getNextQuestion(), makeScoreButton());
}

async function onTheirs(ctx: ContextMessageUpdate) {
  const progress = new s3.Progress(ctx.from!.id.toString(), 2, []);
  await progress.updateProgress();
  return ctx.reply(progress.getNextQuestion(), makeScoreButton());
}

async function onCompleted(ctx: ContextMessageUpdate, progress: s3.Progress) {
  await ctx.reply('다 끝났슈', { reply_markup: { remove_keyboard: true }})
  const result = progress.complete() as any;
  for (const key in result) {
    await ctx.reply(`${key} - ${result[key]}`);
  }
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

    progress.addAnswer(score);
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
bot.hears('자기 보고용', onMy);
bot.hears('타인 보고용', onTheirs);
bot.hears('전혀 그렇지 않다', makeScoreHandler(1));
bot.hears('그렇지 않은 편이다', makeScoreHandler(2));
bot.hears('보통이다', makeScoreHandler(3));
bot.hears('그런 편이다', makeScoreHandler(4));
bot.hears('매우 그렇다', makeScoreHandler(5));
bot.hears('...나중에...', onPause);
bot.command('cancel', onCancel);
bot.launch()
