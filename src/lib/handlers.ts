import { ContextMessageUpdate } from 'telegraf';
import * as TT from 'telegram-typings';
import _ from 'lodash';

import { MyContext } from './context';
import * as s3 from '../s3';

const SCORE_STRINGS = [
  '전혀 그렇지 않다',
  '그렇지 않은 편이다',
  '보통이다',
  '그런 편이다',
  '매우 그렇다'
];

const TYPE_STRINGS = [
  'EMPTY',
  '자기 보고용',
  '타인 보고용'
];

enum COMMANDS {
  TYPE,
  QUESTION,
  START
};

const INTRODUCTION = [
  '책 <a href="http://www.yes24.com/Product/Goods/9261020">H팩터의 심리학</a>에 소개된 HEXACO 성격 요인을 테스트 하는 봇입니다.',
  '',
  'H - 정직-겸손성(Honesty-Humility)',
  'E - 정서성(Emotionality)',
  'X - 외향성(eXtraversion)',
  'A - 원만성(Agreeableness)',
  'C - 성실성(Conscientiousness)',
  'O - 경험 개방성(Openness to Experience)',
];

const DESCRIPTIONS = [
  [
    '개방성, 성실성, 외향성의 경우 각 차원에서 점수가 높은 사람들이 여러 분야에서 더 왕성한 활동을 보입니다.',
    '정직성, 원만성, 정서성의 요인의 한쪽 끝은 남을 배려하는 친화적이고 이타적인 성향을 보이고, 다른 한쪽은 남과 대립하는 성향을 보입니다.'
  ],
  [ '개방성이 높은 사람은 예술과 자연에 대한 감흥에 쉽게 빠져들고 인간과 자연 세계를 더 잘 이해하고 싶어 하는 열망이 강합니다. 개방성이 높은 활동을 할 때 생기는 문제는 물리적 위험이 수반된다는 점입니다. 또 끊임없이 생각하고 지적으로 몰두해 있으면 뇌는 더 많은 포도당을 소비합니다.' ],
  [ '성실성이 높은 사람은 시간 관리에 뛰어나고, 정리 정돈에 능하며, 일을 열심히 아주 오래 합니다. 이들은 재정적으로 더 견실하고 더 오래 살며 신체적으로 더 건강한 상태를 보인다고 알려져 있습니다. 성실성이 높은 데 필요한 에너지 비용은 개방성 요인에서 언급했던 비용보다 더 큽니다. 성실성의 주요 특징 중 하나인 계획을 세우거나 충동을 억제하는 활동도 뇌에 많은 에너지를 부과합니다.' ],
  [ '외향성이 높은 사람은 다른 사람이 자신을 좋아한다고 가정합니다. 이들은 다른 사람을 이끌어나가고 자신의 주장을 펼치는 것을 아주 좋아합니다. 이들이 사회적 관심을 획득해가려 할 때 또 다른 외향적인 사람과 경쟁해야 하며 이는 때때로 적대적을로 전개되기도 합니다. 이런 적대적인 경쟁은 신체적 위해나 사회적 왕따를 초래할 수도 있습니다.' ],
  [ '정직성이 높은 사람은 타인을 이용하거나 착취하지 않습니다. 남보다 더 많이 차지하려는 탐욕이 적어서 무언가를 이루기 위해 타인을 이용할 동기가 애초부터 크지 않습니다. 도덕적 양심으로 인해 개인적인 이득을 볼 기회를 많이 놓칩니다.' ],
  [ '원만성이 높은 사람은 타인이 완전히 호의적이거나 협력적이지 않아도 그 사람을 배척하지 않고 여전히 그에게 협동할 의향을 보입니다. 이러한 관용이 애초에 악의를 가진 사람들에게 적용될 때 지속적 착취 대상이 될 수 있습니다. ' ],
  [ '정서성은 자신과 가족의 생존 가능성을 높여주는 특성으로 이루어져 있습니다. 정서성이 높은 사람은 신체적 위험에 처하는 것에 무서움을 많이 느끼고 그 상황을 회피하려 합니다. 어떤 환경에서는 위험한 일을 감수해야만 자신이나 가족에게 보상을 줄 수 있는데, 이런 일을 지나치게 삼가면 그런 보상의 기회를 계속 놓치게 됩니다.' ],
  [ '정직-겸손성 - 진실한, 정직한, 충실한, 충성적인, 겸손한, 가식적이지 않은, 공정한, 윤리적인 vs 교활한, 가식적인, 탐욕스러운, 젠체하는, 위선적인, 자랑하는, 자만심이 센, 자기중심적인' ],
  [ '정서성 - 감정적인, 여린, 센티멘털한, 겁이 많은, 걱정이 많은, 불안한, 의존적인, 상처받기 쉬운 vs 터프한, 겁 없는, 감정이 없는, 독립적인, 강인한, 용감한' ],
  [ '외향성 - 활동적인, 쾌활한, 외향적인, 사회적인, 수다스러운, 명랑한, 적극적인, 자신감이 있는 vs 수줍은, 수동적인, 나서지 않는, 내성적인, 조용한, 말수가 적은, 침울한' ], 
  [ '원만성 - 참을성이 많은, 용인하는, 평화스러운, 온화한, 원만한, 관대한, 신사적인, 용서하는 vs 성마른, 싸움 좋아하는, 완고한, 화 잘 내는, 성질 있는, 고집 센, 퉁명스러운' ], 
  [ '성실성 - 치밀한, 자기 규율적인, 부지런한, 효율적인, 신중한, 철저한, 정확한, 완벽주의적인 vs 대충대충 하는, 소홀한, 무모한, 게으른, 책임감이 없는, 잘 잊어버리는, 지저분한' ], 
  [ '개방성 - 지성적인, 창조적인, 비관습적인, 상상력이 풍부한, 혁신적인, 복잡한, 깊은, 탐구심이 풍부한, 철학적인 vs 깊이가 없는 단순한, 상상력이 부족한, 관습적인, 폐쇄적인' ],
  [ '연구 결과에 따르면 우리는 처음 만난 사람의 외향성에 대해서는 적어도 꽤 정확하게 판단할 수 있습니다. 상대방을 잘 모른다고 느끼는 쌍도 외향성이나 정서성에 대해서는 상당히 정확하게 판단하고 있었습니다. 그다지 잘 알지 못하는 사람, 즉 조금 먼 관계에 있는 사회 친구나 직장 동료라도 그들의 성격에 대해 그런대로 잘 판단할 수 있습니다. 그런데 정직성은 좀 다릅니다. 정직성을 정확히 판단하려면 그 사람을 상당히 잘 알아야 합니다.'],
  [
    '연구 결과는 연구 참여자들이 자신과 친숙한 사람이 지닌 HEXACO 성격 요인을 상당히 정확히 판단하고 있었습니다. 자기 보고와 타인 보고의 일치도는 상관계수로 0.5 정도에 이르는 수준이었습니다. 이것은 꽤 높은 수준의 일치도를 나타내는 것입니다.',
    '다만 일치도 계수와 그 친구들이 알아왔던 시간에는 관련성이 거의 없었습니다. 1년 정도만 알았던 쌍이나 10년 넘게 알아왔던 쌍이나 자기 보고-타인 보고 일치도에는 거의 차이가 없었습니다. 다른 사람의 정직성을 정확히 알아내는 데 1년이면 충분합니다.'
  ],
  ['우리는 친숙한 사람들의 성격을 꽤 정확하게 판단할 수 있습니다. 그리고 우리는 그다지 잘 알지 못하는 사람, 즉 조금 먼 관계에 있는 사회 친구나 직장 동료라도 그들의 성격에 대해 그런대로 잘 판단할 수 있습니다. 그런데 정직성은 좀 다릅니다. 정직성을 정확히 판단하려면 그 사람을 상당히 잘 알아야 합니다.'],
  ['부부가 지닌 신념의 유사성은 연구 첫해에 측정했을 때나 17년 후에 측정했을 때나 차이가 거의 없었습니다. 결혼 생활을 통해 부부의 의견이 점점 수렴해갈 것이라는 가설은 지지되지 않았지요. 이 연구 결과는 비슷비슷한 신념을 가진 사람들이 애초에 부부로 만나게 되고, 부부가 정치적, 종교적 태도에서 유사성을 보이는 가장 중요한 이유라는 것을 나타냅니다.'],
  ['신체적 매력도처럼 모든 사람이 완전히 동의하는 "더 좋은" 방향이 없는 특성들은 어떤 방향이든 자신의 특성과 비슷할수록 선호하게 됩니다.'],
  ['두 친구의 성격 유사성을 나타내주는 상관성을 조사해봤습니다. 정직성과 개방성에서 아주 일관되게 정적 상관이 나왔습니다. 그러나 나머지 4가지 요인에서는 상관이 거의 0에 가깝게 나왔습니다. 친구들의 성격은 정직성과 개방성에서 비슷한 편이고, 자기 자신들은 이 유사성을 더 과장해서 지각하는 경향이 있습니다. 사람의 가치관은 그들이 지닌 정직성과 개방성의 점수에 상당히 큰 영향을 받습니다. 가치관이 서로 유사한 사람들끼리 친구가 될 가능성이 더 높습니다.']
];

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
  const messages = [
    ...INTRODUCTION,
    '',
    '어떤 테스트를 진행할까요?'
  ]
  return ctx.reply(messages.join('\n'), makeKeyboard(['자기 보고용', '타인 보고용']))
}

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

