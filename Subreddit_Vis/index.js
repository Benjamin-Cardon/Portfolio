import axios from "axios";
import 'dotenv/config';
import { readFileSync, writeFileSync } from "fs";
// Load wink-nlp package
import winkNLP from 'wink-nlp';

// Load English language model
import model from 'wink-eng-lite-web-model';

// Get token
const nlp = winkNLP(model);
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

  let data = [];
  await get_posts_until(headers, subreddit, data, 5000)
  let user_likes = {}
  count_user_votes(data, user_likes)
  // convert_userinfo_csv(user_likes)
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
// type. Current options
//Count- How many posts we will request until
// Timeprev- unixtime period
async function get_posts_until(headers, subreddit, data, count,) {
  const limit = 100;
  let after = null;
  const params = { limit };

  while (data.length < count) {
    try {
      if (after) params.after = after;
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
  console.log(data.length)
}


function convert_userinfo_csv(data) {
  const arr = ['author,post_count,num_comments,total_upvotes,total_downvotes'];

  for (const [key, value] of Object.entries(data)) {
    arr.push(key + ',' + value.post_count + ',' + value.num_comments + ',' + value.total_upvotes + ',' + value.total_downvotes)
  }
  const str = arr.join('\n')
  writeFileSync('userreport.csv', str)
}
// https://oauth.reddit.com/r/${subreddit}/new

// read token.txt.
// if the expiration date is later than now- we will request a new token.
//  When we request the new token, we will..
//  calculate a new expiration date- date now + time in seconds.
//  overwrite the file with the new expirationdate and time in seconds.
// else, we will retrieve the old token.
// Notes on the API: When we request  at the current point, we're given the 25 most recent posts, with the ID of the post directly after them. We can use that ID to make multiple calls if we want to.
//>>> submission = reddit.submission("nej10s")
// >>> ratio = submission.upvote_ratio
// >>> ups = round((ratio*submission.score)/(2*ratio - 1)) if ratio != 0.5 else round(submission.score/2)
// >>> downs = ups - submission.score
// >>> ups,downs
// 2 1

// let request_instance = axios.get(`https://oauth.reddit.com/r/${subreddit}/new`, {
//   headers
// })
// request_instance.then((response) => {
//   const children = response.data.data.children
//   console.log(children[children.length - 1])
//   // let post_ID = response.data.data.children[0].data.id;
//   // let commentTreeRequest = axios.get(`https://oauth.reddit.com/r/${subreddit}/comments/${post_ID}`, { headers })
//   // commentTreeRequest.then((response) => {
//   //   for (let i = 0; i < response.data.length; i++) {
//   //     console.log(response.data[i]);
//   //   }
//   // })
// })