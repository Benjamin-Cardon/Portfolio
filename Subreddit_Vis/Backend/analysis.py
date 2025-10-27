import json
import numpy as np
import pandas as pd
from pathlib import Path

def load_enriched_embeddings(path="./data.json"):
  p=Path(path)
  with p.open("r", encoding="utf-8") as f:
      root = json.load(f)
      print(type(root))
      print(root.keys())


load_enriched_embeddings()
