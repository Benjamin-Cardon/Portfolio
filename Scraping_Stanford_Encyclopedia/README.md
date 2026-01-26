## Summary
This project scrapes the Stanford Encyclopedia of Philosophy index page, then crawls the entries to find which links exist between articles. It stores the associated information in a Neo4j graph database, where each node is an article and each edge is a link on the encyclopedia.

It also contains a script which calculates graph connectedness metrics for the Neo4j graph created.

## Requirements

- Python 3.10+ (recommended)
- A running Neo4j instance + a target database name
- Python packages (typical):
  - `scrapy`
  - `neo4j`
  - `python-dotenv`
  - `beautifulsoup4`
  - `twisted`

---
## Setup

### 1 Create `.env` and Neo4j Database

In order for the project to run correctly, you must have a running instance of a Neo4j database on your computer. The simplest way to achieve this is probably by using the Neo4j Desktop Application. Information on how to download and setup both the Desktop application and a Neo4j database is best found on the Neo4j website here. https://neo4j.com/

This project loads the Neo4j config via environment variables.

Create a file named `.env` in the project root:

```env
URI=neo4j+s://<your-hostname>:7687
AUTH_USER=neo4j
AUTH_PASSWORD=<your-password>
DATABASE=neo4j
```

### 2 Install dependencies

If you wish to use a virtual environment for this project, you can make and activate it using the following commands.

```python -m venv .venv```

#### Windows:
```.venv\Scripts\activate```

#### macOS/Linux:
```source .venv/bin/activate```


Then, you can install the dependencies with the following script

``` pip install scrapy neo4j python-dotenv beautifulsoup4 twisted```

### 3 Run
#### Crawl + build the graph

The provided runner crawls with MainSpider, then CleanupMainSpider, then deletes remaining placeholder nodes.

```python process.py```

### 4 Compute connectedness metrics (optional)

This script reads the current Neo4j graph and writes back connectivity/distance properties.

connectedness_measures

```python connectedness_measures.py```

## Nerd Stuff: Why This Project, Data Model, Pipeline
### Why this Project?
#### What is the Stanford Encyclopedia of Philosophy?
The Stanford Encyclopedia of Philosophy (SEP) is a highly curated, free, online encyclopedia on philsophy and philosophical topics.

It is also one of the older websites, as Stanford was one of the major organizations involved with the birth and development of the internet.

Articles on the SEP are written by experts in their topics, usually professors at respected universities with advanced degrees.

#### Why Scrape it into a Graph?

Each article includes links to 'Related' Articles, defined by the Author of that individual article. This means that the structure of the page is one which has been created collaboratively and emergently, not through top-down definition.

The SEP is therefore our best approximation of the field of philosophy as a whole. Using web scraphing we can examine the whole website, not just an individual article.

This is a simple visualization which displays the structure of the Encyclopedia

![Whole_Graph_Plain](<Whole_Graph_Plain.png>)

### Data Model


Our Data model is simple. Articles are 'Related To' other articles. These represent hyperlink citations on an article to another article. However, this simple data model allows a great deal of analysis.

Simply by examining 'In-Degree', or the number of times an article is cited by another article, we can get a simple approximation of the most central/important topics in the field of philosophy.

![Top_In_Degree](<Top_In_Degree.png>)

Different models for centrality, such as PageRank or Eigen-Centrality also produce different orderings, showing the relatively different status of topics.

![Eigen_Centrality](<Eigen_Centrality.png>)

We can use community recognition algorithms, such as Louvain, to determine what the naturally emergent communities within the encyclopedia are. Doing so, and scaling nodes according to their relative Centrality/Influence, gives us a more dynamic view of the field as a whole.

![Colored_Scaled](<Colored_Scaled.png>)


