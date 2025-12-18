import Parser from "./io/Parser.js"
import { RedditAPIManager } from './reddit/RedditAPIManager.js'
import process from 'node:process'
import { calculate_metrics } from './analysis/calculateMetrics.js'
import { write_to_json } from './io/writeOutput.js'

async function main() {
  const parser = new Parser()
  const tasks = parser.parseArgs(process.argv)
  // Check to see if there was a config error.
  // If there was, no need to continue- Simply say that this is so in the terminal.
  // Then, we want to instantiate our logger and writer. Logger takes "Log_Level", and writer takes "Out_Dir"
  // Then we'll instantiate our Runner. The Runner will take our logger as an argument.
  // For each task, the runner will respond with a result object. The result object will be passed to the writer.
  // Finally, we'll finish the process.

  const reddit = await RedditAPIManager.create({ subreddit: args.subreddit, isCount: args.isCount, isFull: args.isFull, count: args.count, isBurstend: args.isBurstEnd, isBurstSleep: args.isBurstSleep })
  const posts = await reddit.get_posts()
  const { commentMap, postMap } = await reddit.get_comments_for_posts(posts)
  const data = await calculate_metrics(posts, postMap, commentMap)
  write_to_json(data, args.out_dir, args.out)
}

await main()

