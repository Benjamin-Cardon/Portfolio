export default async function calculate_metrics(data, postMap, commentMap) {
  logStage('METRICS_START', `Calculating metrics for ${data.length} posts`);
  const enriched_embeddings = {
    comments: {},
    posts: {},
    words: {},
    users: {},
    embeddings: {},
    texts: {},
  };

  for (const post of data) {
    const post_metrics = await calculate_post_metrics(post, enriched_embeddings);
    const comments_metrics = await calculate_comments_metrics(post.comments, post.data.name, enriched_embeddings);
    reduce_post(post_metrics, enriched_embeddings);
    reduce_comments(comments_metrics, enriched_embeddings, postMap, commentMap);
  }
  return enriched_embeddings;
}