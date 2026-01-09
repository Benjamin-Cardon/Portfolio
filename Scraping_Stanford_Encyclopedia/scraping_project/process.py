
from spiders import MainSpider
from spiders import CleanupMainSpider
from spiders import cleanupOutliers
from scrapy.utils.project import get_project_settings
from twisted.internet import reactor, defer
from scrapy.crawler import CrawlerRunner
from scrapy.utils.log import configure_logging


settings = get_project_settings()
# Create a CrawlerProcess instance with settings
runner = CrawlerRunner(settings)
configure_logging(settings)
#process.crawl(MainSpider)
@defer.inlineCallbacks
def crawl():
    yield runner.crawl(MainSpider)
    yield runner.crawl(CleanupMainSpider)
    cleanupOutliers()
    reactor.stop()


crawl()
reactor.run()
