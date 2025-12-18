

export function reduce_comments(comments_metrics, data, postMap, commentMap) {
  const { users, words } = data;
  for (const comment of comments_metrics) {
    if (!comment.id) {
      continue
    }
    // User summaries
    let user;
    if (!users[comment.author_id]) {
      user = {
        post_count: 0,
        author: comment.author,
        author_id: comment.author_id,
        total_upvotes: comment.upvotes,
        estimated_downvotes: comment.estimated_downvotes,
        text_ids: [comment.id],
        users_replied_to: [],
        users_who_commented_on_own_post: [],
        users_whose_posts_were_commented_on: [],
        users_who_replied_to: [],
        words: {},
        reply_count: 1,
        total_comments_on_posts: 0,
        total_direct_replies: 0,
        negative_sentiment_texts: 0,
        positive_sentiment_texts: 0,
        neutral_sentiment_texts: 0,
        negative_replies: 0,
        positive_replies: 0,
        neutral_replies: 0,
        positive_comments: 0,
        negative_comments: 0,
        neutral_comments: 0,
        is_likely_bot: comment.flags.isLikelyBot
      };
      users[comment.author_id] = user;
    } else {
      user = users[comment.author_id];
      user.reply_count++;
      user.text_ids.push(comment.id);
      user.total_upvotes += comment.upvotes;
      user.estimated_downvotes += comment.estimated_downvotes
    }

    const parent_post = postMap.get(comment.post_id);
    const direct_parent = comment.replied_to.startsWith("t1_") ? commentMap.get(comment.replied_to) : postMap.get(comment.replied_to);

    const parent_post_user = users[parent_post.data.author_fullname];
    const direct_parent_user = users[direct_parent.data.author_fullname];
    user.users_replied_to.push(direct_parent_user.author_id);
    user.users_whose_posts_were_commented_on.push(parent_post_user.author_id);
    parent_post_user.users_who_commented_on_own_post.push(user.author_id)
    direct_parent_user.users_who_replied_to.push(user.author_id)
    if (!comment.flags.isNotValidText) {
      switch (comment.sentiment.label) {
        case 'POSITIVE':
          user.positive_sentiment_texts++;
          direct_parent_user.positive_replies++;
          parent_post_user.positive_comments++;
          break;
        case 'NEGATIVE':
          user.negative_sentiment_texts++;
          direct_parent_user.negative_replies++;
          parent_post_user.negative_comments++;
          break;
        case 'NEUTRAL':
          user.neutral_sentiment_texts++;
          direct_parent_user.neutral_replies++;
          parent_post_user.neutral_comments++;
          break;
      }

      for (const word of comment.frequency_table) {
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
          global_word = { ...this_word, users: [comment.author_id], texts: [comment.id] };
          words[word[0]] = global_word;
        } else {
          global_word = words[word[0]];
          global_word.frequency += this_word.frequency;
          global_word.unique_texts++;
          global_word.users.push(comment.author_id);
          global_word.texts.push(comment.id);
        }
        switch (comment.sentiment.label) {
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

    data.comments[comment.id] = comment
  }
}
