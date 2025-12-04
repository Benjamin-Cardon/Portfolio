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