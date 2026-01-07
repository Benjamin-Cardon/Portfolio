# Define here the models for your scraped items
#
# See documentation in:
# https://docs.scrapy.org/en/latest/topics/items.html

import scrapy


class ScrapingProjectItem(scrapy.Item):
    # define the fields for your item here like:
    # name = scrapy.Field()
    pass
class ArticleItem(scrapy.Item):
    title = scrapy.Field()
    pubinfo = scrapy.Field()
    preamble = scrapy.Field()
    table_of_contents = scrapy.Field()
    content = scrapy.Field()
    bibliography = scrapy.Field()
    related_entries = scrapy.Field()
    copyright = scrapy.Field()
    other_internet_resources = scrapy.Field()
    url = scrapy.Field()
    pass