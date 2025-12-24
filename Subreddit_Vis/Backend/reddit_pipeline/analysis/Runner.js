import MetricAnalyzer from './MetricAnalyzer.js'
import RedditAPIManager from '../api/RedditAPIManager.js'

export class Runner {
  constructor(Logger, Writer) {
    this.logger = Logger;
    this.writer = Writer;
  }
  run(Task) {
    const api = RedditAPIManager.create(Task)
    const posts = api.get_posts();
    const { postMap, commentMap } = api.get_comments_for_posts(posts)
    const analyzer = new MetricAnalyzer();
    const data = analyzer.calculate_metrics(posts, postMap, commentMap)
    const result = {
      data, notes: "We'll figure this one out"
    }
    this.writer.write(result)
  }
}