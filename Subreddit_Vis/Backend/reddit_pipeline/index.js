
import path from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { sentiment, embeddings, nlp, its, as } from "./init/init"
import parse_and_validate_args from "./io/parseArgs"
import { stack, mean } from "@xenova/transformers";
import { multiply, transpose } from 'mathjs';
import { RedditAPIManager } from './limiter/RedditAPIManager'
import process from 'node:process'

await function newMain() {
  [args, errors] = parse_and_validate_args(process.argv)
  const reddit = RedditAPIManager.create({ subreddit: args.subreddit, isCount: args.isCount, isFull: args.isFull, count: args.count, isBurstend: args.isBurstEnd, isBurstSleep: args.isBurstSleep })
  const posts = await reddit.get_posts()
  const { commentMap, postMap } = reddit.get_comments_for_posts(posts)

}

async function main(config) {
  const { subreddit, isFull, postLimit } = config;
  let data = [];
  await get_posts_until(data, config)
  let postMap = new Map();
  let commentMap = new Map();
  await get_comment_trees(config, data, postMap, commentMap);
  const enriched_embeddings = await calculate_metrics(data, postMap, commentMap);
  enriched_embeddings['subreddit_name'] = config.subreddit
  stack_average_user_embeddings(enriched_embeddings)
  write_to_json(enriched_embeddings, config);
  call_python_scripts();
}
