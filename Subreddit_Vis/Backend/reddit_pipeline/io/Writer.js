import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from 'path'

export default class Writer {

  constructor(logger, batch_config) {
    this.isFileMode = batch_config.isFileMode;
    this.out_dir = batch_config.out_dir;
    this.log_level = batch_config.log_level;
    this.logger = logger
  }

  write(result) {
    const { taskSucceeded, data, errors, Task } = result;
    this.logger.log(
      'debug',
      `Writer.write: taskSucceeded=${taskSucceeded}, out=${Task.args.out}`
    );
    if (taskSucceeded) {
      this.write_to_json(data, Task.args.out)
    } else {
      this.write_failed_task(result, Task.args.out)
    }
  }

  writeBatchManifest(taskSummaries) {
    const filePath = path.join(this.out_dir, "batch_manifest")
    this.logger.log(
      'debug',
      `Writing batch manifest with ${taskSummaries.length} tasks to ${filePath}`
    );
    writeFileSync(filePath, JSON.stringify(taskSummaries));
    // I'll improve this later
  }

  write_to_json(data, outName) {

    const embeddings_serialized = {};
    for (const [key, emb] of Object.entries(data.embeddings)) {
      embeddings_serialized[key] = Array.from(emb.data);
    }
    data.embeddings = embeddings_serialized;
    mkdirSync(this.out_dir, { recursive: true });
    const fullPath = path.join(this.out_dir, outName); this.logger.log(
      'debug',
      `Writing successful task output to ${fullPath}; `
    );
    writeFileSync(fullPath, JSON.stringify(data));
  }

  write_failed_task(result, outName) {
    mkdirSync(this.out_dir, { recursive: true });
    const fullPath = path.join(this.out_dir, outName);
    this.logger.log(
      'debug',
      `Writing failed task output to ${fullPath}; ` +
      `errors=${result.errors?.length ?? 0}`
    );
    writeFileSync(fullPath, JSON.stringify(result));
  }
}


