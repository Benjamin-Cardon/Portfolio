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
        self.related_urls = {}
        print(self.neo.get_server_info())
    def close_spider(self,spider):
        self.neo.close()
        print(self.related_urls)
        print(len(self.urls))
        print(len(self.related_urls))
        print(compare_url_objects(self.urls.keys(),self.related_urls.keys()))


    def process_item(self, item, spider):
        if self.urls.get(item['url']) is None:
            self.urls[item['url']] = item['title']
            with self.neo.session(database="neo4j") as session:
                query = 'MERGE (a:Article  { title: \'XXX\', url: \'YYY\'  }) \nRETURN a'.replace('XXX', item['title']).replace('YYY', item['url'])
                session.run(query=query)
        elif self.urls.get(item['url']) == "Not Yet Filled":
            self.urls[item['url']] = item['title']
            with self.neo.session(database="neo4j") as session:
                query = 'MATCH (a:Article  { title: \'XXX\', url: \'YYY\'  }) \n SET a.title = "ZZZ" \n RETURN a'.replace('XXX', "Not Yet Filled").replace('YYY', item['url']).replace('ZZZ',item['title'])
                session.run(query=query)

        related_entries = BeautifulSoup(item['related_entries']).find_all('a')
        if len(related_entries) > 0:
            for related_entry in related_entries:
                related_entry_ref = related_entry.get('href')
                if related_entry_ref[0:5] == 'https':
                    url = related_entry_ref
                elif related_entry_ref[0:3] == "../":
                    url = "https://plato.stanford.edu/entries/" + related_entry_ref[3:]
                else:
                    url = "Non-standard Reference URL"
                # Handling quirk of how some entries are stored

                if self.related_urls.get(url) is None:
                    self.related_urls[url] = 1
                else:
                    self.related_urls[url] += 1

                if self.urls.get(url) is None:
                    self.urls[url] = "Not Yet Filled"
                    with self.neo.session(database="neo4j") as session:
                        query = 'MERGE (a:Article  { title: \'Not Yet Filled\', url: \'YYY\'  }) \nRETURN a'.replace('YYY', url)
                        result = session.run(query=query)
                with self.neo.session(database="neo4j") as session:
                    query = "MATCH (a:Article { title: 'XXX', url: 'ZZZ' }), (b:Article {url:'YYY'}) \n MERGE (a)-[r:RELATED_TO]->(b) \n RETURN a, b, r".replace('XXX', item['title']).replace('YYY', url).replace('ZZZ', item['url'])
                    result = session.run(query=query)
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
def compare_url_objects(urls,related_urls):
    related_urls_set = set(related_urls)
    urls_set = set(urls)
    keys_not_in_related_urls = urls_set - related_urls_set
    keys_not_in_urls = related_urls_set - urls_set
    print("keys is urls not in related urls", list(keys_not_in_related_urls))
    print("keys in related urls not in urls", list(keys_not_in_urls))
    return list(keys_not_in_related_urls.union(keys_not_in_urls))
