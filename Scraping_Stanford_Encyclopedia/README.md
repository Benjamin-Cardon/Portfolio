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

#### 4 Compute connectedness metrics (optional)

This script reads the current Neo4j graph and writes back connectivity/distance properties.

connectedness_measures

```python connectedness_measures.py```