import axios from "axios";
import path from "path";
import { readFileSync, writeFileSync, existsSync } from 'fs'
export default class RedditAPIManager {
  constructor({ subreddit, isCount, isFull, count, isBurstEnd, isBurstSleep }, logger, TokenManager) {
    this.subreddit = subreddit;
    this.isCount = isCount;
    this.isFull = isFull;
    this.count = count;
    this.isBurstEnd = isBurstEnd;
    this.isBurstSleep = isBurstSleep;
    this.logger = logger;
    this.posts = [];
    this.postMap = new Map();
    this.commentMap = new Map();
    this.requests_remaining = 0;
    this.requests_made = 0;
    this.unlogged_requests = 0;
    this.ms_remaining = 0;
    this.window_ends_at = 0;
    this.end_requests = false;
    this.errors = []
    this.tokenManager = TokenManager;
  }


  async check_subreddit_public_sfw_exists() {
    try {
      this.get_request_rates()
      if (this.requests_remaining == 0) {
        if (this.isFull || this.isBurstSleep) {
          await this.sleep(this.ms_remaining + 100)
          this.get_request_rates()
        }
        else {
          this.errors.push({
            level: "fatal",
            stage: 'API Init',
            info: "Attempted to run process in end mode with no requests.",
            err: null
          })
          return { ok: false, requests_made: this.requests_made, errors: this.errors };
        }
      }
      this.increment_requests()
      this.log_request_count()

      const response = await axios.get(`https://oauth.reddit.com/r/${this.subreddit}/about`, {
        headers: await this.tokenManager.get_headers(),
      })

      if (response.data.data.over18) {
        this.errors.push({
          level: "fatal",
          stage: 'API Init',
          info: "This subreddit is marked NSFW. I suppose you can remove the code to block this if you'd like, but I wrote this assuming the tool would be used in a work context",
          err: null
        })
        return { ok: false, requests_made: this.requests_made, errors: this.errors }
      }

      return { ok: true, requests_made: this.requests_made, errors: this.errors };
    } catch (err) {
      const status = err.response?.status;
      if (status == 400) {
        this.errors.push({
          level: "fatal",
          stage: 'API Init:Authorization',
          info: "Axios Error",
          err
        })
        return { ok: false, requests_made: this.requests_made, errors: this.errors };
      } else if (status == 401) {
        this.errors.push({
          level: "fatal",
          stage: 'API Init',
          info: "Authorization Error",
          err
        })
        return { ok: false, requests_made: this.requests_made, errors: this.errors };
      } else if (status == 403) {
        this.errors.push({
          level: "fatal",
          stage: 'API Init',
          info: "Private Subreddit",
          err
        })
        return { ok: false, requests_made: this.requests_made, errors: this.errors };
      } else if (status == 404) {
        this.errors.push({
          level: "fatal",
          stage: 'API Init',
          info: "Subreddit Does Not Exist",
          err
        })
        return { ok: false, requests_made: this.requests_made, errors: this.errors };
      } else {
        this.errors.push({
          level: "fatal",
          stage: 'API Init',
          info: "General API Init failure",
          err
        })
        return { ok: false, requests_made: this.requests_made, errors: this.errors };
      }
    }
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  get_request_rates() {
    let rawLog = "";
    try {
      rawLog = readFileSync('./api/requestlog.txt', 'utf-8');
    } catch (err) {
      const normalizedError = {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
      };
      this.errors.push({
        level: "warning",
        stage: "api",
        info: "Issue when trying to read the request log. It may be that it simply does not exist, in which case, no worries, it'll be produced by running the file.",
        normalizedError
      })
      rawLog = "";
    }
    let request_summary = this.trim_request_log(rawLog.split(',')).reduce((accumulator, current) => {
      const [count, time] = current.split(':')
      accumulator.requests_used += Number(count)
      accumulator.earliest_request = Math.min(Number(time), accumulator.earliest_request);
      return accumulator;
    }, { requests_used: 0, earliest_request: Date.now() });
    this.requests_remaining = 999 - request_summary.requests_used;
    this.window_ends_at = request_summary.earliest_request + 600000;
    this.ms_remaining = request_summary.earliest_request + 600000 - Date.now();
    if (request_summary.requests_used === 0) {
      this.ms_remaining = 1;
    }
    this.logger.log(
      'debug',
      `request rates: used=${request_summary.requests_used}, ` +
      `remaining=${this.requests_remaining}, ` +
      `ms_remaining=${this.ms_remaining}`
    );
  }

  log_request_count() {
    if (this.unlogged_requests == 0) return;
    let rawLog = "";
    try {
      rawLog = readFileSync('./api/requestlog.txt', 'utf-8');
    } catch (err) {
      const normalizedError = {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
      };
      this.errors.push({
        level: "warning",
        stage: "api",
        info: "Issue when trying to read the request log. It may be that it simply does not exist, in which case, no worries, it'll be produced by running the file.",
        normalizedError
      })
      rawLog = "";
    }
    let log = this.trim_request_log(rawLog.split(','));
    log.push(`${this.unlogged_requests}:${Date.now()}`)
    writeFileSync('./api/requestlog.txt', log.join(','));
    this.logger.log(
      'debug',
      `Logged ${this.unlogged_requests} requests to requestlog.txt`
    );
    this.unlogged_requests = 0;
  }

  trim_request_log(log) {
    return log.filter((x) => x.split(':')[1] > Date.now() - 600000)
  }

  async sleep_until_refresh_if_appropriate() {
    if (this.requests_remaining <= this.unlogged_requests && (this.isFull || (this.isCount && this.isBurstSleep))) {
      this.logger.log('info', `Ran out of requests. Rate limiting for ${(this.ms_remaining + 100) / 60000} minutes until more requests are avaiable.`)
      this.logger.log(
        'debug',
        `Rate limit hit; sleeping ${this.ms_remaining + 100}ms ` +
        `(requests_remaining=${this.requests_remaining}, unlogged=${this.unlogged_requests})`
      );
      this.log_request_count()
      await this.sleep(this.ms_remaining + 100)
      this.get_request_rates()
    }
  }

  increment_requests() {
    this.unlogged_requests++;
    this.requests_made++;
  }

  async pace_requests_if_appropriate() {
    if (this.isFull) {
      const delay = this.ms_remaining / Math.max(this.requests_remaining, 1);
      await this.sleep(delay);
    }
  }

  check_end() {
    if ((this.requests_remaining <= this.unlogged_requests && this.isCount && this.isBurstEnd) || this.end_requests) {
      this.log_request_count()
      if (this.end_requests === false) {
        this.logger.log(
          'debug',
          `Ending requests early: requests_remaining=${this.requests_remaining}, unlogged=${this.unlogged_requests}, end_requests=${this.end_requests}`
        );
      }
      this.end_requests = true;
      return true;
    }
    return false;
  }

  async get_posts() {
    try {
      this.logger.log(
        'debug',
        `get_posts: target_count=${this.count}, mode={isFull:${this.isFull}, isCount:${this.isCount}, isBurstEnd:${this.isBurstEnd}, isBurstSleep:${this.isBurstSleep}}`
      );
      const limit = 100;
      let after = null;
      const params = { limit };
      this.get_request_rates()

      while (this.posts.length < this.count) {
        await this.sleep_until_refresh_if_appropriate();
        if (this.check_end()) {
          break;
        }

        if (after) params.after = after;
        this.increment_requests()
        this.logger.log(
          'debug',
          `get_posts loop: current_posts=${this.posts.length}, after=${after}, requests_remaining=${this.requests_remaining}, unlogged=${this.unlogged_requests}`
        );
        const response = await axios.get(`https://oauth.reddit.com/r/${this.subreddit}/new`, {
          headers: await this.tokenManager.get_headers(), params
        })

        const children = response.data.data.children;
        if (!children || children.length === 0) break;

        this.posts.push(...children)
        after = response.data.data.after;

        this.logger.log(
          'debug',
          `Fetched posts page: children=${children.length}, total_posts=${this.posts.length}, after=${after}`
        );

        if (!after) {
          this.logger.log('debug', 'Breaking out of get_posts: no more pages / reached count');
          break;
        }

        if (this.isFull) {
          if (this.unlogged_requests % 50 == 0) {
            this.log_request_count();
            this.get_request_rates();
          }
          await this.pace_requests_if_appropriate()
        }
      }

      if (this.posts.length > this.count) {
        this.posts.length = this.count;
      }
      this.log_request_count()
    } catch (err) {
      const normalizedError = {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
      };
      this.errors.push({
        level: 'fatal',
        stage: 'Get Posts',
        info: "Unknown Error",
        normalizedError
      })
      return { ok: false, posts: this.posts.length, requests_made: this.requests_made, errors: this.errors }
    }
    return { ok: true, posts: this.posts.length, requests_made: this.requests_made, errors: this.errors }
  }

  async get_comments_for_posts() {
    try {
      this.logger.log(
        'debug',
        `get_comments_for_posts: posts=${this.posts.length}`
      );
      const postRequests = [];
      const more_nodes_request_queue = [];
      this.log_request_count()
      this.get_request_rates();

      // see if we have enough requests to get all the posts:
      for (const post of this.posts) {
        const postId = post.data.name;
        this.postMap.set(postId, post);
        await this.sleep_until_refresh_if_appropriate();

        if (this.check_end()) {
          post.comments = [];
          continue;
        }

        if ((!post.data.num_comments)) {
          post.comments = [];
          continue;
        }

        this.increment_requests()
        this.logger.log(
          'debug',
          `Fetching comments for post=${postId}, num_comments=${post.data.num_comments}`
        );
        postRequests.push(axios
          .get(`https://oauth.reddit.com/comments/${postId.slice(3)}?depth=10&limit=500`, { headers: await this.tokenManager.get_headers() })
          .then((res) => {
            // As soon as this one resolves, attach the comments to the post
            const children = res.data[1].data.children;
            post.comments = children;
          })
          .catch((err) => {
            console.error(`Failed to load comments for post ${postId}`, err);
          })
        );

        if (postRequests.length % 100 == 0) {
          this.logger.log(`info`, `Made ${postRequests.length} requests for comments on posts.`);
        }

        if (this.isFull && this.unlogged_requests % 50 === 0) {
          this.log_request_count();
          this.get_request_rates();
        }
        await this.pace_requests_if_appropriate()
      }

      this.log_request_count();
      this.logger.log('info', `Made total of ${postRequests.length} requests for comments on posts.`)
      await Promise.all(postRequests);

      for (const post of this.posts) {
        this.process_comment_tree_into_map_and_queue(post, more_nodes_request_queue, post.data.name);
      }

      this.get_request_rates()
      while (more_nodes_request_queue.length && !this.check_end()) {
        await this.sleep_until_refresh_if_appropriate();
        this.increment_requests();
        this.logger.log(
          'debug',
          `more_children loop: queue_len=${more_nodes_request_queue.length}, ` +
          `requests_remaining=${this.requests_remaining}, unlogged=${this.unlogged_requests}`
        );
        const req = more_nodes_request_queue.shift();
        const { parentNode, childrenIds } = req;
        const url = `https://oauth.reddit.com/api/morechildren?api_type=json&raw_json=1&link_id=${req.postId}&children=${childrenIds.join(",")}`;
        const res = await axios.get(url, { headers: await this.tokenManager.get_headers() });
        const newChildren = res.data.json.data.things; // array of 't1' comments
        for (const child of newChildren) {
          if (child.kind == 'more') {
            more_nodes_request_queue.push({
              parentNode: parentNode,  // direct reference
              postId: req.postId,
              childrenIds: child.data.children,
            });
          } else {
            this.commentMap.set(child.data.name, child)
            this.process_comment_tree_into_map_and_queue(child, more_nodes_request_queue, req.postId)
          }
        }
        newChildren.forEach((child) => {
          if (child.kind == 'more') {
            return;
          }
          if (child.data.parent_id.slice(0, 2) == 't3') {
            this.postMap.get(child.data.parent_id).comments.push(child);
          } else if (child.data.parent_id.slice(0, 2) == 't1') {
            const parentComment = this.commentMap.get(child.data.parent_id);
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
        await this.pace_requests_if_appropriate();
      }
      this.log_request_count();
    } catch (err) {
      const normalizedError = {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
      };
      this.errors.push({
        level: 'fatal',
        stage: 'Get Comments',
        info: "Unknown Error",
        normalizedError
      })
      return { ok: false, comments: this.commentMap.size, requests_made: this.requests_made, errors: this.errors }
    }
    return { ok: true, comments: this.commentMap.size, requests_made: this.requests_made, errors: this.errors }
  }

  process_comment_tree_into_map_and_queue(rootNode, more_nodes_request_queue, postId) {
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
        this.commentMap.set(node.data.name, node);

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
      }
    }
    this.logger.log(
      'debug',
      `Queued ${more_nodes_request_queue.length} 'more' nodes after initial comments fetch`
    );
  }
}





