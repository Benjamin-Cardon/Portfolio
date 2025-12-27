import { stack, mean } from "@xenova/transformers";
import { multiply, transpose } from 'mathjs';
import { nlp, its, as, sentiment, embeddings } from '../init/init.js'

export default class MetricAnalyzer {
  constructor(logger) {
    this.data = {
      comments: {},
      posts: {},
      words: {},
      users: {},
      embeddings: {},
      texts: {},
    }
    this.logger = logger
  }
  async calculate_metrics(posts, postMap, commentMap) {
    let i = 0;
    try {
      for (const post of posts) {
        i++;
        if (i % 50 === 0) {
          this.logger.log('info', `Calculated Metrics for ${i} posts and associated comments.`);
        }
        const post_metrics = await this.calculate_post_metrics(post);
        const comments_metrics = await this.calculate_comments_metrics(post.comments, post.data.name);
        this.reduce_post(post_metrics,);
        this.reduce_comments(comments_metrics, postMap, commentMap);
      }
      this.stack_average_user_embeddings()
    } catch (err) {
      const normalizedError = {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
      };
      this.logger.log(
        'debug',
        `Error in calculate_metrics: ${err.stack || err}`
      );
      return { ok: false, errors: [normalizedError], users: Object.entries(this.data.users).length, words: Object.entries(this.data.words).length }
    }
    return { ok: true, errors: [], users: Object.entries(this.data.users).length, words: Object.entries(this.data.words).length }
  }

  getData() {
    return this.data
  }

  classify_comment(comment) {
    const body = (comment.data.body || "").trim();
    const author = comment.data.author
    const isEmptyText = body.length === 0;
    const isDeletedText = body === "[deleted]";
    const isRemovedText = body === "[removed]";
    const isNotValidText = isEmptyText || isDeletedText || isRemovedText
    const isDeletedAuthor = author == "[deleted]"
    const isAutoModAuthor = author == "AutoModerator"
    const isLikelyBot = isAutoModAuthor || /bot$/i.test(author || "");
    const isRepliedTo = comment.data?.replies?.data?.children?.length ?? 0 > 0;
    return { isEmptyText, isDeletedText, isRemovedText, isDeletedAuthor, isAutoModAuthor, isLikelyBot, isRepliedTo, isNotValidText }
  }

  classify_post(post) {
    const rawTitle = (post.data.title || "").trim();
    const rawSelftext = (post.data.selftext || "").trim();
    const author = (post.data.author || "").trim();

    const isTitleDeleted = rawTitle === "[deleted]";
    const isTitleRemoved = rawTitle === "[removed]";
    const isBodyDeleted = rawSelftext === "[deleted]";
    const isBodyRemoved = rawSelftext === "[removed]";

    const hasTitleText = rawTitle.length > 0 && !isTitleDeleted && !isTitleRemoved;
    const hasBodyText = rawSelftext.length > 0 && !isBodyDeleted && !isBodyRemoved;

    // This is the key: any real text at all → valid
    const hasAnyText = hasTitleText || hasBodyText;
    const isNotValidText = !hasAnyText;
    const isDeletedAuthor = author === "[deleted]";
    const isAutoModAuthor = author === "AutoModerator";
    const isLikelyBot = isAutoModAuthor || /bot$/i.test(author || "");
    const isRepliedTo = post.data.num_comments > 0;
    return { isDeletedAuthor, isAutoModAuthor, isLikelyBot, isNotValidText, isRepliedTo }
  }


