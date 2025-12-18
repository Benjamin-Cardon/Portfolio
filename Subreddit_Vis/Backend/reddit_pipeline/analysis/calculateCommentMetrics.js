
import { classify_comment } from './classifyHelpers.js'
import { embeddings, nlp, its, as } from "../llm_helpers/init.js"
import { sentiment_chunker_and_aggregator } from "../llm_helpers/sentimentScore.js"
export async function calculate_comments_metrics(comments, post_fullname, data) {
  let comments_metrics = [];
  for (const comment of comments) {
    await calculate_comment_metrics_tree_flatten(comments_metrics, comment, post_fullname, data)
  }
  return comments_metrics;
}

async function calculate_comment_metrics_tree_flatten(comments_metrics, comment, post_fullname, data) {
  const comment_metrics = {};
  comment_metrics.flags = classify_comment(comment)

  const text = comment.data.body;

  comment_metrics.id = comment.data.name;
  comment_metrics.post_id = post_fullname;
  comment_metrics.author = comment.data.author;
  comment_metrics.author_id = comment.data.author_fullname;
  comment_metrics.replied_to = comment.data.parent_id;
  comment_metrics.direct_reply_count = comment.data?.replies?.data?.children?.length ?? 0;
  comment_metrics.score = comment.data.score;
  comment_metrics.upvotes = comment.data.ups;
  comment_metrics.estimated_downvotes = comment.data.ups - comment.data.score
  comment_metrics.rough_fuzzed_controversy = Math.log(comment.data.ups) - Math.log(comment.data.score);
  if (!comment_metrics.flags.isNotValidText) {
    const embedding = await embeddings(comment.data.body, { pooling: 'mean', normalize: true })
    comment_metrics.sentiment = await sentiment_chunker_and_aggregator(comment.data.body);
    comment_metrics.frequency_table = nlp.readDoc(text).tokens()
      .filter((e) => (!e.out(its.stopWordFlag) && (e.out(its.type) == 'word')))
      .out(its.lemma, as.freqTable);

    data.embeddings[comment.data.name] = embedding;
    data.texts[comment.data.name] = comment.data.body;
  }

  comments_metrics.push(comment_metrics);

  if (comment_metrics.flags.isRepliedTo) {
    for (const child of comment.data.replies.data.children) {
      await calculate_comment_metrics_tree_flatten(comments_metrics, child, comment_metrics.post_id, data);
    }
  }
}