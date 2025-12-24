import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync } from 'fs'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

class RedditAPIError extends Error {
  constructor(code, message, meta = {}) {
    super(message);
    this.name = "RedditAPIError";
    this.code = code;      // e.g. "AUTH_FAILED", "RATE_LIMIT", "NETWORK"
    this.meta = meta;      // optional extra info (status, url, etc.)
  }
}

export default class RedditAPIManager {
  constructor({ subreddit, isCount, isFull, count, isBurstEnd, isBurstSleep }) {
    this.subreddit = subreddit;
    this.isCount = isCount;
    this.isFull = isFull;
    this.count = count;
    this.isBurstEnd = isBurstEnd;
    this.isBurstSleep = isBurstSleep;
    this.errorState = 0
    this.error = null;
  }

  static async create({ subreddit, isCount, isFull, count, isBurstEnd, isBurstSleep, }) {
    const manager = new RedditAPIManager({ subreddit, isCount, isFull, count, isBurstEnd, isBurstSleep, token: null });
    await manager.init();
    return manager;
  }

  async init() {
    this.token = this.check_auth_token_expired();
    if (!this.token) {
      const [token, expires_in] = await this.get_auth_token()
      this.token = token
      this.save_auth_token(expires_in, token)
    }
    const ok = await this.check_subreddit_public_sfw_exists()
    return ok;
  }

  save_auth_token(expires_in, token) {
    const expiration_date = Math.floor(Date.now() / 1000) + expires_in;
    writeFileSync('token.txt', expiration_date + ":::" + token);
  }

