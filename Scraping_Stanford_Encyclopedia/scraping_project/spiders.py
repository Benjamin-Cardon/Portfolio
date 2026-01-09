
#https://plato.stanford.edu/contents.html
import scrapy
from bs4 import BeautifulSoup
from items import ArticleItem
from itemadapter import ItemAdapter
from neo4j import GraphDatabase, RoutingControl
from scrapy import signals
import asyncio
from twisted.internet import asyncioreactor
scrapy.utils.reactor.install_reactor('twisted.internet.asyncioreactor.AsyncioSelectorReactor')
from twisted.internet import reactor
URI = "neo4j://localhost:7687"
AUTH = ("neo4j", "foucault")


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
            if ul is not None:
                if a is not None:
                    a_text = a.find(text=True, recursive=False)
                    if "— see" not in text:
                        article_set.add(list_item_soup.a.get("href"))
                sub_list = ul('li')
                for sub_list_item in sub_list:
                    text = sub_list_item.getText()
                    if "— see" in text:
                        continue
                    else:
                        if sub_list_item.a is not None:
                            article_set.add(sub_list_item.a.get("href"))
            elif ul is None:
                text = list_item_soup.get_text()
                if a is not None:
                    if "— see" not in text:
                        article_set.add(list_item_soup.a.get("href"))
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

class CleanupMainSpider(scrapy.Spider):
    name = "CleanupSpider"
    custom_settings = {
        'DOWNLOAD_DELAY': .5  # Set the delay to 1 second
    }
    def __init__(self, *args, **kwargs):
        super(scrapy.Spider, self).__init__(*args, **kwargs)
        # Initialization code here
        self.neo = GraphDatabase.driver(URI, auth=AUTH )
    def spider_close(self):
        self.neo.close()
    def start_requests(self):
        cypher_query = "MATCH (a:Article {title: 'Not Yet Filled'}) RETURN a"
        urls = []
        with self.neo.session(database="neo4j") as session:
            result = session.run(cypher_query)
            node_data = result.data()
            print(node_data)
            for node in node_data:
                print(node)
                urls.append(node['a']['url'])
        for url in urls:
            if url == "Non-standard Reference URL":
                continue
            yield scrapy.Request(url=url, callback=self.parse_article)
    def parse_article(self, response):
        #article = ArticleItem()
        url = response.url
        title = response.xpath("//body/div[@id='container']/div[@id='content']/div[@id='article']/div[@id='article-content']/div[@id='aueditable']/h1/text()").get()
        if title is not None:
            with self.neo.session(database="neo4j") as session:
                    query = "MATCH (a:Article { url: 'XXX' }) \n SET a.title = 'YYY' \n RETURN a".replace('XXX', url).replace('YYY', title)
                    result = session.run(query=query)
        related_entries_html = response.xpath("//body/div[@id='container']/div[@id='content']/div[@id='article']/div[@id='article-content']/div[@id='aueditable']/div[@id='related-entries']/p").get()
        related_entries = BeautifulSoup(related_entries_html).find_all('a')
        if related_entries is not None:
            for related_entry in related_entries:
                related_entry_ref = related_entry.get('href')
                if related_entry_ref[0:5] == 'https':
                    related_url = related_entry_ref
                elif related_entry_ref[0:3] == "../":
                    related_url = "https://plato.stanford.edu/entries/" + related_entry_ref[3:]
                else:
                    related_url = "Non-standard Reference URL"
                with self.neo.session(database="neo4j") as session:
                    query = "MATCH (a:Article { title: 'XXX', url: 'ZZZ' }), (b:Article {url:'YYY'}) \n MERGE (a)-[r:RELATED_TO]->(b) \n RETURN a, b, r".replace('XXX', title).replace('YYY', related_url).replace('ZZZ', url)
                    result = session.run(query=query)


def cleanupOutliers():
    neo = GraphDatabase.driver(URI, auth=AUTH )
    with neo.session(database="neo4j") as session:
        query = "MATCH (a:Article {title:'Not Yet Filled'}) \n DELETE a"
        result = session.run(query=query)
    neo.close()
