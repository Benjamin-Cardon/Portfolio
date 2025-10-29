import json
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from pathlib import Path

def load_enriched_embeddings(path="./data.json"):
  p=Path(path)
  with p.open("r", encoding="utf-8") as f:
      data = json.load(f)
      print(type(data))
      print(data.keys())
      comments_df = pd.DataFrame(data['comments'])
      posts_df = pd.DataFrame(data['posts'])
      words_df = pd.DataFrame(data['words'])
      users_df = pd.DataFrame(data['users'])
      embedding_ids = list(data["embeddings"].keys())
      embedding_matrix = np.array(list(data['embeddings'].values()),dtype='float32')
      print(embedding_matrix.shape)
      pca = PCA()
      pca.fit(embedding_matrix)
      # plt.figure(figsize=(8, 6))
      # plt.scatter(embeddings_2d[:, 0], embeddings_2d[:, 1], s=10, alpha=0.7)
      # plt.title("PCA Projection of Reddit Embeddings")
      # plt.xlabel("Principal Component 1")
      # plt.ylabel("Principal Component 2")
      # plt.show()
      # print(pca.explained_variance_ratio_)
      # print("Total variance explained:", np.sum(pca.explained_variance_ratio_))
      plt.plot(np.cumsum(pca.explained_variance_ratio_))
      plt.xlabel('Number of Components')
      plt.ylabel('Cumulative Explained Variance')
      plt.title('Explained Variance Curve')
      plt.grid(True)
      plt.show()

load_enriched_embeddings()
