import Telegraf from 'telegraf';
import { onStart, onDescription, onHelp, onCallback } from './lib/handlers';

async function main() {
  const bot = new Telegraf(process.env.BOT_TOKEN!)
  bot.start(onStart);
  bot.command('description', onDescription);
  bot.help(onHelp);
  bot.on('callback_query', onCallback);

  await bot.launch({
    webhook: {
      hookPath: '/secret-path',
      port: parseInt(process.env.PORT!, 10)
    }
  } as any);
}

main();
