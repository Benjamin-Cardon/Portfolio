import Parser from "./io/Parser.js"
import RedditAPIManager from './reddit/RedditAPIManager.js'
import Logger from './io/Logger.js'
import Writer from './io/Writer.js'
import process from 'node:process'
import { calculate_metrics } from './analysis/calculateMetrics.js'
import { write_to_json } from './io/writeOutput.js'
import { nlp, its, as, embeddings, sentiment } from './llm_helpers/init.js'


async function main() {
  const parser = new Parser()
  const tasks = parser.parseArgs(process.argv)
  const batch_config = parser.getBatchConfig()

  const logger = new Logger(batch_config)
  const writer = new Writer(logger, batch_config)
  const runner = new Runner(logger, writer, batch_config)
  for (const task of tasks) {
    runner.run(task)
  }
  runner.end()
}

await main()

