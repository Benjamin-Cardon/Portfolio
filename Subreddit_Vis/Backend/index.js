import axios from "axios";
import path from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { stack, mean, pipeline, env as transformersEnv } from "@xenova/transformers";
import { multiply, transpose } from 'mathjs';
import dotenv from "dotenv";
import process from 'node:process'
dotenv.config(); // load .env file

transformersEnv.allowLocalModels = true;
transformersEnv.localModelPath = path.resolve("./models");
transformersEnv.allowRemoteModels = false;

const sentiment = await pipeline(
  "sentiment-analysis",
  "cardiffnlp_roberta_onnx", { dtype: 'fp32', quantized: false }
);

const embeddings = await pipeline(
  "feature-extraction",
  "all-MiniLM-L6-v2-onnx", { dtype: 'fp32', quantized: false }
);

import winkNLP from 'wink-nlp';

// Load English language model
import model from 'wink-eng-lite-web-model';

// Get token
const nlp = winkNLP(model, ['sbd', 'negation', 'sentiment', 'ner', 'pos']);
const its = nlp.its;
const as = nlp.as;

const mode = process.argv[2]
if (!(mode == 'count' || mode == 'full')) {
  console.error('please specify mode of either "count" or "full" ');
  process.exit(1);
}
const subreddit = process.argv[3] || 'dataengineering';
const count = Number(process.argv[4]) || 10;
if (mode === 'count' && (isNaN(count) || count <= 0)) {
  console.error('In count mode, please specify a positive numeric count.');
  process.exit(1);
}
const isCount = mode == 'count'
const isFull = mode == 'full';
let burst_mode = '';
if (isCount) {
  burst_mode = process.argv[4] || 'end';
  if (burst_mode !== 'end' && burst_mode !== 'sleep') {
    console.log("incorrect or no burst mode included. Defaulting to 'end' mode. In end mode, the process will end after it hits it's reddit API request limit, even if more posts or comments are available to request");
    burst_mode = 'sleep';
  }
}
const init = await initialize(subreddit);

const config = {
  mode, isCount, isFull, postLimit: isCount ? count : Infinity, burst_mode, subreddit, ...init
}

logStage('INIT', `Mode: ${config.mode}, Subreddit: ${config.subreddit}, Post limit: ${config.postLimit}`);

if (isCount && isNaN(count)) {
  console.error('In count mode, please specify a numeric count.');
  process.exit(1);
}

main(config);

async function initialize(subreddit) {
  const tokenholder = { token: "" };
  await check_auth_token_expired(tokenholder);

  const headers = {
    "User-Agent": "web:social-graph-analysis-visualization:v1.0.0 (by /u/AppropriateTap826)",
    Authorization: `Bearer ${tokenholder.token}`,
  };

  const isSfwPublic = await check_subreddit_public_sfw_exists(headers, subreddit);

  if (!isSfwPublic) {
    console.error(`Subreddit "${subreddit}" does not exist, or is not public and SFW.`);
    process.exit(1);
  }
  return { headers, tokenholder, isSfwPublic };
}

async function check_auth_token_expired(tokenholder) {
  try {
    const tokenfile = readFileSync('token.txt', 'utf-8').split(':::');
    const expiration = Number(tokenfile[0]);

    if (expiration < ((Date.now() / 1000) - 60)) {
      console.log("Token Expired");
      await get_and_save_auth_token(tokenholder);
    } else {
      console.log("Token Still Good")
      tokenholder.token = tokenfile[1];
    }
  }
  catch (err) {
    console.log("No token found, fetching new one...");
    await get_and_save_auth_token(tokenholder);
  }
}

