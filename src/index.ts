import { prisma } from './db/client.js';
import { bot } from './bot.js';

async function main() {
  await prisma.$connect();
  console.log('✅ Database connected');

  console.log('🤖 Starting Dotis...');
  await bot.start({
    onStart: (botInfo) => {
      console.log(`✅ Bot @${botInfo.username} started`);
    },
  });
}

main().catch((err) => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
