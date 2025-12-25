export default class Logger {
  constructor(batch_config) {
    this.log_level = batch_config.log_level;
    this.isFileMode = batch_config.isFileMode;
  }
  log(level, message) {
    if (level === this.log_level) {
      console.log(message)
    }
  }
}