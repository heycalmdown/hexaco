import Telegraf from 'telegraf';
import { onStart, onCancel, onHelp, onCallback } from './lib/handlers';

async function main() {
  const bot = new Telegraf(process.env.BOT_TOKEN!)
  bot.start(onStart);
  bot.command('cancel', onCancel);
  bot.help(onHelp);
  bot.on('callback_query', onCallback);

  await bot.launch({
    webhook: {
      domain: process.env.WEBHOOK,
      hookPath: '/secret-path',
      port: parseInt(process.env.PORT!, 10)
    }
  } as any);
}

main();
