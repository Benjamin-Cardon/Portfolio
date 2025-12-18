
export function reduce_post(post_metrics, data) {
  if (!post_metrics.id) {
    return
  }
  const { users, words } = data
  // Reduce user Summaries

  const author_id = post_metrics.author_id
  let user;
  if (!users[author_id]) {
    user = {
      post_count: 1,
      author: post_metrics.author,
      author_id: post_metrics.author_id,
      total_upvotes: post_metrics.total_upvotes,
      estimated_downvotes: post_metrics.total_downvotes,
      text_ids: [post_metrics.id],
      users_replied_to: [],
      users_who_commented_on_own_post: [],
      users_whose_posts_were_commented_on: [],
      users_who_replied_to: [],
      words: {},
      reply_count: 0,
      total_comments_on_posts: post_metrics.num_comments,
      total_direct_replies: 0,
      negative_sentiment_texts: 0,
      positive_sentiment_texts: 0,
      neutral_sentiment_texts: 0,
      positive_replies: 0,
      neutral_replies: 0,
      negative_replies: 0,
      positive_comments: 0,
      negative_comments: 0,
      neutral_comments: 0,
      is_likely_bot: post_metrics.flags.isLikelyBot,
    };
    users[author_id] = user;
  } else {
    user = users[author_id];
    user.post_count++;
    user.total_upvotes += post_metrics.total_upvotes;
    user.estimated_downvotes += post_metrics.total_downvotes;
    user.text_ids.push(post_metrics.id);
    user.total_comments_on_posts += post_metrics.num_comments;
  }
  if (!post_metrics.flags.isNotValidText) {
    switch (post_metrics.sentiment.label) {
      case 'POSITIVE':
        user.positive_sentiment_texts++;
        break;
      case 'NEGATIVE':
        user.negative_sentiment_texts++;
        break;
      case 'NEUTRAL':
        user.neutral_sentiment_texts++;
        break;
    }

    for (const word of post_metrics.frequency_table) {
      let this_word;
      if (!user.words[word[0]]) {
        this_word = {
          unique_texts: 1,
          frequency: word[1],
          negative_sentiment_freq: 0,
          positive_sentiment_freq: 0,
          neutral_sentiment_freq: 0,
        }
        user.words[word[0]] = this_word;
      } else {
        this_word = user.words[word[0]];
        this_word.unique_texts++;
        this_word.frequency += word[1];
      }

      let global_word;
      if (!words[word[0]]) {
        global_word = { ...this_word, users: [post_metrics.author_id], texts: [post_metrics.id] };
        words[word[0]] = global_word;
      } else {
        global_word = words[word[0]];
        global_word.frequency += this_word.frequency;
        global_word.unique_texts++;
        global_word.users.push(post_metrics.author_id);
        global_word.texts.push(post_metrics.id);
      }
      switch (post_metrics.sentiment.label) {
        case 'POSITIVE':
          this_word.positive_sentiment_freq += word[1];
          global_word.positive_sentiment_freq += word[1];
          break;
        case 'NEGATIVE':
          this_word.negative_sentiment_freq += word[1];
          global_word.negative_sentiment_freq += word[1];
          break;
        case 'NEUTRAL':
          this_word.neutral_sentiment_freq += word[1];
          global_word.neutral_sentiment_freq += word[1];
          break;
      }
    }
  }
  data.posts[post_metrics.id] = post_metrics;
}