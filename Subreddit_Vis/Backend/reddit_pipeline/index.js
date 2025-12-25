import Parser from "./io/Parser.js"
import RedditAPIManager from './api/RedditAPIManager.js'
import Logger from './io/Logger.js'
import Writer from './io/Writer.js'
import process from 'node:process'
import Runner from './analysis/Runner.js'


async function main() {
  const parser = new Parser()
  const tasks = parser.parseArgs(process.argv)
  const batch_config = parser.getBatchConfig()

  const logger = new Logger(batch_config)
  const writer = new Writer(batch_config)
  const runner = new Runner(logger, writer, batch_config)
  for (const task of tasks) {
    await runner.run(task)
  }
  runner.end()
}

await main()

