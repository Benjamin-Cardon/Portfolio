import MetricAnalyzer from './MetricAnalyzer.js'
import RedditAPIManager from '../api/RedditAPIManager.js'
import path from 'path'
export default class Runner {
  constructor(Logger, Writer, batch_config) {
    this.logger = Logger;
    this.writer = Writer;
    this.taskSummaries = [];
    this.out_dir = batch_config.out_dir;
    this.isFileMode = batch_config.isFileMode;
  }

  async run(Task) {
    if (!Task.taskWellFormed) {
      this.writer.write({ taskSucceeded: false, data: "__null__", errors: Task.errors, Task })
      this.taskSummaries.push({
        requests_made: 0,
        taskSucceeded: false,
        posts: 0,
        comments: 0,
        users: 0,
        words: 0,
        subreddit: Task?.args?.subreddit ? Task.args.subreddit : "__null__",
        outputPath: Task?.args?.out ? path.join(this.out_dir, Task.args.out) : "__null__",
        errors: Task.errors,
        error_stage: "Command Line Argument",
        timeStarted: new Date().toISOString(),
        timeEnded: new Date().toISOString(),
      })
      return;
    }

    const taskSummary = {
      subreddit: Task.args.subreddit,
      errors: [],
      error_stage: '__null__',
      requests_made: 0,
      posts: 0,
      comments: 0,
      users: 0,
      words: 0,
      timeStarted: new Date().toISOString(),
      timeEnded: null,
      outputPath: path.join(this.out_dir, Task.args.out),
    }

    const api = new RedditAPIManager(Task.args);

    const initResult = await api.init();
    //check init result.\
    taskSummary.requests_made = initResult.requests_made;

    if (!initResult.ok) {
      taskSummary.error_stage = "API_Initalization"
      taskSummary.timeEnded = new Date().toISOString()
      this.taskSummaries.push(taskSummary);
      this.writer.write({
        taskSucceeded: false,
        data: "__null__",
        errors: initResult.errors,
        Task,
      })
      return;
    }

    const postResult = await api.get_posts();
    taskSummary.posts = postResult.posts;
    taskSummary.requests_made = postResult.requests_made;

    if (!postResult.ok) {
      taskSummary.error_stage = "Getting_Posts"
      taskSummary.timeEnded = new Date().toISOString()
      this.taskSummaries.push(taskSummary);
      this.writer.write({
        taskSucceeded: false,
        data: "__null__",
        errors: postResult.errors,
        Task,
      })
      return;
    }

    const commentResult = await api.get_comments_for_posts()
    taskSummary.comments = commentResult.comments;
    taskSummary.requests_made = commentResult.requests_made;

    if (!commentResult.ok) {
      taskSummary.error_stage = "Getting_Comments"
      taskSummary.timeEnded = new Date().toISOString()
      this.taskSummaries.push(taskSummary);
      this.writer.write({
        taskSucceeded: false,
        data: "__null__",
        errors: commentResult.errors,
        Task,
      })
      return;
    }

    const analyzer = new MetricAnalyzer();

    const calculateResult = await analyzer.calculate_metrics(api.posts, api.postMap, api.commentMap)
    taskSummary.users = calculateResult.users;
    taskSummary.words = calculateResult.words;

    if (!calculateResult.ok) {
      taskSummary.error_stage = "Calculating Metrics"
      taskSummary.timeEnded = new Date().toISOString()
      this.taskSummaries.push(taskSummary);
      this.writer.write({
        taskSucceeded: false,
        data: "__null__",
        errors: calculateResult.errors,
        Task,
      })
      return;
    }

    const data = analyzer.getData();
    const finalResult = {
      taskSucceeded: true,
      data,
      errors: [],
      Task,
    }

    taskSummary.timeEnded = new Date().toISOString()
    taskSummary.taskSucceeded = true;
    this.taskSummaries.push(taskSummary);
    this.writer.write(finalResult)
  }
  end() {
    // log results and write manifest.
  }
}