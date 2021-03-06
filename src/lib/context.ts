import { ContextMessageUpdate } from 'telegraf';
import * as tt from 'telegraf/typings/telegram-types';

export class MyContext {
  constructor(private ctx: ContextMessageUpdate) {
  }

  getSenderId() {
    return this.ctx.from!.id.toString();
  }

  getSenderName() {
    const sender = this.ctx.callbackQuery && this.ctx.callbackQuery.from || this.ctx.from;
    if (!sender) return '아무개씨';
    return [sender.first_name, sender.last_name].filter(Boolean).join(' ');
  }

  async reply(text: string, extra?: tt.ExtraEditMessage) {
    try {
      return await this.ctx.replyWithHTML(text, extra);
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

  async preventHijacking(senderId: string) {
    if (senderId !== this.getSenderId()) {
      await this.answerCbQuery('남의 것 누르지 마세요');
      return true;
    }
    return false;
  }

  async editMessageText(text: string, extra?: tt.ExtraEditMessage) {
    try {
      return await this.ctx.editMessageText(text, {...extra, parse_mode: 'Markdown'});
    } catch (e) {
      return false;
    }
  }
}