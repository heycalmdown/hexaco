import * as tt from 'telegraf/typings/telegram-types';

import { SCORE_STRINGS } from './strings';
import { COMMANDS } from './defs';

export function makeInlineKeyboard(keyboard: string[], command: COMMANDS): tt.ExtraEditMessage {
  return {
    reply_markup: {
      inline_keyboard: [
        keyboard.map((text, i) => ({ text, callback_data: [command, i + 1].map(String).join('|') }))
      ]
    }
  };
}

export function makeCallbackKeyboard(info: { text: string, data: any[] }[][]): tt.ExtraEditMessage {
  return {
    reply_markup: {
      inline_keyboard: info.map(row => {
        return row.map(col => {
          return {
            text: col.text,
            callback_data: col.data.map(String).join('|')
          };
        });
      })
    }
  }
}

export function makeScoreKeyboard(senderId: string, q: number): tt.ExtraEditMessage {
  return makeCallbackKeyboard([
    [
      { text: SCORE_STRINGS[0], data: [COMMANDS.QUESTION, senderId, q, 1] },
      { text: SCORE_STRINGS[1], data: [COMMANDS.QUESTION, senderId, q, 2] },
    ], [
      { text: SCORE_STRINGS[2], data: [COMMANDS.QUESTION, senderId, q, 3]},
      { text: SCORE_STRINGS[3], data: [COMMANDS.QUESTION, senderId, q, 4]},
    ], [
      { text: SCORE_STRINGS[4], data: [COMMANDS.QUESTION, senderId, q, 5] },
      { text: '(옵션 더보기)', data: [COMMANDS.QUESTION, senderId, q, 0] }
    ]
  ]);
}
