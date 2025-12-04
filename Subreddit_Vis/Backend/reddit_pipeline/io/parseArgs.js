
function getFlag(args, flag, defaultVal) {
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

function parseArgs(argv, calledInBatchMode, batchOutDir) {
  const [configFilePath, isFileMode] = getFlag(argv, '--file=', null)
  const [out_dir, hasOutDir] = getFlag(argv, '--out_dir=', './data_outputs')
  const [mode, hasModeArg] = getFlag(argv, '--mode=', null)
  const [subreddit, hasSubredditArg] = getFlag(argv, '--subreddit=', null)
  const [count, hasCountArg] = getFlag(argv, '--count=', null)
  const [out, hasOutNameArg] = getFlag(argv, '--out=', `${subreddit}_data`)
  const [burst_mode, hasBurstModeArg] = getFlag(argv, '--burst_mode=', 'end')
  let rawArgs = { calledInBatchMode, batchOutDir, out_dir, hasOutDir, configFilePath, isFileMode, mode, hasModeArg, subreddit, hasSubredditArg, count, hasCountArg, out, hasOutNameArg, burst_mode, hasBurstModeArg }
  return rawArgs
}

function validateArgs(rawArgs) {
  const errors = [];
  let parsedArgs = {};
  if (rawArgs.isFileMode && !rawArgs.calledInBatchMode) {
    // The only thing that's really needed is for there to be the fileMode path not to be empty.
    if (rawArgs.configFilePath === null || rawArgs.configFilePath === undefined || rawArgs.configFilePath === "") {
      errors.push({
        level: "fatal",
        field: "file",
        issue: "Config File path argument is empty. If a file argument is included but has no path, the program will end without further examination."
      })
    }
    if (rawArgs.hasModeArg || rawArgs.hasSubredditArg || rawArgs.hasCountArg || rawArgs.hasOutNameArg || rawArgs.hasBurstModeArg) {
      errors.push({
        level: "warning",
        field: "file",
        issue: "When the command includes a file argument, mode, subreddit, count, out, and burst_mode are all ignored. Only out_dir and file are considered."
      })
    }
    if (!rawArgs.hasOutDir || rawArgs.out_dir === '') {
      errors.push({
        level: "warning",
        field: "file",
        issue: "No out_dir argument supplied. The default is set to './data_outputs', When the command includes a file argument, commands from the file have their out_dir argument overridden."
      })
    }
    parsedArgs = {
      calledInBatchMode: false,
      isFileMode: true,
      configFilePath: rawArgs.configFilePath,
      out_dir: rawArgs.out_dir,
    }
    return [
      parsedArgs, errors
    ]
  }

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
      errors.push({
        level: "warning",
        field: "burst_mode",
        issue: "no burst_mode argument included. In count mode, the burst mode is set by default to 'end'.\n This means, requests will be made to the reddit API until either the full count of posts is collected, or the program runs out of requests for the 10 minute window.\n In this case, it will end, rather than waiting to make more requests."
      })
    }
  }

  if (rawArgs.hasBurstModeArg && !(rawArgs.burst_mode === 'sleep' || rawArgs.burst_mode === 'end')) {
    errors.push({
      level: "warning",
      field: "burst_mode",
      issue: "burst_mode argument is misformed. burst_mode can either be called as 'sleep' or 'end'."
    })
    if (isCount && !rawArgs.calledInBatchMode) {
      errors.push({
        level: "warning",
        field: "burst_mode",
        issue: "invalid burst_mode. In count mode, the burst mode is set by default to 'end'.\n This means, requests will be made to the reddit API until either the full count of posts is collected, or the program runs out of requests for the 10 minute window.\n In this case, it will end, rather than waiting to make more requests."
      })
      burst_mode = 'end'
    }
  }

  if (isFull) {
    burst_mode = 'sleep'
    if (rawArgs.hasBurstModeArg) {
      errors.push({
        level: "warning",
        field: "burst_mode",
        issue: "burst_mode argument included with full mode.\n In full mode, requests are made until the whole subreddit has been analyzed. \n This means that full mode always behaves as 'sleep' and ignores the burst_mode argument."
      })
    }
  }
  if (rawArgs.calledInBatchMode) {
    burst_mode = 'sleep'
    if (rawArgs.hasBurstModeArg && rawArgs.burst_mode !== 'sleep') {
      errors.push({
        level: "warning",
        field: "burst_mode",
        issue: "burst_mode argument included in batch mode. \n In batch mode, it is highly likely the program runs out of requests. \n End mode would become impractical in that context. \n This means that batch mode always behaves as 'sleep' and ignores the burst_mode argument."
      })
    }
    if (rawArgs.hasOutDir) {
      errors.push({
        level: "warning",
        field: "out_dir",
        issue: "out_dir argument included with batch mode.\n In batch mode, all outputs are written to the out_dir given in the first argument call \n This means that out_dir arguments included in a config file are ignored."
      })
    }
    if (rawArgs.isFileMode) {
      errors.push({
        level: "warning",
        field: "file",
        issue: "file argument included in batch mode.\n Although calling another config_command file from the first config_command file is an interesting case, it makes my head hurt to think about it. \n A more pragmatic implementation is to require all commnds to be in a single file \n for this reason, file fields are ignored in batch mode."
      })
    }
  }
  parsedArgs = {
    calledInBatchMode: rawArgs.calledInBatchMode,
    out_dir: rawArgs.calledInBatchMode ? rawArgs.batchOutDir : rawArgs.out_dir,
    subreddit: rawArgs.subreddit,
    isCount,
    isFull,
    count,
    isBurstEnd: burst_mode == "end",
    isBurstSleep: burst_mode == "sleep",
    out: rawArgs.out,
  }

  return [parsedArgs, errors]
}

export default function parse_and_validate_args(argv) {
  const rawArgs = parseArgs(argv)
  return validateArgs(rawArgs)
}