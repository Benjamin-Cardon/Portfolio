
# Define your item pipelines here
#
# Don't forget to add your pipeline to the ITEM_PIPELINES setting
# See: https://docs.scrapy.org/en/latest/topics/item-pipeline.html


# useful for handling different item types with a single interface
from itemadapter import ItemAdapter
from bs4 import BeautifulSoup
from neo4j import GraphDatabase, RoutingControl


URI = "neo4j://localhost:7687"
AUTH = ("neo4j", "foucault")

class ScrapingProjectPipeline:
    def process_item(self, item, spider):
        return item

class ArticleToNeoPipeline:
    def open_spider(self, spider):
        self.neo = GraphDatabase.driver(URI, auth=AUTH )
        self.urls = {}
        print(self.neo.get_server_info())
    def close_spider(self,spider):
        self.neo.close()
        print(self.urls)

    def process_item(self, item, spider):
        if self.urls.get(item['url']) is None:
            self.urls[item['url']] = item['title']
            with self.neo.session(database="neo4j") as session:
                query = 'MERGE (a:Article  { title: \'XXX\', url: \'YYY\'  }) \nRETURN a'.replace('XXX', item['title']).replace('YYY', item['url'])
                session.run(query=query)
        elif self.urls.get(item['url']) is "Not Yet Filled":
            self.urls[item['url']] = item['title']
            with self.neo.session(database="neo4j") as session:
                query = 'MATCH (a:Article  { title: \'XXX\', url: \'YYY\'  }) \n SET a.title = "ZZZ" \n RETURN a'.replace('XXX', "Not Yet Filled").replace('YYY', item['url']).replace('ZZZ',item['title'])
                session.run(query=query)

        related_entries = BeautifulSoup(item['related_entries']).find_all('a')
        if len(related_entries) > 0:
            for related_entry in related_entries:
                url = "https://plato.stanford.edu/entries/" + related_entry.get('href')[3:]
                if self.urls.get(url) is None:
                    self.urls[url] = "Not Yet Filled"
                    with self.neo.session(database="neo4j") as session:
                        query = 'MERGE (a:Article  { title: \'Not Yet Filled\', url: \'YYY\'  }) \nRETURN a'.replace('YYY', url)
                        result = session.run(query=query)
                with self.neo.session(database="neo4j") as session:
                    query = "MATCH (a:Article { title: 'XXX' }), (b:Article {url:'YYY'}) \n MERGE (a)-[r:RELATED_TO]->(b) \n RETURN a, b, r".replace('XXX', item['title']).replace('YYY', url)
                    result = session.run(query=query)
                print("Related Entries")
        return item

class RelatedEntriesPipeline:
    def open_spider(self, spider):
        self.neo = GraphDatabase.driver(URI, auth=AUTH )
        print(self.neo.get_server_info())
    def close_spider(self,spider):
        self.neo.close()
    def process_item(self, item, spider):
        return None

#MATCH (j:Person {name: 'Jennifer'})
#MATCH (m:Person {name: 'Mark'})
#MERGE (j)-[r:IS_FRIENDS_WITH]->(m)
#RETURN j, r, m

#Ok, we're gonna need to keep a set of which URL's we've added.
