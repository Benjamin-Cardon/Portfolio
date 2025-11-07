import json
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt
import umap
import umap.plot
from scipy.cluster.hierarchy import linkage, dendrogram, to_tree
from sklearn.cluster import AgglomerativeClustering, AffinityPropagation
from sklearn.metrics import pairwise_distances,silhouette_score,silhouette_samples
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
      texts= data['texts']
      return {
    "comments": comments_df,
    "posts": posts_df,
    "words": words_df,
    "users": users_df,
    "embedding_ids": embedding_ids,
    "embedding_matrix": embedding_matrix,
    "texts": texts
}

def calculate_word_vectors(data):
   print("Do I need this function?")
   return
def recursive_children_decorator(node):
    if node.is_leaf():
        return [node.id]
    else:
        left_children = recursive_children_decorator(node.left)
        right_children = recursive_children_decorator(node.right)
        all_children = left_children + right_children
        node.children = all_children
        return all_children

def compare_subgroups(node, pca_reduced_embeddings):
    inner_silhouette_score = compute_silhouette_score(pca_reduced_embeddings, [node.left.children, node.right.children])
    break_left_score = compute_silhouette_score(pca_reduced_embeddings, [node.left.left.children,node.left.right.children,node.right.children])
    break_right_score = compute_silhouette_score(pca_reduced_embeddings, [node.left.children, node.right.left.children, node.right.right.children])
    break_right_left_score = compute_silhouette_score(pca_reduced_embeddings, [node.left.left.children,node.left.right.children,node.right.left.children,node.right.right.children])
    print ("This is the non-broken score", inner_silhouette_score)
    print("This is the left broken score", break_left_score)
    print ("this is the right broken score", break_right_score)
    print ("this is the fully broken score", break_right_left_score)

def compute_silhouette_score(pca_embeddings, id_groups):
    all_ids = [idx for group in id_groups for idx in group]
    subset = pca_embeddings[all_ids]
    labels = np.concatenate([
        np.full(len(group), i) for i, group in enumerate(id_groups)
    ])
    if len(np.unique(labels)) < 2:
        return None  # Silhouette needs at least 2 distinct labels

    return silhouette_score(subset, labels)


def clustering_labeling(data):
      embedding_matrix = data['embedding_matrix']
      texts_df = pd.DataFrame(list(data["texts"].items()), columns=["id", "text"])

      pca = PCA(n_components=0.8, svd_solver='full')
      pca_reduced_embeddings = pca.fit_transform(embedding_matrix)
      linkage_matrix = linkage(pca_reduced_embeddings, method="ward")
      link_tree = to_tree(linkage_matrix)
      recursive_children_decorator(link_tree)
      print("Comparing for Root")
      compare_subgroups(link_tree, pca_reduced_embeddings)
      print("Comparing for left")
      compare_subgroups(link_tree.left,pca_reduced_embeddings)
      print("comparing for right")
      compare_subgroups(link_tree.right,pca_reduced_embeddings)
      return
      # plt.figure(figsize=(12, 6))
      # dendrogram(linkage_matrix, truncate_mode="level", p=7)  # Show only top 5 levels
      # plt.title("Agglomerative Clustering Dendrogram (Truncated)")
      # plt.xlabel("Sample index or (cluster size)")
      # plt.ylabel("Distance")
      # plt.show()
      # return

data = load_enriched_embeddings()
clustering_labeling(data)

      # max_score = 0
      # top_cluster_count = 0
      # best_clusterer = None
      # best_labels = None
      # for k in range(2, 7):
      #   clusterer = AgglomerativeClustering(n_clusters=k, linkage='ward')
      #   labels = clusterer.fit_predict(pca_reduced_embeddings)
      #   score = silhouette_score(pca_reduced_embeddings, labels)
      #   if score > max_score:
      #       best_clusterer = clusterer
      #       best_labels = labels
      #       max_score = score
      #       top_cluster_count = k
      #   # print (best_clusterer.n_leaves_)
      #   # print(top_cluster_count)
      #   # print(max_score)
      #   mapper = umap.UMAP().fit(pca_reduced_embeddings)
      #   umap.plot.points(mapper, labels=best_labels, color_key_cmap='Spectral')
      #   plt.show()
      #   sil_scores = silhouette_samples(pca_reduced_embeddings, labels)
      #   df = pd.DataFrame({
      #       'id': data['embedding_ids'],
      #       'label': labels,
      #       'silhouette': sil_scores
      #   })
        # print(df['label'].value_counts())
        # top_ids_per_cluster = (
        #     df.sort_values('silhouette', ascending=False)
        #       .groupby('label')
        #       .head(5)
        # )
        # merged = top_ids_per_cluster.merge(texts_df, on='id', how='left')
        # print(merged[['label', 'silhouette', 'id', 'text']])


      # print(embedding_matrix.shape)

      # scores = []
      # cluster_range = range(2, 7)  # try from 2 to 14 clusters




      # plt.plot(cluster_range, scores, marker='o')
      # plt.xlabel("Number of clusters")
      # plt.ylabel("Silhouette Score")
      # plt.title("Silhouette Scores for Different Cluster Counts")
      # plt.show()

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