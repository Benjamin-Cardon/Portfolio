
#https://plato.stanford.edu/contents.html
import scrapy
from bs4 import BeautifulSoup
from scraping_project.items import ArticleItem

URI = "neo4j://localhost:7687"
AUTH = ("neo4j", "password")


class MainSpider(scrapy.Spider):
    name = "main"
    custom_settings = {
        'DOWNLOAD_DELAY': .5  # Set the delay to 1 second
    }
    def start_requests(self):
        urls = [
            "https://plato.stanford.edu/contents.html",
        ]
        for url in urls:
            yield scrapy.Request(url=url, callback=self.parse)
    def parse(self, response):
        article_set = set()
        list_items = response.xpath("//body/div[@id='container']/div[@id='content']//ul//li").getall()
        for list_item in list_items:
            list_item_soup = BeautifulSoup(list_item, 'html.parser')
            a = list_item_soup.a
            ul = list_item_soup.ul
            if a is not None:
                text = list_item_soup.getText()
                if "— see" in text:
                    continue
                else:
                    if list_item_soup.a is not None:
                        article_set.add(list_item_soup.a.get("href"))
                #check to see if --see also;
            if ul is not None:
                #for each of the lis in ul.
                sub_list = ul('li')
                for sub_list_item in sub_list:
                    text = sub_list_item.getText()
                    if "— see" in text:
                        continue
                    else:
                        if sub_list_item.a is not None:
                            article_set.add(sub_list_item.a.get("href"))
        print(article_set)
        print(len(article_set))
        for url in article_set:
            yield scrapy.Request("https://plato.stanford.edu/" + url, self.parse_article)

    def parse_article(self, response):
        article = ArticleItem()
        article['url'] = response.url
        article['related_entries'] = response.xpath("//body/div[@id='container']/div[@id='content']/div[@id='article']/div[@id='article-content']/div[@id='aueditable']/div[@id='related-entries']/p").get()
        article['content'] = response.xpath("//body/div[@id='container']/div[@id='content']/div[@id='article']/div[@id='article-content']/div[@id='aueditable']/div[@id='main-text']").get()
        article['bibliography'] = response.xpath("//body/div[@id='container']/div[@id='content']/div[@id='article']/div[@id='article-content']/div[@id='aueditable']/div[@id='bibliography']").get()
        article['title'] = response.xpath("//body/div[@id='container']/div[@id='content']/div[@id='article']/div[@id='article-content']/div[@id='aueditable']/h1/text()").get()
        article['other_internet_resources'] =  response.xpath("//body/div[@id='container']/div[@id='article']/div[@id='content']/div[@id='article-content']/div[@id='aueditable']/div[@id='other-internet-resources']").get()
        article['copyright'] = response.xpath("//body/div[@id='container']/div[@id='content']/div[@id='article']/div[@id='article-copywrite']").get()
        article['preamble'] = response.xpath("//body/div[@id='container']/div[@id='content']/div[@id='article']/div[@id='article-content']/div[@id='aueditable']/div[@id='preamble']").get()
        article['pubinfo'] = response.xpath("//body/div[@id='container']/div[@id='content']/div[@id='article']/div[@id='article-content']/div[@id='aueditable']/div[@id='pubinfo']").get()
        article['table_of_contents'] = response.xpath("//body/div[@id='container']/div[@id='content']/div[@id='article']/div[@id='article-content']/div[@id='aueditable']/div[@id='toc']").get()
        yield article