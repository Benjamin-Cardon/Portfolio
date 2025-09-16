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

function main() {
  let tokenholder = { token: "" };
  check_auth_token_expired(tokenholder);

  let subreddit = 'datascience';
  const headers = {
    "User-Agent": "web:social-graph-analysis-visualization:v1.0.0 (by /u/AppropriateTap826)", Authorization: `Bearer ${tokenholder.token}`,
  }

  let data = [];
  get_posts_until(headers, subreddit, data, 100).then(() => {
    let user_likes = {}
    data.forEach((el, ind, arr) => {
      if (user_likes[el.data.author] == undefined) {
        user_likes[el.data.author] = {
          post_count: 1,
          num_comments: el.data.num_comments,
          total_upvotes: el.data.ratio == 0.5 ? Math.round(el.data.score / 2) : Math.round((el.data.score * el.data.upvote_ratio) / (2 * el.data.upvote_ratio - 1)),
          total_downvotes: (el.data.ratio == 0.5 ? Math.round(el.data.score / 2) : Math.round((el.data.score * el.data.upvote_ratio) / (2 * el.data.upvote_ratio - 1))) - el.data.score,
        }
      } else {
        user_likes[el.data.author].post_count += 1;
        user_likes[el.data.author].num_comments += el.data.num_comments;
        user_likes[el.data.author].total_upvotes += el.data.ratio == 0.5 ? Math.round(el.data.score / 2) : Math.round((el.data.score * el.data.upvote_ratio) / (2 * el.data.upvote_ratio - 1));
        user_likes[el.data.author].total_downvotes += (el.data.ratio == 0.5 ? Math.round(el.data.score / 2) : Math.round((el.data.score * el.data.upvote_ratio) / (2 * el.data.upvote_ratio - 1))) - el.data.score;
      }
    })
    console.log(user_likes)
  })


}

async function check_auth_token_expired(tokenholder) {
  const tokenfile = readFileSync('token.txt', 'utf-8').split(':::')
  if (Number(tokenfile[0]) < ((Date.now() / 1000) - 60)) {
    await get_and_save_auth_token(tokenholder)
    console.log("Token Expired")
  }
  else {
    console.log("Token Still Good")
    tokenholder.token = tokenfile[1];
  }

}

async function get_and_save_auth_token(tokenholder) {
  let tokenresponse = axios.post("https://www.reddit.com/api/v1/access_token", `grant_type=password&username=${process.env.REDDIT_USERNAME}&password=${process.env.REDDIT_PASSWORD}`, {
    auth: { username: process.env.REDDIT_CLIENTID, password: process.env.REDDIT_SECRET },
    headers: { "User-Agent": "web:social-graph-analysis-visualization:v1.0.0 (by /u/AppropriateTap826)", "Content-Type": "application/x-www-form-urlencoded" }
  })
  tokenresponse.then(function (response) {
    const expiration_date = Math.floor(Date.now() / 1000) + response.data.expires_in;
    tokenholder.token = response.data.access_token;
    writeFileSync('token.txt', expiration_date + ":::" + tokenholder.token);
  });
  await Promise.resolve(tokenresponse);
}
// type. Current options
//Count- How many posts we will request until
// Timeprev- unixtime period
async function get_posts_until(headers, subreddit, data, count, before) {
  const limit = 100;
  // TODO: Add error checking. Since this will be production, consider typescript? For now- that's too much.
  if (data.length == count) {
    console.log(data.length)
    return;
  }
  const params = {
    limit,
  }
  if (before != undefined) {
    params.before = before;
  }
  let request_instance = axios.get(`https://oauth.reddit.com/r/${subreddit}/new`, {
    headers, params
  })
  await request_instance.then((response) => {
    let children = response.data.data.children;
    data.push(...children)
    // oh my god it hurts it hurts so fucking bad.
    // we'll have to measure the efficiency of this code.
    if (children.length < limit || response.data.data.after === null) {
      return;
    }
    if (children.length >= count) {
      return;
    } else {
      before = children[children.length - 1].data.id;
      setTimeout(() => {
        console.log("Sleep one second");
      }, 1000);
      get_posts_until(headers, subreddit, data, count, before)
    }
  })

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