async function get_and_save_auth_token(tokenholder) {
  try {
    const response = await axios.post("https://www.reddit.com/api/v1/access_token", `grant_type=password&username=${process.env.REDDIT_USERNAME}&password=${process.env.REDDIT_PASSWORD}`, {
      auth: {
        username: process.env.REDDIT_CLIENTID,
        password: process.env.REDDIT_SECRET
      },
      headers: {
        "User-Agent": "web:social-graph-analysis-visualization:v1.0.0 (by /u/AppropriateTap826)",
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });
    const expiration_date = Math.floor(Date.now() / 1000) + response.data.expires_in;
    tokenholder.token = response.data.access_token;
    writeFileSync('token.txt', expiration_date + ":::" + tokenholder.token);
    console.log("New Token Saved")
  } catch (err) {
    console.error("Failed to get new token:", err.response?.data || err.message);
    throw err;
  }
}

async function check_subreddit_public_sfw_exists(headers, subreddit, subreddit_does_not_exist = false, subreddit_private = false) {
  try {
    const { requests_remaining, ms_remaining } = get_request_rates()
    if (!requests_remaining) {
      console.log("Tried to run function with no requests. Wait " + ms_remaining / 60000 + " minutes before trying again");
      process.exit(1);
    }
    const response = await axios.get(`https://oauth.reddit.com/r/${subreddit}/about`, {
      headers,
    })
    log_request_count(1);

    if (response.data.data.subreddit_type == undefined && response.data.data.over18 == undefined) {
      subreddit_does_not_exist == true;
      console.log("Subreddit Does Not Exist")
    }
    return response.data.data.subreddit_type == 'public' && !response.data.data.over18;
  } catch (err) {
    if (err.status == 400) {
      console.log("Axios Bad request");
      return false;
    } else if (err.status == 401) {
      console.log("Authorization Error");
      return false;
    } else if (err.status == 403) {
      console.log("Private Subreddit")
      subreddit_private = true;
      return false;
    } else if (err.status == 404) {
      subreddit_does_not_exist = true;
      return false;
    } else {
      console.log(err);
      return false;
    }
  }
}

async function main(config) {
  const { subreddit, isFull, postLimit } = config;
  let data = [];
  await get_posts_until(data, config)
  let postMap = new Map();
  let commentMap = new Map();
  await get_comment_trees(config, data, postMap, commentMap);
  const metrics = await calculate_metrics(data, postMap, commentMap);
  stack_average_user_embeddings(metrics.user_summaries)
  compute_user_similarity_matrix(metrics.user_summaries)
  // console.log(Object.entries(metrics.user_summaries).filter(([key, value]) => { return value.reply_count == 0 }))
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function check_request_count(proposed_requests) {
  return proposed_requests < (get_request_rates().requests_remaining);
}

function get_request_rates() {
  let request_summary = trim_request_log(readFileSync('requestlog.txt', 'utf-8').split(',')).reduce((accumulator, current) => {
    const [count, time] = current.split(':')
    accumulator.requests_used += count
    accumulator.window_ends_at = Math.min(Number(time), accumulator.earliest_request);
    return accumulator;
  }, { requests_used: 0, earliest_request: Date.now() });

  return {
    requests_used: request_summary.requests_used,
    requests_remaining: 1000 - request_summary.requests_used,
    window_ends_at: request_summary.earliest_request + 600000,
    ms_remaining: request_summary.window_ends_at - Date.now()
  }
};

function log_request_count(request_count) {
  let log = trim_request_log(readFileSync('requestlog.txt', 'utf-8').split(','));
  log.push(`${request_count}:${Date.now()}`)
  writeFileSync('requestlog.txt', log.join(','));
}

function trim_request_log(log) {
  return log.filter((x) => x.split(':')[1] > Date.now() - 600000)
}

async function get_posts_until(data, config,) {

  let request_count = 0;
  const limit = 100;
  let after = null;
  const params = { limit };

  while (data.length < config.postLimit) {
    const { requests_remaining, ms_remaining } = get_request_rates();

    if (requests_remaining) {
      console.log("There are currently no requests available.")
      if ((config.mode === 'count' && config.burst_mode === 'sleep') || config.mode === 'full') {
        console.log(`Waiting ${ms_remaining / 60000} minutes until beginning requests`);
        await sleep(ms_remaining);
      }
    } else {
      console.log(`Exiting early becuase of request counting error. After ${ms_remaining / 60000} minutes more requests will be available. `)
      process.exit(1);
    }
    try {
      if (after) params.after = after;
      request_count++;
      const response = await axios.get(`https://oauth.reddit.com/r/${config.subreddit}/new`, {
        headers: config.headers, params
      })
      const children = response.data.data.children;
      if (!children || children.length === 0) break;
      data.push(...children)
      after = response.data.data.after;
      if (!after) break;
      if (config.isFull) {
        if (request_count % 50 == 0) {
          log_request_count(request_count)
          request_count = 0;
        }
        await sleep((ms_remaining / requests_remaining ?? 1));
      }
      logStage('POST_FETCH', `Requests used: ${request_count}, Posts collected: ${data.length}`);
      if (requests_remaining == request_count && config.isCount && config.burst_mode === 'sleep') {
        log_request_count(request_count);
        request_count = 0;
        console.log("Ran out of requests, sleeping until more requests available")
        await sleep(ms_remaining);
      }
    } catch (err) {
      console.error("error fetching posts:", err.message)
      break;
    }
  }
  if (data.length > count) {
    data.length = count;
  }
  if (config.isFull) {
    log_request_count(request_count % 50)
  } else {
    log_request_count(request_count);
  }
  logStage('POSTS_DONE', `Total posts: ${data.length}`);
}

async function get_comment_trees(config, data, postMap, commentMap) {
  const posts = [];
  const more_nodes_request_queue = [];
  // see if we have enough requests to get all the posts:
  let request_count = 0;
  let isEnded = false;
  let { requests_remaining, ms_remaining } = get_request_rates();
  logStage('COMMENT_START', `Beginning comment collection for ${data.length} posts`);
  for (const post of data) {
    const postId = post.data.name;
    postMap.set(postId, post);

    if (requests_remaining === 0) {
      if (config.isFull) {
        await sleep(ms_remaining + 100);
        ({ requests_remaining, ms_remaining } = get_request_rates());
      } else if (config.isCount && config.burst_mode == 'end') {
        isEnded = true;
        post.comments = [];
        continue;
      } else if (config.isCount && config.burst_mode == 'sleep') {
        log_request_count(request_count);
        request_count = 0;
        await sleep(ms_remaining + 100);
        ({ requests_remaining, ms_remaining } = get_request_rates());
      }
    }
    if (!post.data.num_comments) {
      post.comments = [];
      continue;
    }

    request_count++;
    requests_remaining--;
    logStage('COMMENT_REQUEST', `Post ${post.data.name} (${post.data.num_comments} comments)`);
    posts.push(axios
      .get(`https://oauth.reddit.com/comments/${postId.slice(3)}?depth=10&limit=500`, { headers: config.headers })
      .then((res) => {
        // As soon as this one resolves, attach the comments to the post
        const children = res.data[1].data.children;
        post.comments = children;
        logStage('COMMENT_ATTACHED', `Post ${post.data.name}: ${children.length} top-level comments`);
      })
      .catch((err) => {
        console.error(`Failed to load comments for post ${postId}`, err);
      }));

    if (config.isFull && request_count % 50 === 0) {
      log_request_count(request_count);
      request_count = 0;
      ({ requests_remaining, ms_remaining } = get_request_rates());
    }

    if (config.isFull) {
      const delay = ms_remaining / Math.max(requests_remaining, 1);
      await sleep(delay);
    }
  }
  log_request_count(request_count);
  request_count = 0;
  await Promise.all(posts);
  logStage('COMMENT_TREE', `Flattening and linking comment trees`);
  for (const post of data) {
    process_comment_tree_into_map_and_queue(post, commentMap, more_nodes_request_queue, post.data.name);
  }

  ({ requests_remaining, ms_remaining } = get_request_rates());

  while (more_nodes_request_queue.length && !isEnded) {

    if (requests_remaining === 0) {
      if (config.isFull) {
        await sleep(ms_remaining + 100);
        ({ requests_remaining, ms_remaining } = get_request_rates());
      } else if (config.isCount && config.burst_mode == 'end') {
        isEnded = true;
        continue;
      } else if (config.isCount && config.burst_mode == 'sleep') {
        log_request_count(request_count);
        request_count = 0;
        await sleep(ms_remaining + 100);
        ({ requests_remaining, ms_remaining } = get_request_rates());
      }
    }

    requests_remaining--;
    request_count++;

    const req = more_nodes_request_queue.shift();
    const { parentNode, childrenIds } = req;
    // console.log(req)
    const url = `https://oauth.reddit.com/api/morechildren.json?link_id=${req.postId}&children=${childrenIds.join(",")}`;
    try {
      const res = await axios.get(url, { headers });
      const newChildren = res.data.json.data.things; // array of 't1' comments
      logStage('MORE_CHILDREN', `Queued ${newChildren.length} extra nodes`);
      for (const child of newChildren) {
        if (child.kind == 'more') {
          more_nodes_request_queue.push({
            parentNode: parentNode,  // direct reference
            postId: req.postId,
            childrenIds: child.data.children,
          });
          logStage('MORE_NODES', `Queued ${child.data.children.length} extra nodes`);
        } else {
          commentMap.set(child.data.name, child)
          process_comment_tree_into_map_and_queue(child, commentMap, more_nodes_request_queue, req.postId)
        }
      }
      newChildren.forEach((child) => {
        if (child.kind == 'more') {
          return;
        }
        if (child.data.parent_id.slice(0, 2) == 't3') {
          postMap.get(child.data.parent_id).data.comments.push(child);
        } else if (child.data.parent_id.slice(0, 2) == 't1') {
          if (commentMap.get(child.data.parent_id).data.replies == "") {
            commentMap.get(child.data.parent_id).data.replies = [child];
          } else {
            commentMap.get(child.data.parent_id).data.replies.push(child)
          }
        }
      })
      if (config.isFull) { await sleep(ms_remaining / Math.max(requests_remaining, 1)); }
    } catch (err) {
      console.error("Error fetching morechildren:", {
        url,
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
      });
    }
  }
  log_request_count(request_count);
}

function process_comment_tree_into_map_and_queue(rootNode, commentMap, more_nodes_request_queue, postId) {
  let queue = [];
  if (rootNode.kind === 't3') { // post
    queue = [...(rootNode.comments || [])];
  } else if (rootNode.kind === 't1') { // comment
    queue = rootNode.data.replies && rootNode.data.replies.data
      ? [...rootNode.data.replies.data.children]
      : [];
  }
  logStage('COMMENT_TREE_PROCESS', `Root ${postId}, initial queue length: ${queue.length}`);
  while (queue.length > 0) {
    const node = queue.shift();

    if (node.kind === 't1') {
      commentMap.set(node.data.name, node);

      // Push replies if they exist
      if (node.data.replies && node.data.replies.data) {
        queue.push(...node.data.replies.data.children);
      }
    } else if (node.kind === 'more') {
      // console.log(node.data);
      if (node.data.children.length == 0 || node.data.count == 0) {
        //More node is just a placeholder in these cases
        continue;
      }
      more_nodes_request_queue.push({
        parentNode: node,   // direct reference
        postId: postId,     // passed in
        childrenIds: node.data.children,
      });
    } else {
      console.log("Unexpected node kind:", node.kind);
    }
  }
}

async function calculate_metrics(data, postMap, commentMap) {
  logStage('METRICS_START', `Calculating metrics for ${data.length} posts`);
  const user_summaries = {};
  const word_summaries = {};
  const post_embedding_performance = {};
  const subreddit_summary = {}
  for (const post of data) {
    const post_metrics = await calculate_post_metrics(post);
    logStage('METRICS_POST', `Post metrics computed for ${post.data.name}`);
    // console.log(post)
    const comments_metrics = await calculate_comments_metrics(post.comments, post.data.name);
    logStage('METRICS_COMMENTS', `Flattened ${comments_metrics.length} comments for post`);
    reduce_post(post_metrics, user_summaries, word_summaries, post_embedding_performance);
    reduce_comments(comments_metrics, user_summaries, word_summaries, post_embedding_performance, postMap, commentMap);
  }
  logStage('METRICS_DONE', `Completed metrics. Users: ${Object.keys(user_summaries).length},Words:${Object.keys(word_summaries).length}`);
  return { user_summaries, word_summaries, post_embedding_performance, subreddit_summary }
}

async function calculate_post_metrics(post) {
  const post_metrics = {};
  post_metrics.num_comments = post.data.num_comments;
  post_metrics.total_direct_replies = post?.comments?.length ?? 0;
  post_metrics.total_upvotes = post.data.score == 0 && post.data.upvote_ratio == 0.5 ? 0 : post.data.upvote_ratio == 0.5 ? Math.round(post.data.score / 2) : Math.round((post.data.score * post.data.upvote_ratio) / (2 * post.data.upvote_ratio - 1));
  post_metrics.total_downvotes = post.data.score == 0 && post.data.upvote_ratio == 0.5 ? 0 : (post.data.upvote_ratio == 0.5 ? Math.round(post.data.score / 2) : Math.round((post.data.score * post.data.upvote_ratio) / (2 * post.data.upvote_ratio - 1))) - post.data.score;
  post_metrics.author = post.data.author;
  post_metrics.author_id = post.data.author_fullname;
  const text = post.data.title + " " + post.data.selftext;
  const doc = nlp.readDoc(text);
  post_metrics.frequency_table = doc.tokens()
    .filter((e) => (!e.out(its.stopWordFlag) && (e.out(its.type) == 'word')))
    .out(its.lemma, as.freqTable);
  //TODO - Chunk Texts.
  post_metrics.sentiment = await sentiment_chunker_and_aggregator(text);
  post_metrics.id = post.data.id;
  post_metrics.embedding = await embeddings(text, { pooling: 'mean', normalize: true });
  return post_metrics;
}

async function calculate_comments_metrics(comments, post_fullname) {
  let comments_metrics = [];
  logStage('COMMENT_METRIC', `Input comments for flatten: ${comments?.length || 0}`);
  for (const comment of comments) {
    await calculate_comment_metrics_tree_flatten(comments_metrics, comment, post_fullname)
  }
  return comments_metrics;
}

async function calculate_comment_metrics_tree_flatten(comments_metrics, comment, post_fullname,) {
  logStage('COMMENT_FLATTEN', `Flattening comment ${comment.data.id}, parent ${comment.data.parent_id}`);

  const comment_metrics = {};
  const text = comment.data.body;
  comment_metrics.id = comment.data.id;
  comment_metrics.post_id = post_fullname;
  comment_metrics.author = comment.data.author;
  comment_metrics.author_id = comment.data.author_fullname;
  comment_metrics.embeddings = await embeddings(comment.data.body, { pooling: 'mean', normalize: true })
  comment_metrics.sentiment = await sentiment_chunker_and_aggregator(comment.data.body);
  comment_metrics.frequency_table = nlp.readDoc(text).tokens()
    .filter((e) => (!e.out(its.stopWordFlag) && (e.out(its.type) == 'word')))
    .out(its.lemma, as.freqTable);
  comment_metrics.replied_to = comment.data.parent_id;
  comment_metrics.direct_reply_count = comment.data?.replies?.data?.children?.length ?? 0;
  comment_metrics.score = comment.data.score;
  comment_metrics.upvotes = comment.data.ups;
  comment_metrics.estimated_downvotes = comment.data.ups - comment.data.score
  comment_metrics.rough_fuzzed_controversy = Math.log(comment.data.ups) - Math.log(comment.data.score);
  if (comment.data.replies && comment.data?.replies?.children?.length) {
    comment.data.replies.data.children.forEach((child) => calculate_comment_metrics_tree_flatten(comments_metrics, child, comment_metrics.post_id))
  }
  comments_metrics.push(comment_metrics);
}

function reduce_post(post_metrics, user_summaries, word_summaries, post_embedding_performance) {
  logStage('REDUCE_POST', `Reducing post: ${post_metrics.id} by ${post_metrics.author}`);
  // Reduce user Summaries
  const author_id = post_metrics.author_id
  let user;
  if (!user_summaries[author_id]) {
    user = {
      post_count: 1,
      author: post_metrics.author,
      author_id: post_metrics.author_id,
      total_upvotes: post_metrics.total_upvotes,
      estimated_downvotes: post_metrics.total_downvotes,
      text_embeddings: [post_metrics.embedding],
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
      neutral_comments: 0
    };
    user_summaries[author_id] = user;
  } else {
    user = user_summaries[author_id];
    user.post_count++;
    user.total_upvotes += post_metrics.total_upvotes;
    user.estimated_downvotes += post_metrics.total_downvotes;
    user.text_embeddings.push(post_metrics.embedding);
    user.total_comments_on_posts += post_metrics.num_comments;
  }
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
    if (!word_summaries[word[0]]) {
      global_word = { ...this_word, users: [post_metrics.author_id] };
      word_summaries[word[0]] = global_word;
    } else {
      global_word = word_summaries[word[0]];
      global_word.frequency += this_word.frequency;
      global_word.unique_texts++;
      global_word.users.push(post_metrics.author_id);
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
  if (!post_embedding_performance.post_data) {
    post_embedding_performance.post_data = [{ embedding: post_metrics.embedding, total_direct_replies: post_metrics.total_direct_replies, total_upvotes: post_metrics.total_upvotes, total_downvotes: post_metrics.estimated_downvotes, }];
  } else {
    post_embedding_performance.post_data.push({ embedding: post_metrics.embedding, total_direct_replies: post_metrics.total_direct_replies, total_upvotes: post_metrics.total_upvotes, total_downvotes: post_metrics.estimated_downvotes, })
  }
}

function reduce_comments(comments_metrics, user_summaries, word_summaries, post_embedding_performance, postMap, commentMap) {
  for (const comment of comments_metrics) {
    logStage('REDUCE_COMMENT', `Reducing comment: ${comment.id} by ${comment.author}`);
    // User summaries
    let user;
    if (!user_summaries[comment.author_id]) {
      user = {
        post_count: 0,
        author: comment.author,
        author_id: comment.author_id,
        total_upvotes: comment.upvotes,
        estimated_downvotes: comment.estimated_downvotes,
        text_embeddings: [comment.embeddings],
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
        neutral_comments: 0
      };
      user_summaries[comment.author_id] = user;
    } else {
      user = user_summaries[comment.author_id];
      user.reply_count++;
      user.text_embeddings.push(comment.embeddings);
      user.total_upvotes += comment.upvotes;
      user.estimated_downvotes += comment.estimated_downvotes
    }
    if (!postMap.has(comment.post_id)) {
      console.log(comment.post_id);
      console.log("This comment's parent existed in the postmap")
    }
    const parent_post = postMap.get(comment.post_id);
    const direct_parent = comment.post_id.startsWith("t1_") ? commentMap.get(comment.replied_to) : postMap.get(comment.replied_to);

    const parent_post_user = user_summaries[parent_post.data.author_fullname];
    const direct_parent_user = user_summaries[direct_parent.data.author_fullname];
    user.users_replied_to.push(direct_parent_user.author_id);
    user.users_whose_posts_were_commented_on.push(parent_post_user.author_id);
    parent_post_user.users_who_commented_on_own_post.push(user.author_id)
    direct_parent_user.users_who_replied_to.push(user.author_id)

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
      if (!word_summaries[word[0]]) {
        global_word = { ...this_word, users: [comment.author_id] };
        word_summaries[word[0]] = global_word;
      } else {
        global_word = word_summaries[word[0]];
        global_word.frequency += this_word.frequency;
        global_word.unique_texts++;
        global_word.users.push(comment.author_id);
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
    post_embedding_performance.post_data.push({ embedding: comment.embeddings, direct_reply_count: comment.direct_reply_count, total_upvotes: comment.upvotes, estimated_downvotes: comment.estimated_downvotes, });
  }
}

async function sentiment_chunker_and_aggregator(text) {
  // if the text is less than 512 characters long, there is no need to chunk it.
  const chunks = chunk_text(text);
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

function chunk_text(text) {
  const chunks = []
  if (text.length < 512) {
    chunks.push(text);
    return chunks;
  }

  const paragraphs = text.split(/\n\s*\n/);

  for (const paragraph of paragraphs) {
    chunks.push(...chunk_paragraph(paragraph));
  }
  return chunks;
}

function chunk_paragraph(paragraph) {
  const paragraph_chunks = [];
  if (paragraph.length < 512) {
    paragraph_chunks.push(paragraph);
    return paragraph_chunks
  }
  const sentences = nlp.readDoc(paragraph.trim()).sentences().out();
  paragraph_chunks.push(...chunk_sentences(sentences))
  return paragraph_chunks;
}

function chunk_sentences(sentences) {
  const chunks = [];
  let currentChunk = '';
  for (let sentence of sentences) {
    if (sentence.length > 512) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      chunks.push(...chunk_long_sentence(sentence.trim()))
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

function chunk_long_sentence(long_sentence) {
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
      chunks.push(...chunk_incoherently_long_string(word));
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

function chunk_incoherently_long_string(incoherently_long_string) {
  const numParts = Math.ceil(incoherently_long_string.length / 512);
  const partSize = Math.ceil(incoherently_long_string.length / numParts);
  const parts = [];

  for (let i = 0; i < incoherently_long_string.length; i += partSize) {
    parts.push(incoherently_long_string.slice(i, i + partSize));
  }

  return parts;
}

function logStage(stage, details = '') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] [${stage}] ${details}`);
}
function stack_average_user_embeddings(user_summaries) {
  for (const [key, user] of Object.entries(user_summaries)) {

    if (!user.text_embeddings || user.text_embeddings.length === 0) continue;


    const shapes = user.text_embeddings.map(t => t.dims);
    console.log(`[DEBUG] User ${key} embedding shapes:`, shapes);

    const stacked = stack(user.text_embeddings, 0);
    console.log(stacked.dims)
    const mean_embedding = mean(stacked, 0).squeeze();
    console.log(mean_embedding.dims)
    const embedding_norm = mean_embedding.norm()
    const invNorm = 1 / embedding_norm.data[0];  // extract scalar, take reciprocal
    const normalized = mean_embedding.mul(invNorm);
    user.personal_summary_embedding = normalized;
  }
}
function compute_user_similarity_matrix(user_summaries) {
  const user_tensors = Object.values(user_summaries)
    .map(u => Array.from(u.personal_summary_embedding.data));

  const user_similarity = multiply(user_tensors, transpose(user_tensors));
  console.log(user_similarity);
}
