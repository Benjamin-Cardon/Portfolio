import axios from "axios";
import path from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { pipeline, env as transformersEnv } from "@xenova/transformers";
import dotenv from "dotenv";
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
// Obtain "its" helper to extract item properties.
const its = nlp.its;
// Obtain "as" reducer helper to reduce a collection.
const as = nlp.as;


main();

async function main() {
  let tokenholder = { token: "" };
  await check_auth_token_expired(tokenholder);

  let subreddit = 'dataengineering';
  const headers = {
    "User-Agent": "web:social-graph-analysis-visualization:v1.0.0 (by /u/AppropriateTap826)", Authorization: `Bearer ${tokenholder.token}`,
  }

  if (! await check_subreddit_public_sfw_exists(headers, subreddit)) {
    console.log("This is not a public, sfw subreddit!");
    return;
  }
  console.log("acceptable subreddit")

  let data = [];
  await get_posts_until(headers, subreddit, data, 5)
  await get_comment_trees(headers, subreddit, data);

  // console.log(data[1].comments.map((x) => x.data))
  let user_likes = {}
  // count_user_votes(data, user_likes)
  // convert_userinfo_csv(user_likes)
  // word_frequency_sentiment_by_user(data, user_likes, {})
  //console.log(Object.entries(user_likes['___words___']).filter(([key, value]) => value.authors.length > 3).map(([key, value]) => `${key}: has authors ` + value.authors.join(',')))
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

function check_request_count(proposed_requests) {
  return proposed_requests < (1000 - get_request_count());
}

function get_request_count() {
  return trim_request_log(readFileSync('requestlog.txt', 'utf-8').split(',')).reduce((accumulator, current) => {
    return Number(current.split(':')[0]) + accumulator
  }, 0);
};

function log_request_count(request_count) {
  let log = trim_request_log(readFileSync('requestlog.txt', 'utf-8').split(','));
  log.push(`${request_count}:${Date.now()}`)
  writeFileSync('requestlog.txt', log.join(','));
}

function trim_request_log(log) {
  return log.filter((x) => x.split(':')[1] > Date.now() - 600000)
}

async function check_subreddit_public_sfw_exists(headers, subreddit, subreddit_does_not_exist = false, subreddit_private = false) {
  try {
    const response = await axios.get(`https://oauth.reddit.com/r/${subreddit}/about`, {
      headers,
    })
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

async function get_posts_until(headers, subreddit, data, count,) {
  let request_count = 0;
  //TODO, Manage requests better;
  if (!check_request_count(count / 100)) {
    throw Error;
  }
  const limit = 100;
  let after = null;
  const params = { limit };
  while (data.length < count) {
    try {
      if (after) params.after = after;
      request_count++;
      const response = await axios.get(`https://oauth.reddit.com/r/${subreddit}/new`, {
        headers, params
      })
      const children = response.data.data.children;
      if (!children || children.length === 0) break;
      data.push(...children)
      after = response.data.data.after;
      if (!after) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error("error fetching posts:", err.message)
      break;
    }
  }
  if (data.length > count) {
    data.length = count;
  }
  log_request_count(request_count);
  console.log(data.length)
}

async function get_comment_trees(headers, subreddit, data) {
  const posts = [];
  const more_nodes_request_queue = [];
  // see if we have enough requests to get all the posts:
  let request_budget = 1000 - get_request_count();
  let request_count = 0;

  const postMap = new Map();
  for (const post of data) {
    const postId = post.data.name;
    postMap.set(postId, post);
    if (!post.data.num_comments) {
      continue;
    }
    request_budget--;
    request_count++;
    posts.push(axios
      .get(`https://oauth.reddit.com/comments/${postId.slice(3)}?depth=10&limit=500`, { headers })
      .then((res) => {
        // As soon as this one resolves, attach the comments to the post
        post.comments = res.data[1].data.children;
      })
      .catch((err) => {
        console.error(`Failed to load comments for post ${postId}`, err);
      }));
    if (!request_budget) {
      break;
    }
  }
  log_request_count(request_count);
  request_count = 0;
  await Promise.all(posts);

  const commentMap = new Map();

  for (const post of data) {
    process_comment_tree_into_map_and_queue(post, commentMap, more_nodes_request_queue, post.data.id);
  }

  while (more_nodes_request_queue.length && request_budget) {
    request_budget--;
    request_count++;
    const req = more_nodes_request_queue.shift();
    const { parentNode, childrenIds } = req;
    // console.log(req)
    const url = `https://oauth.reddit.com/api/morechildren.json?link_id=t3_${req.postId}&children=${childrenIds.join(",")}`;
    try {
      const res = await axios.get(url, { headers });
      const newChildren = res.data.json.data.things; // array of 't1' comments

      for (const child of newChildren) {
        if (child.kind == 'more') {
          more_nodes_request_queue.push({
            parentNode: parentNode,  // direct reference
            postId: req.postId,
            childrenIds: child.data.children,
          });
        } else {
          commentMap.set(child.data.id, child)
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

function count_user_votes(data, user_likes) {
  data.forEach((el, ind, arr) => {
    if (user_likes[el.data.author] == undefined) {
      user_likes[el.data.author] = {
        post_count: 1,
        num_comments: el.data.num_comments,
        total_upvotes: el.data.score == 0 && el.data.upvote_ratio == 0.5 ? 0 : el.data.ratio == 0.5 ? Math.round(el.data.score / 2) : Math.round((el.data.score * el.data.upvote_ratio) / (2 * el.data.upvote_ratio - 1)),
        total_downvotes: el.data.score == 0 && el.data.upvote_ratio == 0.5 ? 0 : (el.data.ratio == 0.5 ? Math.round(el.data.score / 2) : Math.round((el.data.score * el.data.upvote_ratio) / (2 * el.data.upvote_ratio - 1))) - el.data.score,
      }
    } else {
      user_likes[el.data.author].post_count += 1;
      user_likes[el.data.author].num_comments += el.data.num_comments;
      user_likes[el.data.author].total_upvotes += el.data.score == 0 && el.data.upvote_ratio == 0.5 ? 0 : el.data.score == 0 ? 0 : el.data.ratio == 0.5 ? Math.round(el.data.score / 2) : Math.round((el.data.score * el.data.upvote_ratio) / (2 * el.data.upvote_ratio - 1));
      user_likes[el.data.author].total_downvotes += el.data.score == 0 && el.data.upvote_ratio == 0.5 ? 0 : (el.data.ratio == 0.5 ? Math.round(el.data.score / 2) : Math.round((el.data.score * el.data.upvote_ratio) / (2 * el.data.upvote_ratio - 1))) - el.data.score;
    }
  })
}

function convert_userinfo_csv(data) {
  const arr = ['author,post_count,num_comments,total_upvotes,total_downvotes'];

  for (const [key, value] of Object.entries(data)) {
    arr.push(key + ',' + value.post_count + ',' + value.num_comments + ',' + value.total_upvotes + ',' + value.total_downvotes)
  }
  const str = arr.join('\n')
  writeFileSync('userreport.csv', str)
}

function word_frequency_sentiment_by_user(data, user_likes, words) {
  user_likes['___words___'] = {}

  for (const post of data) {
    let author = post.data.author;
    const text = post.data.title + post.data.selftext;
    const doc = nlp.readDoc(text);
    const frequency_table = doc.tokens()
      .filter((e) => (!e.out(its.stopWordFlag) && (e.out(its.type) == 'word')))
      .out(its.lemma, as.freqTable);
    // console.log(frequency_table)
    // console.log(doc.out(its.sentiment))

    if (!user_likes[author]['___words___']) {
      user_likes[author]['___words___'] = {};
    }

    for (const [word, frequency] of frequency_table) {
      if (!words[word]) {
        words[word] = {};
        words[word]['count'] = frequency
        words[word]['total_upvotes'] = post.data.score == 0 && post.data.upvote_ratio == 0.5 ? 0 : post.data.score == 0 ? 0 : post.data.ratio == 0.5 ? Math.round(post.data.score / 2) : Math.round((post.data.score * post.data.upvote_ratio) / (2 * post.data.upvote_ratio - 1));
        words[word]['total_downvotes'] = post.data.score == 0 && post.data.upvote_ratio == 0.5 ? 0 : (post.data.ratio == 0.5 ? Math.round(post.data.score / 2) : Math.round((post.data.score * post.data.upvote_ratio) / (2 * post.data.upvote_ratio - 1))) - post.data.score;
        words[word]['num_comments'] = post.data.num_comments;
        words[word]['post_count'] = 1;
        words[word]['positive_sent_freq'] = 0;
        words[word]['neutral_sent_freq'] = 0;
        words[word]['negative_sent_freq'] = 0;
      } else {
        words[word].count += frequency
        words[word].total_upvotes += post.data.score == 0 && post.data.upvote_ratio == 0.5 ? 0 : post.data.score == 0 ? 0 : post.data.ratio == 0.5 ? Math.round(post.data.score / 2) : Math.round((post.data.score * post.data.upvote_ratio) / (2 * post.data.upvote_ratio - 1));
        words[word].total_downvotes += post.data.score == 0 && post.data.upvote_ratio == 0.5 ? 0 : (post.data.ratio == 0.5 ? Math.round(post.data.score / 2) : Math.round((post.data.score * post.data.upvote_ratio) / (2 * post.data.upvote_ratio - 1))) - post.data.score;
        words[word].num_comments += post.data.num_comments;
        words[word].post_count += 1;
      }
      if (!user_likes['___words___'][word]) {
        user_likes['___words___'][word] = { ...words[word], 'authors': [author] };
      } else {
        Object.entries(words[word]).forEach(([key, value]) => {
          if (key != 'authors') {
            user_likes['___words___'][word][key] += value;
          }
        })
        if (!user_likes['___words___'][word].authors.includes(author)) {
          user_likes['___words___'][word].authors.push(author);
        }
      }

      if (!user_likes[author]['___words___'][word]) {
        user_likes[author]['___words___'][word] = { ...words[word] }
      } else {
        Object.entries(words[word]).forEach(([key, value]) => {
          user_likes[author]['___words___'][word] += value;
        })
      }
    }


    const Sentiment_categorization_boundary = .3;
    doc.sentences().each((sentence) => {
      const sentiment = sentence.out(its.sentiment);
      // console.log(`The following sentence is given a sentiment of ${sentiment}` + sentence.out())
      const frequency_table = sentence.tokens()
        .filter((e) => (!e.out(its.stopWordFlag) && (e.out(its.type) == 'word')))
        .out(its.lemma, as.freqTable);

      for (const [word, frequency] of frequency_table) {
        if (sentiment > Sentiment_categorization_boundary) {
          words[word].positive_sent_freq += frequency;
        } else if (sentiment < -Sentiment_categorization_boundary) {
          words[word].negative_sent_freq += frequency;
        } else {
          words[word].neutral_sent_freq += frequency;
        }
      }
    });
  }
  //console.log(words)

  const arr = ['word, frequency, post_count,total_upvotes,total_downvotes,comments,neg_sent_freq,pos_sent_freq,neu_sent_freq'];

  for (const [key, value] of Object.entries(words)) {
    arr.push(key + ',' + value.count + ',' + value.post_count + ',' + value.total_upvotes + ',' + value.total_downvotes + ',' + value.num_comments + ',' + value.negative_sent_freq + ',' + value.positive_sent_freq + ',' + value.neutral_sent_freq)
  }
  const str = arr.join('\n')
  writeFileSync('wordreport.csv', str)
}

function calculate_metrics(data) {
  const user_summaries = {};
  const word_summaries = {};
  const post_embedding_performance = {};
  const subreddit_summary = {}
  for (const post of data) {
    const post_metrics = calculate_post_metrics(post);
    const comment_metrics = calculate_comment_metrics(post.comments);
    reduce_post(post_metrics, user_summaries, word_summaries, post_embedding_performance, subreddit_summary);
    reduce_comments(comment_metrics, user_summaries, word_summaries, post_embedding_performance, subreddit_summary);
  }
  return { user_summaries, word_summaries, post_embedding_performance, subreddit_summary }
}

function calculate_post_metrics(post) {
  const post_metrics = {};
  post_metrics.num_comments = post.data.num_comments;
  post_metrics.total_upvotes = post.data.score == 0 && post.data.upvote_ratio == 0.5 ? 0 : post.data.ratio == 0.5 ? Math.round(post.data.score / 2) : Math.round((post.data.score * post.data.upvote_ratio) / (2 * post.data.upvote_ratio - 1));
  post_metrics.total_downvotes = post.data.score == 0 && post.data.upvote_ratio == 0.5 ? 0 : (post.data.ratio == 0.5 ? Math.round(post.data.score / 2) : Math.round((post.data.score * post.data.upvote_ratio) / (2 * post.data.upvote_ratio - 1))) - post.data.score;
  post_metrics.author = post.data.author;
  const text = post.data.title + " " + post.data.selftext;
  const doc = nlp.readDoc(text);
  post_metrics.frequency_table = doc.tokens()
    .filter((e) => (!e.out(its.stopWordFlag) && (e.out(its.type) == 'word')))
    .out(its.lemma, as.freqTable);
  post_metrics.sentiment = await sentiment(text);
  post_metrics.id = post.data.id;
  post_metrics.embeddings = embeddings(text);
}
function calculate_comment_metrics(comments) {
  let comments_metrics = [];
  for (const comment of comments) {
    calculate_comment_metrics_tree_flatten(comment_metrics, comment)
  }
  return comments_metrics;
}
function calculate_comment_metrics_tree_flatten(comments_metrics, comment, post_id,) {
  const comment_metrics = {};
  comment_metrics.id = comment.data.id;
  comment_metrics.post_id = post_id == undefined ? comment.data.parent_id : post_id;
  comment_metrics.author = comment.data.author;
  comment_metrics.embeddings = embeddings(comment.data.body)
  comment_metrics.sentiment = sentiment(comment.data.body);
  comment_metrics.frequency_table = nlp.readDoc(text).tokens()
    .filter((e) => (!e.out(its.stopWordFlag) && (e.out(its.type) == 'word')))
    .out(its.lemma, as.freqTable);
  comment_metrics.replied_to = comment.data.parent_id;
  comment_metrics.direct_reply_count = comment.data.replies.data.children.length;
  comment_metrics.score = comment.data.score;
  comment_metrics.upvotes = comment.data.ups;
  comment_metrics.rough_fuzzed_controversy = Math.log(comment.data.ups) - Math.log(comment.data.score);

  comment.data.replies.data.children.forEach((child) => calculate_comment_metrics_tree_flatten(comment_metrics, child, comment_metrics.post_id))
  comments_metrics.push(comment_metrics);
}
function reduce_post(post_metrics, user_summaries, word_summaries, post_embedding_performance, subreddit_summary) { }
function reduce_comments(comment_metrics, user_summaries, word_summaries, post_embedding_performance, subreddit_summary) { }