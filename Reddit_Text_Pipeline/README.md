## What it does

This project is a **command-line data pipeline** that collects public, SFW subreddit content and produces a  JSON dataset that’s easy to load into Python (Pandas/NumPy), SQL, or other analytics tools.

It’s designed to capture:

- **Conversation structure:** posts, comments, reply relationships
- **Engagement metrics:** upvotes/downvotes (estimated), comment counts, direct replies
- **Analysis features:** lemmatized word frequency, sentiment, and semantic embeddings

---

## Who it’s for

The tool is meant to support user research or serve as an initial stage in a larger ML / automation pipeline.

**Primary audiences:**
- Advertising / marketing / growth teams
- Product managers and user researchers
- ML / automation engineers who want structured training/EDA data

**Secondary audiences:**
- Academics studying social structure and communication
- Political communication / discourse analysis (public but anonymous topic communities)

> **Status:** At its current stage, this tool is best suited for engineers and the technically savvy. See **Roadmap** below.
---

## Why Reddit?

Unlike platforms like Facebook, Instagram, LinkedIn, or TikTok, Reddit is made up of **public, anonymous communities organized around topics of interest**. That makes it easier to find *topic-defined* groups of potential customers and compare how subgroups communicate.

Examples:
- `r/tractors` → These individuals discuss the specific pros and cons of different tractor brands and models
- `r/gamingnews` → Members of this community both spend money on games, and vocally (often offensively) discuss their opinions on the state of the industry.
- `r/taylorswift` → A psychological goldmine for anyone interested in selling products to women in the US aged 30-50.
- `r/aquaculture` → industry-adjacent practitioners (fish farming)

---

## What it outputs

The program runs either:
- a **single subreddit task**, or
- a **batch of subreddit tasks** (from a comma-separated task file)

Each task writes one output file: `*.json`

When a task succeeds, the JSON includes these top-level objects:

```json
{
  "posts": {},
  "comments": {},
  "users": {},
  "words": {},
  "texts": {},
  "embeddings": {}
}
```

Each top level object is like an indexed "Table". Each member of these objects is like a "Row," reflecting a single instance of it's parent. ie: posts contains many post objects. The keys of each member are their Reddit fullnames. A fullname is a reddit unique identifier, which includes a prefix which tells us an objects type.

The dataset includes:

- who authored each post/comment and how much engagement it received
- sentiment labeling per text (positive/negative/neutral) + score
- semantic embedding per text + average embedding per user (when available)
- which words were used in which posts/comments (and how often)
- aggregated per-user word usage + sentiment breakdown
- user-to-user interaction edges (who replied to whom)
- original post/comment text

**Schema docs**
- Full schema reference: `docs/03_Output_Data_Schema_Reference`
- Minimal worked example: `docs/example.dataengineering.json`

---

## Quickstart

### ⚠️ Not “plug and play” yet

There are two setup requirements:

### 1) Reddit API credentials
Reddit requires a developer app + credentials to access their API. The file `batch/auth/.env` must be filled with valid values for the code to work.

- `REDDIT_CLIENTID`
- `REDDIT_SECRET`
- `REDDIT_USERNAME`
- `REDDIT_PASSWORD`

> If you came here from Upwork, you can **message me there** and I can give you my own credentials.

### 2) Local transformer models (ONNX)
This repo does **not** include the transformer models. You’ll need to download and place them in your local models folder.

Models used:
- `all-MiniLM-L6-v2` (embeddings)
- `cardiffnlp_roberta` (sentiment)

These are available on Hugging Face, but they must be **converted/structured as ONNX** to run with the Node transformers setup.

Why these models?
- they're free.
- they're small enough to run locally on a laptop
- They have strong performance relative to their size
- they were trained/tuned on social media text data

Two short asides on the models:

Unfortunately, bigger is sometimes better. Although I found these models to have satisfactory outputs, using a more powerful but compute heavy set of models would actually significantly improve analytical performance.

As of now, the code is written to expect the particular outputs of these models. Easily switching models is not currently possible. However, configurable model types are included in my roadmap as an aspirational goal.

**Setup Docs**
- Reddit Auth Setup: `docs/<SETUP_GUIDE_REDDIT>` for step-by-step setup and model placement.`
- Model Setup:`docs/<SETUP_GUIDE_TRANSFORMERS>` for step-by-step setup and model placement.`


---

## Examples

### Single subreddits

**Full mode**

In full mode, all the posts and comments in a subreddit are gotten and analyzed. `r/dataengineering` has around 750 posts.

```bash
node index.js --subreddit=dataengineering --mode=full
```

**Count mode**
For large, active, and old subreddits, full mode would get a massive amount of data, and take literally days.

In these cases, count mode is more appropriate.

```bash
node index.js --subreddit=woodworking --mode=count --count=2000
```

note: This is still a substantial job. Each post can have hundreds or thousands of comments, so two thousand posts may involve several hundred thousand texts.


### Batch mode (run many tasks)

In batch mode, the tool reads a comma-separated file where each line describes a single task.

For a batch process, a file is produced for each task. If a task fails, an error log is produced and written instead of the data. At the end of a batch, an additional batch manifest is written to the directory, with basic information about each task run in the batch.

```bash
node index.js --file=./batches/musictasks.csv --out_dir=./data_outputs --log_level=info
```

This file might look like this. It does not need a .csv ending to be read.

```
--subreddit=music --mode=count --count=200 --out=music_200.json,
--subreddit=taylorswift --mode=count --count=200 --out=eras_200.json,
--subreddit=sabrinacarpenter --mode=full --out=fullshortnsweet.json,
--subreddit=depechemode --mode=full,
--subreddit=Mozart --mode=count --count=1000 --out=salieristears.json,
```

`--out_dir` determines which directory the files will be written to. If it does not exist, it will be created. Files are produced with overwrite. `--out` determines the name of a specific file. `--out_dir`,`--log_level`, and `--out` can be used as optional arguments on single tasks. In batch mode tasks, however, `--out_dir` and `log_level` values are overridden by the values called from the terminal.

`--log_level` can be called with three valid inputs, which are info, debug, and quiet. info is the default.

**Code Docs:**
- CLI: `docs/02_Command_Line_Reference`
- Architecture: `docs/04_Technical_Architecture_Overview`
---

## Performance & limitations

### 1) Reddit API rate limiting
The free Reddit API is rate-limited (at time of writing: ~1000 requests / 10 minutes). Each request can fetch up to ~100 posts, but each post requires additional requests to retrieve and rebuild comment trees.

- **Small → medium subreddits:** typically fast and practical
- **Very large subreddits (millions of posts):** impractical under free-tier rate limits

### 2) Compute time (local NLP)
Sentiment + embeddings are lightweight *relative to large LLMs*, but still take time as text volume grows.

Runtime depends primarily on:
- number of posts
- number of comments per post
- vocabulary size (affects some aggregation steps)

Rule of thumb for timescales:
- small/medium subreddits: `r/ToyataSienna` --> Instant to “grab a coffee”
- medium/large subreddits + batches: `r/SabrinaCarpenter`--> may take hours
- large subreddits + batches: `r/HomeImprovement` --> can become overnight/multi-day
- very large subreddits: `r/politics`--> infeasible, weeks, would probably crash

---

## Roadmap

- **0.1 Add-ons:** unit tests, batch scripting helpers, TypeScript types
- **1)** Visualization + clustering + cross-feature correlation + report generation
- **2)** HTTPS API endpoint to serve the engine’s capabilities
- **3)** Cloud-hosted UI to request reports/data
- **4)** Cloud-hosted interactive visualization tool for EDA
