import Parser from "./io/Parser.js"
import Logger from './io/Logger.js'
import Writer from './io/Writer.js'
import process from 'node:process'
import Runner from './analysis/Runner.js'
import TokenManager from './api/TokenManager.js'

async function main() {
  const parser = new Parser()
  const tasks = parser.parseArgs(process.argv)
  const batch_config = parser.getBatchConfig()

  const logger = new Logger(batch_config)
  logger.log(`debug`, `Raw argv: ${JSON.stringify(process.argv.slice(2))}`)
  logger.log('debug', `Batch config: ${JSON.stringify(batch_config)}; tasks: ${tasks.length}`);
  const tokenManager = new TokenManager(logger);
  await tokenManager.init();
  const writer = new Writer(logger, batch_config)
  const runner = new Runner(logger, writer, tokenManager, batch_config)
  let i = 0;
  for (const task of tasks) {
    i++;
    logger.log(
      'debug',
      `Starting task ${i}/${tasks.length}`
    );
    await runner.run(task)
  }
  runner.end()
}

await main()

