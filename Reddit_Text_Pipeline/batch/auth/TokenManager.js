import dotenv from "dotenv";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import process from 'node:process';
import { readFileSync, writeFileSync, existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

export default class TokenManager {
  constructor(logger) {
    this.logger = logger
    this.token = '';
    this.expiration_date = 0;
  }

  async init() {
    this.get_cached_auth_token()
    this.logger.log(
      'debug',
      this.token
        ? 'Using cached auth token from token.txt'
        : 'No valid cached token; requesting new one'
    );
    if (!this.token) {
      try {
        await this.get_auth_token()
        this.cache_auth_token()
        this.logger.log(
          'debug',
          `Fetched new auth token; expiration date=${this.expiration_date}s`
        );
      }
      catch (err) {
        this.logger.log(
          'debug',
          `get_auth_token failed: status=${err.response?.status}, data=${JSON.stringify(err.response?.data)}`
        );
        this.logger.log('quiet', "Failed to get Auth token. Process Exiting.")
        this.logger.log('info', "Failed to get Auth token. This is likely due to a configuration error in our .env file. With no token, calls to the Reddit API are not possible. Process Exiting.")
        process.exit(1);
      }
    }
  }

  async get_headers() {
    await this.check_expiration_date()
    const headers = {
      "User-Agent": "web:social-graph-analysis-visualization:v1.0.0 (by /u/AppropriateTap826)",
      Authorization: `Bearer ${this.token}`,
    };
    return headers;
  }

  async check_expiration_date() {
    if (this.expiration_date - (Date.now() / 1000) < 600) {
      await this.get_auth_token()
      this.cache_auth_token();
    }
  }

  async get_auth_token() {
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
    this.token = response.data.access_token;
    this.expiration_date = Math.floor(Date.now() / 1000) + Number(response.data.expires_in);
  }

  get_cached_auth_token() {
    try {
      if (!existsSync("./batch/auth/token.txt")) {
        this.logger.log('debug', 'No token.txt found; treating as no cached token');
        return
      }

      const contents = readFileSync("./batch/auth/token.txt", "utf-8");
      const [expStr, token] = contents.split(":::");
      const expiration = Number(expStr);

      if (!token || Number.isNaN(expiration)) {
        this.logger.log('debug', `Malformed token file: contents="${contents}"`);
        return
      }

      const now = Math.floor(Date.now() / 1000);

      if (expiration < now - 60) {
        this.logger.log('debug', `Cached token expired at ${expiration}, now=${now}`);
        return
      }

      this.logger.log('debug', `Cached token valid until ${expiration}, using it`);
      this.token = token;
      this.expiration_date = expiration;
      return;
    } catch (err) {
      this.logger.log('debug', `Unknown error while fetching cached auth token. Attempting to get new token. Error name\n${err?.name}\nError Message${err?.message}\nError Stack ${err?.stack}`);
      return
    }
  }

  cache_auth_token() {
    writeFileSync('./api/token.txt', this.expiration_date + ":::" + this.token);
  }
}