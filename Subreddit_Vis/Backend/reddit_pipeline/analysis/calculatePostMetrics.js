import { classify_post } from './classifyHelpers.js'
import { embeddings, nlp, its, as } from "../llm_helpers/init.js"
import { sentiment_chunker_and_aggregator } from "../llm_helpers/sentimentScore.js"
export async function calculate_post_metrics(post, data) {
  const post_metrics = {};
  post_metrics.flags = classify_post(post)
  if (!post_metrics.flags.isRepliedTo && post_metrics.flags.isDeletedAuthor && post_metrics.flags.isNotValidText) {
    //The post has no author, text, or comments. It is a non-post.
    return post_metrics
  }

  post_metrics.num_comments = post.data.num_comments;
  post_metrics.total_direct_replies = post?.comments?.length ?? 0;
  post_metrics.total_upvotes = post.data.score == 0 && post.data.upvote_ratio == 0.5 ? 0 : post.data.upvote_ratio == 0.5 ? Math.round(post.data.score / 2) : Math.round((post.data.score * post.data.upvote_ratio) / (2 * post.data.upvote_ratio - 1));
  post_metrics.total_downvotes = post.data.score == 0 && post.data.upvote_ratio == 0.5 ? 0 : (post.data.upvote_ratio == 0.5 ? Math.round(post.data.score / 2) : Math.round((post.data.score * post.data.upvote_ratio) / (2 * post.data.upvote_ratio - 1))) - post.data.score;
  post_metrics.author = post.data.author;
  post_metrics.author_id = post.data.author_fullname;
  post_metrics.id = post.data.name;

  if (!post_metrics.flags.isNotValidText) {
    //We only send real strings to embedding, etc. This means not all posts have embeddings and texts.
    const text = post.data.title + " " + post.data.selftext;
    const doc = nlp.readDoc(text);
    post_metrics.frequency_table = doc.tokens()
      .filter((e) => (!e.out(its.stopWordFlag) && (e.out(its.type) == 'word')))
      .out(its.lemma, as.freqTable);
    post_metrics.sentiment = await sentiment_chunker_and_aggregator(text);
    const embedding = await embeddings(text, { pooling: 'mean', normalize: true });
    data.embeddings[post.data.name] = embedding;
    data.texts[post.data.name] = text
  }

  return post_metrics;
}