export async function onCancel(ctx: ContextMessageUpdate) {
  const progress = new s3.Progress(ctx.from!.id.toString(), 1, []);
  await progress.cancelProgress();
  ctx.reply('ㅇㅇ 취소', { reply_markup: { remove_keyboard: true }})
}

async function onCompleted(ctx: MyContext, progress: s3.Progress) {
  const response = ['다 끝났슈'];
  const result = progress.complete() as any;
  for (const key in result) {
    response.push(`${key} - ${result[key].description} (${result[key].score}/50)`);
  }
  return ctx.editMessageText(response.join('\n'));
}

export function onHelp(ctx: ContextMessageUpdate) {
  const messages = [
    ...INTRODUCTION,
    '',
    '아래는 랜덤하게 뽑은 HEAXCO에 대한 설명입니다',
    '',
    ..._.sample(DESCRIPTIONS) as string[],
    '',
    '/start - 시작',
    '/cancel - 진행중이던 내용 삭제',
  ]
  return ctx.replyWithHTML(messages.join('\n'), {disable_web_page_preview: true});
}

export async function onStart(_ctx: ContextMessageUpdate) {
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

async function onStartCallback(ctx: MyContext, yesno: number) {
  if (yesno === 2) {
    // await ctx.answerCbQuery('ㅇㅇ');
    return ctx.editMessageText('ㅇㅇ 나중에 계속...\n다시 시작하려면 /start 입력하세요\n이것 저것 궁금하면 /help 하세요');
  }
  const progress = await s3.getPreviousProgress(ctx.getSenderId());
  if (!progress) return failback(ctx);
  sendQuestion(ctx, progress);
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

export async function onCallback(ctx: ContextMessageUpdate) {
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