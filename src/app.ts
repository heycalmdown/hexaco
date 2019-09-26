import Telegraf from 'telegraf';
import { onStart, onDescription, onHelp, onHistory, onCallback } from './lib/handlers';

const CONFIGS: any = {};
CONFIGS['beta'] = {
  token_env: 'BETA_TOKEN',
  launch_opts: {}
};
CONFIGS['bot'] = {
  token_env: 'BOT_TOKEN',
  launch_opts: {
    webhook: {
      hookPath: '/secret-path',
      port: parseInt(process.env.PORT!, 10)
    }
  }
};

const CONFIG = CONFIGS[process.env.CONFIG || 'beta'];

async function main() {
  const TOKEN = process.env[CONFIG.token_env]!;
  const bot = new Telegraf(TOKEN);
  bot.start(onStart);
  bot.command('description', onDescription);
  bot.command('history', onHistory);
  bot.help(onHelp);
  bot.on('callback_query', onCallback);

  await bot.launch(CONFIG.launch_opts as any);
}

main();
