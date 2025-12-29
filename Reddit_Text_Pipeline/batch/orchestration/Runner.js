import MetricAnalyzer from '../../task/analysis/MetricAnalyzer.js'
import RedditAPIManager from '../../task/api/RedditAPIManager.js'
import path from 'path'
export default class Runner {
  constructor(Logger, Writer, TokenManager, batch_config) {
    this.logger = Logger;
    this.writer = Writer;
    this.taskSummaries = [];
    this.out_dir = batch_config.out_dir;
    this.isFileMode = batch_config.isFileMode;
    this.tokenManager = TokenManager
  }
  async run(Task) {

    if (!Task.taskWellFormed) {
      this.logger.log('info', `Task not well formed.`)
      this.logger.log('debug', `Task not well formed.Task Object: ${JSON.stringify(Task)} `)
      if (!this.isFileMode) {
        {
          this.logger.log('quiet', "Task not well formed.")
        }
      }
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
    this.logger.log(
      'debug',
      `Task object: ${JSON.stringify({
        subreddit: Task.args.subreddit,
        isCount: Task.args.isCount,
        isFull: Task.args.isFull,
        count: Task.args.count,
        isBurstEnd: Task.args.isBurstEnd,
        isBurstSleep: Task.args.isBurstSleep,
        out: Task.args.out
      })}`
    );

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
    this.logger.log('info', `Beginning Task for Subreddit ${Task.args.subreddit}.`)

    const api = new RedditAPIManager(Task.args, this.logger, this.tokenManager);

    this.logger.log('info', `Validating Subreddit for ${Task.args.subreddit}.`)

    const checkResult = await api.C();
    //check init result.\

    taskSummary.requests_made = checkResult.requests_made;

    if (!checkResult.ok) {
      this.logger.log('info', `Error at Subreddit Validation stage.`)
      if (!this.isFileMode) {
        {
          this.logger.log('quiet', "Error at Subreddit Validation stage.")
        }
      }
      taskSummary.error_stage = "Subreddit Validation"
      taskSummary.timeEnded = new Date().toISOString()
      this.taskSummaries.push(taskSummary);
      this.writer.write({
        taskSucceeded: false,
        data: "__null__",
        errors: checkResult.errors,
        Task,
      })
      return;
    }
    this.logger.log('info', `Subreddit Validation of Subreddit: ${Task.args.subreddit} successful.`)
    this.logger.log('info', `Getting posts for Subreddit ${Task.args.subreddit}.`)

    const postResult = await api.get_posts();

    this.logger.log(
      'debug',
      `get_posts: ok=${postResult.ok}, posts=${postResult.posts}, requests_made=${postResult.requests_made}`
    );
    taskSummary.posts = postResult.posts;
    taskSummary.requests_made = postResult.requests_made;

    if (!postResult.ok) {
      this.logger.log('info', `Error while getting posts.`)
      if (!this.isFileMode) {
        {
          this.logger.log('quiet', "Error while getting posts.")
        }
      }
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
    this.logger.log('info', `Successfully got ${taskSummary.posts} posts.`)

    this.logger.log('info', `Getting comments for subreddit ${Task.args.subreddit}.`)
    const commentResult = await api.get_comments_for_posts()
    this.logger.log(
      'debug',
      `get_comments_for_posts: ok=${commentResult.ok}, comments=${commentResult.comments}, requests_made=${commentResult.requests_made}`
    );
    taskSummary.comments = commentResult.comments;
    taskSummary.requests_made = commentResult.requests_made;

    if (!commentResult.ok) {
      this.logger.log('info', `Error while forming comment trees.`)
      if (!this.isFileMode) {
        {
          this.logger.log('quiet', "Error while forming comment trees.")
        }
      }
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
    this.logger.log('info', `Successfully got ${taskSummary.comments} comments.`)
    this.logger.log('info', `Beginning to Analyze Metrics for subreddit ${Task.args.subreddit}.`)
    const analyzer = new MetricAnalyzer(this.logger);
    this.logger.log(
      'debug',
      `calculate_metrics: postMap=${api.postMap.size}, commentMap=${api.commentMap.size}`
    );
    const calculateResult = await analyzer.calculate_metrics(api.posts, api.postMap, api.commentMap)
    this.logger.log(
      'debug',
      `calculate_metrics result: ok=${calculateResult.ok}, users=${calculateResult.users}, words=${calculateResult.words}`
    );
    taskSummary.users = calculateResult.users;
    taskSummary.words = calculateResult.words;

    if (!calculateResult.ok) {
      this.logger.log('info', `Error while calculating Metrics.`)
      if (!this.isFileMode) {
        {
          this.logger.log('quiet', "Error while calculating Metrics.")
        }
      }
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

    this.logger.log('info', `Successfully calculated Metrics. \nOur Analysis of ${Task.args.subreddit} includes ${taskSummary.posts} posts with ${taskSummary.comments} comments, made by ${taskSummary.users} users using ${taskSummary.words} unique words.`)
    const data = analyzer.getData();
    const finalResult = {
      taskSucceeded: true,
      data,
      errors: [],
      Task,
    }
    this.logger.log('info', `Task succeeded for subreddit ${Task.args.subreddit}.`)
    if (!this.isFileMode) {
      this.logger.log('quiet', `Process succeeded for subreddit ${Task.args.subreddit}. Process took ${(new Date() - Date.parse(taskSummary.timeStarted)) / 60000} minutes\n Our Analysis of ${Task.args.subreddit} includes ${taskSummary.posts} posts with ${taskSummary.comments} comments, made by ${taskSummary.users} users using ${taskSummary.words} unique words.`)
    }
    taskSummary.timeEnded = new Date().toISOString()
    taskSummary.taskSucceeded = true;
    this.logger.log(
      'debug',
      `Final task summary for ${Task.args.subreddit}: ${JSON.stringify(taskSummary)}`
    );
    this.taskSummaries.push(taskSummary);
    this.writer.write(finalResult)
  }
  end() {
    if (this.isFileMode) {
      const success_strings = [];
      const failure_strings = [];
      let total_tasks = 0;
      let total_failed_tasks = 0;
      let total_successful_tasks = 0;
      let total_posts = 0;
      let total_comments = 0;
      let total_users = 0;
      let total_words_unique_to_reddit = 0;
      let total_requests = 0;
      let time_started = this.taskSummaries.reduce((acc, curr) => Math.min(Date.parse(curr.timeStarted), acc), new Date())
      const time_ended = new Date().toISOString()
      for (const taskSummary of this.taskSummaries) {
        total_tasks++;
        if (taskSummary.taskSucceeded) {
          total_successful_tasks++;
          success_strings.push(`\u2705 Task for subreddit ${taskSummary.subreddit}, number ${total_tasks} of ${this.taskSummaries.length} in file, had a duration of ${((Date.parse(taskSummary.timeEnded)) - Date.parse(taskSummary.timeStarted)) / 1000} seconds, made ${taskSummary.requests_made} requests to the API, included ${taskSummary.posts} posts with ${taskSummary.comments} comments, made by ${taskSummary.users} users using ${taskSummary.words} unique words.`)
        } else {
          failure_strings.push(`\u274C Task number ${total_tasks} of ${this.taskSummaries.length} in file failed in stage ${taskSummary.error_stage}`);
          total_failed_tasks++;
        }
        total_posts += taskSummary.posts;
        total_comments += taskSummary.comments;
        total_users += taskSummary.users;
        total_words_unique_to_reddit += taskSummary.words;
        total_requests += taskSummary.requests_made
      }
      this.logger.log('quiet', `Process completed successfully. ${total_tasks} total commands given in batch. ${total_successful_tasks} successful tasks, ${total_failed_tasks} failed tasks`);
      this.logger.log('info', `Process completed successfully.${total_tasks} total commands given in batch. ${total_successful_tasks} successful tasks, ${total_failed_tasks} failed tasks\nProcess took ${(new Date() - time_started) / 60000} minutes in total. Got and analyzed ${total_posts} posts with ${total_comments} comments from ${total_users} users. Sum of subreddit vocabularies is ${total_words_unique_to_reddit} words.`)
      this.logger.log('debug', `Process completed successfully.${total_tasks} total commands given in batch. ${total_successful_tasks} successful tasks, ${total_failed_tasks} failed tasks\nProcess took ${(new Date() - time_started) / 60000} minutes in total. Got and analyzed ${total_posts} posts with ${total_comments} comments from ${total_users} users. Sum of subreddit vocabularies is ${total_words_unique_to_reddit} words.`)
      this.logger.log('info', `Successful Tasks:`)
      this.logger.log('debug', `Successful Tasks:`)

      for (const success_string of success_strings) {
        this.logger.log('info', success_string)
        this.logger.log('debug', success_string)
      }
      if (success_strings.length === 0) {
        this.logger.log('info', "No Successful Tasks")
        this.logger.log('debug', "No Successful Tasks")
      }
      this.logger.log('info', `Failed Tasks:`)
      this.logger.log('debug', `failed Tasks:`)
      for (const failure_string of failure_strings) {
        this.logger.log('info', failure_string);
        this.logger.log('debug', failure_string);
      }
      if (failure_strings.length === 0) {
        this.logger.log('info', "No Failed Tasks")
        this.logger.log('debug', "No Failed Tasks")
      }
      this.writer.writeBatchManifest(this.taskSummaries)
    }
  }
}

// {
//         requests_made: 0,
//         taskSucceeded: false,
//         posts: 0,
//         comments: 0,
//         users: 0,
//         words: 0,
//         subreddit: Task?.args?.subreddit ? Task.args.subreddit : "__null__",
//         outputPath: Task?.args?.out ? path.join(this.out_dir, Task.args.out) : "__null__",
//         errors: Task.errors,
//         error_stage: "Command Line Argument",
//         timeStarted: new Date().toISOString(),
//         timeEnded: new Date().toISOString(),
//       }