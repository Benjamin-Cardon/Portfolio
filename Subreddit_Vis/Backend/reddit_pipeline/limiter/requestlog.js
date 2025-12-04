function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function check_request_count(proposed_requests) {
  return proposed_requests < (get_request_rates().requests_remaining);
}

function get_request_rates() {
  let request_summary = trim_request_log(readFileSync('requestlog.txt', 'utf-8').split(',')).reduce((accumulator, current) => {
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
};

function log_request_count(request_count) {
  let log = trim_request_log(readFileSync('requestlog.txt', 'utf-8').split(','));
  log.push(`${request_count}:${Date.now()}`)
  writeFileSync('requestlog.txt', log.join(','));
}

function trim_request_log(log) {
  return log.filter((x) => x.split(':')[1] > Date.now() - 600000)
}