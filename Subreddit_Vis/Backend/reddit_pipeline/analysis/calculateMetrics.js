import { calculate_comments_metrics } from './calculateCommentMetrics.js'
import { calculate_post_metrics } from './calculatePostMetrics.js'
import { reduce_post } from './reducePost.js'
import { reduce_comments } from './reduceComments.js'
import { stack_average_user_embeddings } from '../llm_helpers/stackEmbedding.js'
export async function calculate_metrics(posts, postMap, commentMap) {
  const data = {
    comments: {},
    posts: {},
    words: {},
    users: {},
    embeddings: {},
    texts: {},
  };

  for (const post of posts) {
    const post_metrics = await calculate_post_metrics(post, data);
    const comments_metrics = await calculate_comments_metrics(post.comments, post.data.name, data);
    reduce_post(post_metrics, data);
    reduce_comments(comments_metrics, data, postMap, commentMap);
  }
  stack_average_user_embeddings(data)
  return data;
}