  async get_auth_token() {
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
      return [response.data.access_token, response.data.expires_in]
    } catch (err) {
      this.errorState = err.response.status;
      this.error = err;
      throw new RedditAPIError("AUTH_FAILED", "Failed to get new token", {
        status: err.response?.status,
        data: err.response?.data,
      });
    }
  }

  check_auth_token_expired() {
    try {
      const tokenfile = readFileSync('token.txt', 'utf-8').split(':::');
      const expiration = Number(tokenfile[0]);

      if (expiration < ((Date.now() / 1000) - 60)) {
        return ""
      } else {
        return tokenfile[1];
      }
    }
    catch (err) {
      return ""
    }
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  check_request_count(proposed_requests) {
    return proposed_requests < (this.get_request_rates().requests_remaining);
  }

  get_request_rates() {
    let request_summary = this.trim_request_log(readFileSync('./reddit/requestlog.txt', 'utf-8').split(',')).reduce((accumulator, current) => {
      const [count, time] = current.split(':')
      accumulator.requests_used += Number(count)
      accumulator.earliest_request = Math.min(Number(time), accumulator.earliest_request);
      return accumulator;
    }, { requests_used: 0, earliest_request: Date.now() });

    return {
      requests_used: request_summary.requests_used,
      requests_remaining: 1000 - request_summary.requests_used,
      window_ends_at: request_summary.earliest_request + 600000,
      ms_remaining: request_summary.earliest_request + 600000 - Date.now()
    }
  }

  log_request_count(request_count) {
    let log = this.trim_request_log(readFileSync('./reddit/requestlog.txt', 'utf-8').split(','));
    log.push(`${request_count}:${Date.now()}`)
    writeFileSync('./reddit/requestlog.txt', log.join(','));
  }

  trim_request_log(log) {
    return log.filter((x) => x.split(':')[1] > Date.now() - 600000)
  }

  async check_subreddit_public_sfw_exists() {
    try {
      const { requests_remaining, ms_remaining } = this.get_request_rates()
      if (requests_remaining === 0) {
        this.error = new SubredditAPIError("Init_failed", "Tried to initialize with no requests available ", { ms_remaining })
        this.errorState = 1
        throw this.error;
      }

      const headers = {
        "User-Agent": "web:social-graph-analysis-visualization:v1.0.0 (by /u/AppropriateTap826)",
        Authorization: `Bearer ${this.token}`,
      };
      this.headers = headers

      const response = await axios.get(`https://oauth.reddit.com/r/${this.subreddit}/about`, {
        headers,
      })
      this.log_request_count(1);

      if (response.data.data.subreddit_type == undefined && response.data.data.over18 == undefined) {
        this.error = new SubredditAPIError("Subreddit_Error", "Subreddit Does not exist", {})
        this.errorState = 1
        throw this.error;
      }

      return response.data.data.subreddit_type == 'public' && !response.data.data.over18;
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      if (status == 400) {
        this.error = new SubredditAPIError("Axios_Error", "", { status, data })
        this.errorState = 1
        return false;
      } else if (status == 401) {
        this.error = new SubredditAPIError("Authorization_Error", "", { status, data })
        this.errorState = 1
        return false;
      } else if (status == 403) {
        this.error = new SubredditAPIError("Private_Subreddit", "", { status, data })
        this.errorState = 1
        return false;
      } else if (status == 404) {
        this.error = new SubredditAPIError("Subreddit_DoesNotExist", "", { status, data })
        this.errorState = 1
        return false;
      } else {
        return false;
      }
    }
  }

  async get_posts() {
    let request_count = 0;
    const limit = 100;
    let after = null;
    const params = { limit };
    const posts = []

    while (posts.length < this.count) {
      let { requests_remaining, ms_remaining } = await this.get_request_rates()

      if (requests_remaining === 0) {
        if (this.isFull || (this.isCount && this.isBurstSleep)) {
          if (request_count > 0) {
            this.log_request_count(request_count)
            request_count = 0;
          }
          await this.sleep(ms_remaining + 100)
          continue
        }
        if (this.isCount && this.isBurstEnd) {
          if (request_count > 0) {
            this.log_request_count(request_count)
            request_count = 0
          }
          break
        }
      }

      if (after) params.after = after;
      request_count++;

      const response = await axios.get(`https://oauth.reddit.com/r/${this.subreddit}/new`, {
        headers: this.headers, params
      })

      const children = response.data.data.children;
      if (!children || children.length === 0) break;

      posts.push(...children)
      after = response.data.data.after;

      if (!after) break;

      if (this.isFull) {
        if (request_count % 50 == 0) {
          this.log_request_count(request_count)
          request_count = 0;
        }
        await this.sleep((ms_remaining / requests_remaining ?? 1));
      } else if (this.isCount && this.isBurstSleep) {
        if (request_count >= requests_remaining) {
          this.log_request_count(request_count);
          request_count = 0;
          await this.sleep(ms_remaining + 100);
        }
      }
    }

    if (posts.length > this.count) {
      posts.length = this.count;
    }

    if (request_count > 0) {
      this.log_request_count(request_count)
    }

    return posts
  }

  async get_comments_for_posts(posts) {
    const postRequests = [];
    const more_nodes_request_queue = [];
    const postMap = new Map();
    const commentMap = new Map();
    let request_count = 0
    let { requests_remaining, ms_remaining } = this.get_request_rates();

    // see if we have enough requests to get all the posts:
    let isEnded = false;
    for (const post of posts) {
      const postId = post.data.name;
      postMap.set(postId, post);
      if (requests_remaining === 0) {
        if (this.isFull) {
          if (request_count > 0) {
            this.log_request_count(request_count)
            request_count = 0;
          }
          await this.sleep(ms_remaining + 100);
          ({ requests_remaining, ms_remaining } = this.get_request_rates());
        } else if (this.isCount && this.isBurstSleep) {
          if (request_count > 0) {
            this.log_request_count(request_count);
            request_count = 0;
          }
          await this.sleep(ms_remaining + 100);
          ({ requests_remaining, ms_remaining } = this.get_request_rates());
        } else {
          isEnded = true;
          post.comments = [];
          continue;
        }
      }

      if ((!post.data.num_comments) || isEnded) {
        post.comments = [];
        continue;
      }

      request_count++;
      requests_remaining--;

      postRequests.push(axios
        .get(`https://oauth.reddit.com/comments/${postId.slice(3)}?depth=10&limit=500`, { headers: this.headers })
        .then((res) => {
          // As soon as this one resolves, attach the comments to the post
          const children = res.data[1].data.children;
          post.comments = children;
        })
        .catch((err) => {
          console.error(`Failed to load comments for post ${postId}`, err);
        })
      );

      if (this.isFull && request_count % 50 === 0) {
        this.log_request_count(request_count);
        request_count = 0;
        ({ requests_remaining, ms_remaining } = this.get_request_rates());
      }

      if (this.isFull) {
        const delay = ms_remaining / Math.max(requests_remaining, 1);
        await this.sleep(delay);
      } else if (this.isCount && this.isBurstSleep) {
        if (request_count >= requests_remaining) {
          this.log_request_count(request_count);
          request_count = 0
          await this.sleep(ms_remaining + 100)
            ({ requests_remaining, ms_remaining } = this.get_request_rates());
        }
      }
    }
    if (this.request_count > 0) {
      this.log_request_count(request_count);
      request_count = 0;
    }


    await Promise.all(postRequests);

    for (const post of posts) {
      this.process_comment_tree_into_map_and_queue(post, commentMap, more_nodes_request_queue, post.data.name);
    }

    ({ requests_remaining, ms_remaining } = this.get_request_rates());

    while (more_nodes_request_queue.length && !isEnded) {

      if (requests_remaining === 0) {
        if (this.isFull) {
          await this.sleep(ms_remaining + 100);
          ({ requests_remaining, ms_remaining } = this.get_request_rates());
        } else if (this.isCount && this.isBurstEnd) {
          isEnded = true;
          continue;
        } else if (this.isCount && this.isBurstSleep) {
          if (request_count > 0) {
            this.log_request_count(request_count);
            request_count = 0;
          }
          await this.sleep(ms_remaining + 100);
          ({ requests_remaining, ms_remaining } = this.get_request_rates());
        }
      }

      requests_remaining--;
      request_count++;

      const req = more_nodes_request_queue.shift();
      const { parentNode, childrenIds } = req;
      // console.log(req)
      const url = `https://oauth.reddit.com/api/morechildren?api_type=json&raw_json=1&link_id=${req.postId}&children=${childrenIds.join(",")}`;
      try {
        const res = await axios.get(url, { headers: this.headers });
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
            postMap.get(child.data.parent_id).comments.push(child);
          } else if (child.data.parent_id.slice(0, 2) == 't1') {
            const parentComment = commentMap.get(child.data.parent_id);
            if (parentComment.data.replies === "") {
              parentComment.data.replies = {
                kind: "Listing",
                data: { children: [child] },
              };
            } else if (parentComment.data.replies?.data?.children) {
              parentComment.data.replies.data.children.push(child);
            } else {
              // Fallback: if replies got into some weird shape, normalize
              parentComment.data.replies = {
                kind: "Listing",
                data: { children: [child] },
              };
            }
          }
        })
        if (this.isFull) { await sleep(ms_remaining / Math.max(requests_remaining, 1)); }
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
    this.log_request_count(request_count);
    return { commentMap, postMap }
  }

  process_comment_tree_into_map_and_queue(rootNode, commentMap, more_nodes_request_queue, postId) {
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

      }
    }
  }
}





