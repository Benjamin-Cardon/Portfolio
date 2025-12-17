async function check_subreddit_public_sfw_exists(headers, subreddit, subreddit_does_not_exist = false, subreddit_private = false) {
  try {
    const { requests_remaining, ms_remaining } = get_request_rates()
    if (requests_remaining === 0) {
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