  reduce_comments(comments_metrics, postMap, commentMap) {
    const { users, words } = this.data;
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
      if (!parent_post_user || !direct_parent_user) {
        this.logger.log(
          'debug',
          `Missing parent user while reducing comment ${comment.id}; ` +
          `parent_post_user=${!!parent_post_user}, direct_parent_user=${!!direct_parent_user}`
        );
      }
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

      this.data.comments[comment.id] = comment
    }
  }

  reduce_post(post_metrics) {
    if (!post_metrics.id) {
      return
    }
    const { users, words } = this.data
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
    this.data.posts[post_metrics.id] = post_metrics;
  }

  async calculate_post_metrics(post) {
    const post_metrics = {};
    post_metrics.flags = this.classify_post(post)
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
      post_metrics.sentiment = await this.sentiment_chunker_and_aggregator(text);
      const embedding = await embeddings(text, { pooling: 'mean', normalize: true });
      this.data.embeddings[post.data.name] = embedding;
      this.data.texts[post.data.name] = text
    }

    return post_metrics;
  }

  async calculate_comments_metrics(comments, post_fullname) {
    let comments_metrics = [];
    for (const comment of comments) {
      await this.calculate_comment_metrics_tree_flatten(comments_metrics, comment, post_fullname)
    }
    return comments_metrics;
  }

  async calculate_comment_metrics_tree_flatten(comments_metrics, comment, post_fullname) {
    const comment_metrics = {};
    comment_metrics.flags = this.classify_comment(comment)

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
      comment_metrics.sentiment = await this.sentiment_chunker_and_aggregator(comment.data.body);
      comment_metrics.frequency_table = nlp.readDoc(text).tokens()
        .filter((e) => (!e.out(its.stopWordFlag) && (e.out(its.type) == 'word')))
        .out(its.lemma, as.freqTable);

      this.data.embeddings[comment.data.name] = embedding;
      this.data.texts[comment.data.name] = comment.data.body;
    }

    comments_metrics.push(comment_metrics);

    if (comment_metrics.flags.isRepliedTo) {
      for (const child of comment.data.replies.data.children) {
        await this.calculate_comment_metrics_tree_flatten(comments_metrics, child, comment_metrics.post_id);
      }
    }
  }
  async sentiment_chunker_and_aggregator(text) {
    // if the text is less than 512 characters long, there is no need to chunk it.
    const chunks = this.chunk_text(text);
    const chunk_promises = chunks.map(async (chunk) => {
      let labels = await sentiment(chunk, { topk: null });
      return {
        weight: chunk.length / text.length,
        labels
      }
    })
    const labels_and_weights = await Promise.all(chunk_promises);
    return labels_and_weights.reduce((acc, curr) => {
      acc[0].score += curr.labels[0].score * curr.weight;
      acc[1].score += curr.labels[1].score * curr.weight;
      acc[2].score += curr.labels[2].score * curr.weight;
      return acc;
    }, [{ label: 'NEGATIVE', score: 0 }, { label: 'NEUTRAL', score: 0 }, { label: "POSITIVE", score: 0 },]).reduce((acc, curr) => {
      if (curr.score >= acc.score) {
        return curr;
      } else {
        return acc;
      }
    }, { label: '', score: 0 });
  }

  chunk_text(text) {
    const chunks = []
    if (text.length < 512) {
      chunks.push(text);
      return chunks;
    }

    const paragraphs = text.split(/\n\s*\n/);

    for (const paragraph of paragraphs) {
      chunks.push(...this.chunk_paragraph(paragraph));
    }
    return chunks;
  }

  chunk_paragraph(paragraph) {
    const paragraph_chunks = [];
    if (paragraph.length < 512) {
      paragraph_chunks.push(paragraph);
      return paragraph_chunks
    }
    const sentences = nlp.readDoc(paragraph.trim()).sentences().out();
    paragraph_chunks.push(...this.chunk_sentences(sentences))
    return paragraph_chunks;
  }

  chunk_sentences(sentences) {
    const chunks = [];
    let currentChunk = '';
    for (let sentence of sentences) {
      if (sentence.length > 512) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        chunks.push(...this.chunk_long_sentence(sentence.trim()))
        continue;
      }
      if ((currentChunk + ' ' + sentence).trim().length <= 512) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  }

  chunk_long_sentence(long_sentence) {
    const words = nlp.readDoc(long_sentence).tokens().out();
    const chunks = [];
    let currentChunk = '';

    for (const word of words) {
      if (word.length > 512) {
        // extreme case: a single word longer than limit
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        chunks.push(...this.chunk_incoherently_long_string(word));
        continue;
      }

      if ((currentChunk + ' ' + word).trim().length <= 512) {
        currentChunk += (currentChunk ? ' ' : '') + word;
      } else {
        chunks.push(currentChunk.trim());
        currentChunk = word;
      }
    }

    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  }

  chunk_incoherently_long_string(incoherently_long_string) {
    const numParts = Math.ceil(incoherently_long_string.length / 512);
    const partSize = Math.ceil(incoherently_long_string.length / numParts);
    const parts = [];

    for (let i = 0; i < incoherently_long_string.length; i += partSize) {
      parts.push(incoherently_long_string.slice(i, i + partSize));
    }

    return parts;
  }

  stack_average_user_embeddings() {
    const { users, embeddings } = this.data;
    for (const [user_id, user] of Object.entries(users)) {
      const text_embeddings = []
      for (const text_id of user.text_ids) {
        const embedding = embeddings[text_id]
        if (embedding) {
          text_embeddings.push(embedding)
        }
      }
      if (text_embeddings.length == 0) {
        continue
      }
      if (text_embeddings.length == 1) {
        user.only_one_text = true;
      } else {
        user.only_one_text = false;
      }
      const stacked = stack(text_embeddings, 0);
      const mean_embedding = mean(stacked, 0).squeeze();
      const embedding_norm = mean_embedding.norm();
      const invNorm = 1 / embedding_norm.data[0];  // extract scalar, take reciprocal
      const normalized = mean_embedding.mul(invNorm);
      if (!user.only_one_text) {
        this.data.embeddings[user_id] = normalized;
      }
    }
  }

}
