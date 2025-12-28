import { readFileSync, statSync, existsSync, accessSync, constants } from 'fs'
import path from 'path'

export default class Parser {
  constructor() {
    this.out_dir = null;
    this.argFilePath = null;
    this.log_level = null;
    this.isFileMode = false;
    this.configParseErrors = [];
  }

  parseArgs(argv) {
    const [argFilePath, isFileMode] = this.getFlag(argv, '--file=', null)
    const [out_dir, hasOutDir] = this.getFlag(argv, '--out_dir=', './data_outputs')
    const [log_level, hasLogLevel] = this.getFlag(argv, '--log_level=', 'info')

    this.log_level = log_level;
    this.out_dir = out_dir;
    this.isFileMode = isFileMode;
    this.argFilePath = argFilePath;

    this.validateConfigLevelArgs()

    if (this.isFileMode) {
      return this.readArgFile()
    }

    return [this.validateArgsForTask(this.parseArgsForTask(argv))]
  }

  readArgFile() {
    const tasks = [];
    const fileContents = readFileSync(this.argFilePath, "utf-8");
    const commandTexts = fileContents.split(",");

    for (const commandText of commandTexts) {
      const trimmed = commandText.trim();
      if (!trimmed) continue;
      const argv = trimmed.split(/\s+/);
      const rawArgs = this.parseArgsForTask(argv);
      const task = this.validateArgsForTask(rawArgs);
      tasks.push(task);
    }
    return tasks;
  }

  parseArgsForTask(argv) {
    if (!this.isFileMode) {
      const [out_dir, hasOutDir] = this.getFlag(argv, '--out_dir=', './data_outputs')
      const [log_level, hasLogLevel] = this.getFlag(argv, '--log_level=', 'info')
      this.out_dir = out_dir
      this.log_level = log_level
    }
    const [mode, hasModeArg] = this.getFlag(argv, '--mode=', null)
    const [subreddit, hasSubredditArg] = this.getFlag(argv, '--subreddit=', null)
    const [count, hasCountArg] = this.getFlag(argv, '--count=', null)
    const [out, hasOutNameArg] = this.getFlag(argv, '--out=', `${subreddit}_data.json`)
    const [burst_mode, hasBurstModeArg] = this.getFlag(argv, '--burst_mode=', 'end')

    let rawArgs = { mode, hasModeArg, subreddit, hasSubredditArg, count, hasCountArg, out, hasOutNameArg, burst_mode, hasBurstModeArg }
    return rawArgs
  }

