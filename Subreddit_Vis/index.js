import axios from "axios";
import 'dotenv/config';
// Get token
let tokenresponse = axios.post("https://www.reddit.com/api/v1/access_token", `grant_type=password&username=${process.env.REDDIT_USERNAME}&password=${process.env.REDDIT_PASSWORD}`, {

  auth: { username: process.env.REDDIT_CLIENTID, password: process.env.REDDIT_SECRET },
  headers: { "User-Agent": "web:social-graph-analysis-visualization:v1.0.0 (by /u/AppropriateTap826)", "Content-Type": "application/x-www-form-urlencoded" }
}
)
tokenresponse.then(function (response) {
  console.log(response.data);
  console.log(response.status);
  console.log(response.statusText);
  // console.log(response.headers);
  // console.log(response.config);
});
