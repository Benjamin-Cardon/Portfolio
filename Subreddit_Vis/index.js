import axios from "axios";
import 'dotenv/config';
import { readFileSync, writeFileSync } from "fs";
// Get token

function get_and_save_auth_token(token) {
  let tokenresponse = axios.post("https://www.reddit.com/api/v1/access_token", `grant_type=password&username=${process.env.REDDIT_USERNAME}&password=${process.env.REDDIT_PASSWORD}`, {
    auth: { username: process.env.REDDIT_CLIENTID, password: process.env.REDDIT_SECRET },
    headers: { "User-Agent": "web:social-graph-analysis-visualization:v1.0.0 (by /u/AppropriateTap826)", "Content-Type": "application/x-www-form-urlencoded" }
  })

  tokenresponse.then(function (response) {
    const expiration_date = Math.floor(Date.now() / 1000) + response.data.expires_in;
    token = response.data.access_token;
    writeFileSync('token.txt', expiration_date + ":::" + token);
  });
}

function check_auth_token_expired(token) {
  const tokenfile = readFileSync('token.txt', 'utf-8').split(':::')
  if (Number(tokenfile[0]) < ((Date.now() / 1000) - 60)) {
    get_and_save_auth_token(token)
    console.log("Token Expired")
  }
  else {
    console.log("Token Still Good")
    token = tokenfile[1];
  }
}

function main() {
  let token;
  check_auth_token_expired(token);
}

main();
// read token.txt.
// if the expiration date is later than now- we will request a new token.
//  When we request the new token, we will..
//  calculate a new expiration date- date now + time in seconds.
//  overwrite the file with the new expirationdate and time in seconds.
// else, we will retrieve the old token.