  validateConfigLevelArgs() {
    const INVALID_WIN_CHARS = /[<>:"|?*\x00-\x1F]/;

    let dirName = null;
    if (this.out_dir) {
      dirName = path.win32.basename(this.out_dir);
    }

    let filePath = null;
    if (this.isFileMode && this.argFilePath) {
      filePath = path.win32.basename(this.argFilePath);
    }

    if (!['info', 'quiet', 'debug'].includes(this.log_level)) {
      this.configParseErrors.push({ level: "warning", field: "log_level", issue: "supplied log_level argument not valid, valid arguments are quiet, info, and debug. Defaulting to info" })
      this.log_level = 'info';
    }

    if (this.isFileMode) {
      if (this.argFilePath === null || this.argFilePath === undefined || this.argFilePath === "") {
        this.configParseErrors.push({
          level: "fatal",
          field: "file",
          issue: "Config File path argument is empty. If a file argument is included but has no path, the program will end without further examination."
        })
      } else if (INVALID_WIN_CHARS.test(filePath)) {
        this.configParseErrors.push({
          level: "fatal",
          field: "file",
          issue: "Config File path has invalid characters for a window path"
        })
      } else if (!existsSync(this.argFilePath)) {
        this.configParseErrors.push({
          level: "fatal",
          field: "file",
          issue: "Config File path does not lead to valid file",
        });
      } else if (!statSync(this.argFilePath).isFile()) {
        this.configParseErrors.push({
          level: "fatal",
          field: "file",
          issue: "Config File path does not lead to valid file"
        })
      } else {
        try {
          readFileSync(this.argFilePath);
        } catch {
          this.configParseErrors.push({
            level: "fatal",
            field: "file",
            issue: "Config File path is not readable"
          })
        }
      }
    }

    if (this.out_dir === '' || !this.out_dir) {
      this.configParseErrors.push({
        level: "warning",
        field: "out_dir",
        issue: "No out_dir argument supplied. The default is set to './data_outputs', When the command includes a file argument, commands from the file have their out_dir argument overridden."
      })
    } else if (INVALID_WIN_CHARS.test(dirName)) {
      this.configParseErrors.push({
        level: "fatal",
        field: "out_dir",
        issue: "out_dir argument includes characters which aren't valid for a windows file path."
      })
    } else if (existsSync(this.out_dir)) {
      const stats = statSync(this.out_dir);
      if (!stats.isDirectory()) {
        this.configParseErrors.push({
          level: "fatal",
          field: "out_dir",
          issue: "out_dir exists but is a file, not a directory.",
        });
      } else {
        try {
          accessSync(this.out_dir, constants.W_OK);
        } catch (err) {
          this.configParseErrors.push({
            level: "fatal",
            field: "out_dir",
            issue: `out_dir exists but is not writable (code: ${err.code || "UNKNOWN"})`,
          });
        }
      }
    } else {
      const parent = path.dirname(this.out_dir);
      if (!existsSync(parent)) {
        this.configParseErrors.push({
          level: "fatal",
          field: "out_dir",
          issue: "out_dir does not exist and its parent directory does not exist.",
        });
      } else {
        const parentStats = statSync(parent);
        if (!parentStats.isDirectory()) {
          this.configParseErrors.push({
            level: "fatal",
            field: "out_dir",
            issue: "out_dir's parent exists but is not a directory.",
          });
        }
        try {
          accessSync(parent, constants.W_OK);
        } catch (err) {
          this.configParseErrors.push({
            level: "fatal",
            field: "out_dir",
            issue: `Cannot write into parent directory of out_dir (code: ${err.code || "UNKNOWN"})`,
          });
        }
      }
    }
    this.handleParseErrors()
  }

  handleParseErrors() {
    const fatalErrorCount = this.configParseErrors.reduce((acc, curr) => curr.level == 'fatal' ? acc + 1 : acc, 0,);
    const warningErrorCount = this.configParseErrors.reduce((acc, curr) => curr.level == 'warning' ? acc + 1 : acc, 0,);

    if (this.configParseErrors.some((error) => error.level === 'fatal')) {
      if (this.log_level === 'quiet') {
        console.log(`Supplied arguments are not valid. Process is exiting before running. Found ${fatalErrorCount} fatal errors with arguments,  generated ${warningErrorCount} warnings. `)
      } else if (this.log_level === 'debug') {
        for (const error of this.configParseErrors) {
          console.log(`Error with field ${error.field}:Level:${error.level} issue: ${error.issue}`)
        }
      } else if (this.log_level === 'info') {
        console.log(`Supplied arguments are not valid. Process is exiting before running. Found ${fatalErrorCount} fatal errors with arguments,  generated ${warningErrorCount} warnings. `)
        for (const error of this.configParseErrors) {
          if (error.level === 'fatal') {
            console.log(`Error with field ${error.field}: issue: ${error.issue}`)
          }
        }
      }

      process.exit(1); /// <----------- If there is a fatal parse error, we exit our process prematurely, before entering the proper error handling boundary contained in runner class.

    } else {
      console.log("Process Beginning.")
      if (this.log_level === 'quiet') {
        // Nothing, it's quiet mode.
      } else if (this.log_level === 'debug') {
        for (const error of this.configParseErrors) {
          console.log(`Error with field ${error.field}:Level:${error.level} issue: ${error.issue}`)
        }
      } else if (this.log_level === 'info') {
        if (warningErrorCount) {
          console.log(`${warningErrorCount} warnings generated for these arguments: These are not fatal, and likely will not cause any problems.`)
        } else {
          console.log("No warnings or errors generated by this set of arguments.")
        }
      }
    }
  }

  validateArgsForTask(rawArgs) {
    const errors = [];
    if (!rawArgs.hasSubredditArg) {
      errors.push({
        level: "fatal",
        field: "subreddit",
        issue: "No subreddit argument. Without a subreddit argument, the program cannot begin it's analysis."
      })
    } else {
      if (rawArgs.subreddit === "" || rawArgs.subreddit === null || rawArgs.subreddit === undefined) {
        errors.push({
          level: "fatal",
          field: "subreddit",
          issue: "subreddit argument is empty. Without a subreddit argument, the program cannot begin it's analysis."
        })
      }
    }
    const mode = rawArgs.mode
    let isCount = false;
    let isFull = false;
    if (!rawArgs.hasModeArg) {
      errors.push({
        level: "fatal",
        field: "mode",
        issue: "No mode argument. Without a valid mode argument, the program cannot begin it's analysis."
      })
    } else if (mode == null || mode == undefined) {
      errors.push({
        level: "fatal",
        field: "mode",
        issue: "mode argument is empty. Without a valid mode argument, the program cannot begin it's analysis."
      })
    } else {
      isCount = mode == "count"
      isFull = mode == "full"
      if (!(isCount || isFull)) {
        errors.push({
          level: "fatal",
          field: "mode",
          issue: "mode argument is not 'full' or 'count'. full and count are the only valid mode arguments. Without a mode argument, the program cannot begin it's analysis."
        })
      }
    }
    let count, burst_mode;
    if (isCount) {
      if (!rawArgs.hasCountArg) {
        errors.push({
          level: "fatal",
          field: "count",
          issue: "No count argument. in count mode, a count is required."
        })
      } else if (rawArgs.count == null || rawArgs.count === '') {
        errors.push({
          level: "fatal",
          field: "count",
          issue: "count argument is empty. In count mode, a count is required"
        })
      } else {
        count = Number(rawArgs.count);

        if (!Number.isInteger(count) || count <= 0) {
          errors.push({
            level: "fatal",
            field: "count",
            issue: "count argument is not a positive integer. in count mode, a valid count argument is required"
          })
        }
      }

      if (!rawArgs.hasBurstModeArg) {
        burst_mode = "end"
        errors.push({
          level: "warning",
          field: "burst_mode",
          issue: "no burst_mode argument included. In count mode, the burst mode is set by default to 'end'.\n This means, requests will be made to the reddit API until either the full count of posts is collected, or the program runs out of requests for the 10 minute window.\n In this case, it will end, rather than waiting to make more requests."
        })
      } else if (rawArgs.burst_mode === "sleep" || rawArgs.burst_mode === "end") {
        burst_mode = rawArgs.burst_mode;
      } else {
        errors.push({
          level: "warning",
          field: "burst_mode",
          issue: "burst_mode argument is misformed. burst_mode can either be called as 'sleep' or 'end'."
        })
        burst_mode = "end";
      }
    }
    if (isFull) {
      count = Infinity
      burst_mode = 'sleep'
      if (rawArgs.hasBurstModeArg) {
        errors.push({
          level: "warning",
          field: "burst_mode",
          issue: "burst_mode argument included with full mode.\n In full mode, requests are made until the whole subreddit has been analyzed. \n This means that full mode always behaves as 'sleep' and ignores the burst_mode argument."
        })
      }
    }
    if (this.isFileMode) {
      burst_mode = 'sleep'
      if (rawArgs.hasBurstModeArg && rawArgs.burst_mode !== 'sleep') {
        errors.push({
          level: "warning",
          field: "burst_mode",
          issue: "burst_mode argument included in batch mode. \n In batch mode, it is highly likely the program runs out of requests. \n End mode would become impractical in that context. \n This means that batch mode always behaves as 'sleep' and ignores the burst_mode argument."
        })
      }
    }
    const parsedArgs = {
      subreddit: rawArgs.subreddit,
      isCount,
      isFull,
      count,
      isBurstEnd: burst_mode == "end",
      isBurstSleep: burst_mode == "sleep",
      out: rawArgs.out,
    }

    return { taskWellFormed: !errors.some((error) => error.level === 'fatal'), args: parsedArgs, errors }
  }

  getBatchConfig() {
    const initialized = !(this.out_dir == null || this.log_level == null);
    return { out_dir: this.out_dir, isFileMode: this.isFileMode, log_level: this.log_level, initialized }
  }

  getFlag(args, flag, defaultVal) {
    let rawFlag = args.find((arg) => arg.startsWith(flag))
    let flagVal, isBool
    if (!rawFlag) {
      isBool = false
      flagVal = defaultVal
    } else {
      isBool = true
      flagVal = rawFlag.split('=')[1]
    }
    return [flagVal, isBool]
  }
}