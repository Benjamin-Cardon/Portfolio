Intro
This project scrape the Stanford Encyclopedia of Philosophy index page, then crawls the entries to find which links exist between articles. It stores the associated information in a Neo4j graph database, where each node is an article and each edge is a link on the encyclopedia.

It also contains a script which calculates graph connectedness metrics for the Neo4j graph created.

## Requirements

- Python 3.10+ (recommended)
- A running Neo4j instance + a target database name
- Python packages (typical):
  - `scrapy`
  - `neo4j`
  - `python-dotenv`
  - `beautifulsoup4`
  - `twisted` :contentReference[oaicite:13]{index=13} :contentReference[oaicite:14]{index=14} :contentReference[oaicite:15]{index=15}

---
## Setup

### 1 Create `.env`

This project loads Neo4j config via environment variables. :contentReference[oaicite:16]{index=16} :contentReference[oaicite:17]{index=17} :contentReference[oaicite:18]{index=18}

Create a file named `.env` in the project root:

```env
URI=neo4j+s://<your-hostname>:7687
AUTH_USER=neo4j
AUTH_PASSWORD=<your-password>
DATABASE=neo4j
```
python -m venv .venv

#### Windows:
```.venv\Scripts\activate```

#### macOS/Linux:
```source .venv/bin/activate```

### 2 Install dependencies
pip install scrapy neo4j python-dotenv beautifulsoup4 twisted

### 3 Run
#### Crawl + build the graph

The provided runner crawls with MainSpider, then CleanupMainSpider, then deletes remaining placeholder nodes.

```python process.py```

#### 4 Compute connectedness metrics (optional)

This script reads the current Neo4j :Article graph and writes back connectivity/distance properties.

connectedness_measures

```python connectedness_measures.py```