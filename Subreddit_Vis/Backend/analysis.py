import json
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt
import umap
import umap.plot
from sklearn.cluster import HDBSCAN , AgglomerativeClustering
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
      pca = PCA(n_components=0.9, svd_solver='full')
      pca_reduced_embeddings = pca.fit_transform(embedding_matrix)
      hdb = HDBSCAN(min_cluster_size=5, min_samples=2, metric='cosine', cluster_selection_epsilon=0.05).fit(pca_reduced_embeddings)
      ward = AgglomerativeClustering(n_clusters=10, linkage='ward')
      labels = ward.fit_predict(pca_reduced_embeddings)

      unique_labels, counts = np.unique(hdb.labels_, return_counts=True)
      for label, count in zip(unique_labels, counts):
        print(f"Cluster {label}: {count} points")
      probs_by_label = pd.DataFrame({
      'label': hdb.labels_,
      'probability': hdb.probabilities_}).groupby('label')['probability'].describe()
      print(probs_by_label)
      print(pd.Series(hdb.probabilities_).describe())
      mapper = umap.UMAP().fit(pca_reduced_embeddings)
      umap.plot.points(mapper, labels=labels, color_key_cmap='Spectral')
      plt.show()
load_enriched_embeddings()
