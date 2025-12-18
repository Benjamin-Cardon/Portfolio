import parse_and_validate_args from "./io/parseArgs.js"
import { RedditAPIManager } from './reddit/RedditAPIManager.js'
import process from 'node:process'
import { calculate_metrics } from './analysis/calculateMetrics.js'
import { write_to_json } from './io/writeOutput.js'

async function main() {
  const [args, errors] = parse_and_validate_args(process.argv)
  const reddit = await RedditAPIManager.create({ subreddit: args.subreddit, isCount: args.isCount, isFull: args.isFull, count: args.count, isBurstend: args.isBurstEnd, isBurstSleep: args.isBurstSleep })
  const posts = await reddit.get_posts()
  const { commentMap, postMap } = reddit.get_comments_for_posts(posts)
  const data = calculate_metrics(posts, postMap, commentMap)
  write_to_json(data)
}

main()

