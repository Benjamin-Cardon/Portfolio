import json
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt
import umap
import umap.plot
from sklearn.cluster import AgglomerativeClustering, AffinityPropagation
from sklearn.metrics import pairwise_distances,silhouette_score
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
      pca = PCA(n_components=0.8, svd_solver='full')
      pca_reduced_embeddings = pca.fit_transform(embedding_matrix)
      scores = []
      cluster_range = range(2, 7)  # try from 2 to 14 clusters

      for k in cluster_range:
        clusterer = AgglomerativeClustering(n_clusters=k, linkage='ward')
        labels = clusterer.fit_predict(pca_reduced_embeddings)
        score = silhouette_score(pca_reduced_embeddings, labels)
        scores.append(score)

      plt.plot(cluster_range, scores, marker='o')
      plt.xlabel("Number of clusters")
      plt.ylabel("Silhouette Score")
      plt.title("Silhouette Scores for Different Cluster Counts")
      plt.show()

      # afp = AffinityPropagation(preference=preference)
      # afp.fit(pca_reduced_embeddings)
      # exemplar_indices = afp.cluster_centers_indices_
      # exemplar_labels = afp.labels_
      # exemplars = [pca_reduced_embeddings[i] for i in exemplar_indices]
      # print(f"\n[INFO] Total clusters: {len(exemplar_indices)}")
      # print("[INFO] Exemplar IDs (data points that represent each cluster):")
      # for idx, eid in enumerate(exemplars):
      #   print(f"  Cluster {idx}: ID {eid}")


      # mapper = umap.UMAP().fit(pca_reduced_embeddings)
      # umap.plot.points(mapper, labels=afp.labels_, color_key_cmap='Spectral')
      # plt.show()
load_enriched_embeddings()
