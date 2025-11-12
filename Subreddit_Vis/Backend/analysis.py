import json
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt
import umap
import umap.plot
import networkx as nx
from scipy.cluster.hierarchy import linkage, dendrogram, to_tree
from sklearn.cluster import AgglomerativeClustering, AffinityPropagation
from sklearn.metrics import pairwise_distances,silhouette_score,silhouette_samples
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.covariance import LedoitWolf
from numpy.linalg import pinv
from numpy import quantile
from scipy.spatial import ConvexHull
from matplotlib.patches import Polygon
def load_enriched_embeddings(path="./data.json"):
  p=Path(path)
  with p.open("r", encoding="utf-8") as f:
      data = json.load(f)
      print(type(data))
      print(data.keys())
      users_df    = pd.DataFrame.from_dict(data['users'], orient='index')
      posts_df    = pd.DataFrame.from_dict(data['posts'], orient='index')
      comments_df = pd.DataFrame.from_dict(data['comments'], orient='index')
      words_df = pd.DataFrame.from_dict(data['words'], orient='index')
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

def user_words_to_vector(word_data, word_to_index, vocab_size):
  vec = np.zeros(vocab_size, dtype=np.float32)
  for word, info in word_data.items():
          if word in word_to_index:
            vec[word_to_index[word]] = info.get('frequency', 0)
          else:
              print("This word is not in our global word vector" + word)
  return vec

def frequency_table_to_vector(word_data, word_to_index, vocab_size):
  vec = np.zeros(vocab_size, dtype=np.float32)
  for word, count in word_data:
          if word in word_to_index:
            vec[word_to_index[word]] = count
          else:
            print("This word is not in our global word vector" + word)
  return vec


def calculate_word_vectors(data):
  users = data['users']
  posts = data ['posts']
  comments = data['comments']
  words = data['words']
  vocab_index = words.index.tolist()  # If you already have a column index, use that
  vocab_size = len(vocab_index)
  word_to_index = {word: idx for idx, word in enumerate(vocab_index)}
  print(len(word_to_index))
  users['word_count_vector'] = users['words'].apply(lambda wd: user_words_to_vector(wd, word_to_index, vocab_size))
  comments['word_count_vector'] = comments['frequency_table'].apply(lambda wd: frequency_table_to_vector(wd,word_to_index, vocab_size))
  posts['word_count_vector'] = posts['frequency_table'].apply(lambda wd:frequency_table_to_vector(wd,word_to_index,vocab_size))
  data['global_word_vector']  = words['frequency'].reindex(vocab_index).to_numpy(dtype=np.float32)

  return

def recursive_children_decorator(node,id_map):
    if node.is_leaf():
        node.children = [int(id_map[node.id]) ]
        return [int(id_map[node.id])]
    else:
        left_children = recursive_children_decorator(node.left,id_map)
        right_children = recursive_children_decorator(node.right,id_map)
        all_children = left_children + right_children
        node.children = all_children
        return all_children

def compute_silhouette_score(pca_embeddings, id_groups):
    all_ids = [idx for group in id_groups for idx in group]
    subset = pca_embeddings[all_ids]
    labels = np.concatenate([
        np.full(len(group), i) for i, group in enumerate(id_groups)
    ])
    if len(np.unique(labels)) < 2:
        return None  # Silhouette needs at least 2 distinct labels

    return silhouette_score(subset, labels)

def init_valid_flags(node):
  node.valid_subgroup = False
  if not node.is_leaf():
    init_valid_flags(node.left)
    init_valid_flags(node.right)

def compare_subgroups(node, pca_reduced_embeddings):
    init_valid_flags(node)
    node.valid_subgroup = True
    inner_silhouette_score = compute_silhouette_score(pca_reduced_embeddings, [node.left.children, node.right.children])
    break_left_score = compute_silhouette_score(pca_reduced_embeddings, [node.left.left.children,node.left.right.children,node.right.children])
    break_right_score = compute_silhouette_score(pca_reduced_embeddings, [node.left.children, node.right.left.children, node.right.right.children])
    if inner_silhouette_score > break_right_score:
        node.right.valid_subgroup = True
        pop_subgroups(node.right,node.right,node.left,pca_reduced_embeddings)
    else:
        node.right.left.valid_subgroup = True
        node.right.right.valid_subgroup = True
        pop_subgroups(node.right.left, node.right.left,node.right.right, pca_reduced_embeddings)
        pop_subgroups(node.right.right, node.right.right,node.right.left, pca_reduced_embeddings)
    if inner_silhouette_score > break_left_score:
        node.left.valid_subgroup = True
        pop_subgroups(node.left, node.left,node.right, pca_reduced_embeddings)
    else:
        node.left.left.valid_subgroup = True
        node.left.right.valid_subgroup = True
        pop_subgroups(node.left.right,node.left.right,node.left.left, pca_reduced_embeddings)
        pop_subgroups(node.left.left, node.left.left,node.left.right, pca_reduced_embeddings)

def check_other_splitting_conditions(node):
    if len(node.children) < 7:
        return False
    if node.is_leaf():
        return False
    return True

def pop_subgroups(node,ancestor,uncle,pca_reduced_embeddings):
    if not check_other_splitting_conditions(node):
        return
    ancestor_score = compute_silhouette_score(pca_reduced_embeddings, [ancestor.children, uncle.children])

    left_ids = set(node.left.children)
    right_ids = set(node.right.children)

    # Group 2: all other children from ancestor except those in node.left
    ancestor_ids = set(ancestor.children)
    rest_of_ancestor_left = list(ancestor_ids - left_ids)
    rest_of_ancestor_right = list(ancestor_ids - right_ids)
    left_score = compute_silhouette_score(pca_reduced_embeddings,[node.left.children,rest_of_ancestor_left,uncle.children])
    right_score = compute_silhouette_score(pca_reduced_embeddings,[node.right.children,rest_of_ancestor_right,uncle.children])
    if ancestor_score > left_score:
        node.left.valid_subgroup = False
        pop_subgroups(node.left,ancestor,uncle,pca_reduced_embeddings)
    else:
        node.left.valid_subgroup = True
        pop_subgroups(node.left,node.left, node.right, pca_reduced_embeddings)
    if ancestor_score > right_score:
        node.right.valid_subgroup = False
        pop_subgroups(node.right, ancestor, uncle, pca_reduced_embeddings)
    else:
        node.right.valid_subgroup = True
        pop_subgroups(node.right,node.right,node.left,pca_reduced_embeddings)
    return

def compute_umap_2d(embedding_matrix, n_neighbors=30, min_dist=0.05, metric="cosine", random_state=42):
    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        metric=metric,
        random_state=random_state,
        verbose=False
    )
    umap_2d = reducer.fit_transform(embedding_matrix)  # shape (N, 2)
    return umap_2d

def walk_subgroups(root):
    """Yield (node, children_ids) for every subgroup node (including root)."""
    stack = [root]
    while stack:
        node = stack.pop()
        yield node, node.children_ids
        stack.extend(node.subgroups)

def enumerate_subgroups(root):
    labels = {}
    i = 0
    for node, children in walk_subgroups(root):
        labels[node] = f"C{i}"
        i += 1
    return labels

def plot_umap_with_subgroups(
    umap_2d, ids, is_user_mask, subgroup_tree, point_size=6, alpha_points=0.25, alpha_hull=0.15
):
    """umap_2d: (N,2), ids: np.array of strings, is_user_mask: boolean array (N,)"""
    fig, ax = plt.subplots(figsize=(10, 8))

    # 1) all points (faint)
    ax.scatter(umap_2d[:,0], umap_2d[:,1], s=point_size, c="#888888", alpha=alpha_points, linewidths=0)

    # 2) users emphasized
    if is_user_mask is not None and is_user_mask.any():
        ax.scatter(umap_2d[is_user_mask,0], umap_2d[is_user_mask,1],
                   s=point_size+6, c="k", alpha=0.6, linewidths=0, label="users")

    # 3) subgroup hulls
    label_map = enumerate_subgroups(subgroup_tree)
    for node, children in walk_subgroups(subgroup_tree):
        pts = umap_2d[np.array(children, dtype=int)]
        if pts.shape[0] < 3:
            # Too few points for a hull: draw a small ring of points instead
            ax.scatter(pts[:,0], pts[:,1], s=point_size+10, facecolors="none", edgecolors="C0", alpha=0.5)
            continue

        try:
            hull = ConvexHull(pts)
            poly = Polygon(pts[hull.vertices], closed=True, facecolor="C0", edgecolor="C0", alpha=alpha_hull)
            ax.add_patch(poly)

            # Put a label at the centroid of the subgroup in UMAP space
            cx, cy = pts.mean(axis=0)
            ax.text(cx, cy, label_map[node], fontsize=9, ha="center", va="center", color="C0")
        except Exception:
            # Hull can fail for degenerate point sets; fall back to scatter
            ax.scatter(pts[:,0], pts[:,1], s=point_size+10, facecolors="none", edgecolors="C0", alpha=0.5)

    ax.set_title("UMAP of embeddings with subgroup overlays")
    ax.set_xlabel("UMAP-1")
    ax.set_ylabel("UMAP-2")
    ax.legend(loc="best", frameon=False)
    ax.grid(True, alpha=0.2)
    plt.tight_layout()
    plt.show()

def visualize_subgroups_with_umap(data, subgroup_tree):
    embedding_matrix = data["embedding_matrix"]
    ids = np.array(data["embedding_ids"])
    is_user = np.char.startswith(ids, "t2_")

    umap_2d = compute_umap_2d(embedding_matrix, n_neighbors=30, min_dist=0.05, metric="cosine", random_state=42)
    plot_umap_with_subgroups(umap_2d, ids, is_user, subgroup_tree)

class Subgroup_Node:
    def __init__(self, parent, children_ids,embedding_matrix):
        self.parent = parent
        self.subgroups = []
        self.user_locs = []
        self.user_ids=[]
        self.children_ids = children_ids
        cluster_points = embedding_matrix[children_ids]
        centroid = cluster_points.mean(axis=0)
        self.centroid = centroid
        centered_points = cluster_points - centroid
        ledoit = LedoitWolf().fit(centered_points)
        covariance_matrix = ledoit.covariance_
        inverse_covariance = pinv(covariance_matrix)
        self.inverse_covariance = inverse_covariance
        squared_distances_train = np.einsum('ij,jk,ik->i', centered_points, inverse_covariance, centered_points)
        cutoff = quantile(squared_distances_train, 0.95)
        self.cutoff = cutoff
    def is_inside_cluster(self, point,user_loc,id):
         diff = point - self.centroid
         isInside = float(diff @ self.inverse_covariance @ diff) <= self.cutoff
         if isInside:
             self.user_locs.append(user_loc)
             self.user_ids.append(id)
         return isInside
    def add_child_node(self, node):
        self.subgroups.append(node)

def sort_user_into_hierarchy(user_embedding,user_loc,node,id):
    if len(node.subgroups) >0:
      for subgroup in node.subgroups:
          if subgroup.is_inside_cluster(user_embedding,user_loc,id):
              sort_user_into_hierarchy(user_embedding,user_loc,subgroup,id)

def subgroup_hierarchy_tree(link_tree, embedding_matrix):

    root = Subgroup_Node(None,link_tree.children,embedding_matrix)
    traverse_link_tree(link_tree.left,root,embedding_matrix)
    traverse_link_tree(link_tree.right,root,embedding_matrix)
    return root

def traverse_link_tree(Node,subgroup_ancestor,embedding_matrix):
    if(Node.is_leaf()):
        return
    if Node.valid_subgroup:
       this_node = Subgroup_Node(subgroup_ancestor,Node.children,embedding_matrix)
       if subgroup_ancestor:
           subgroup_ancestor.add_child_node(this_node)
       traverse_link_tree(Node.left,this_node,embedding_matrix)
       traverse_link_tree(Node.right,this_node,embedding_matrix)
    else:
        traverse_link_tree(Node.left,subgroup_ancestor,embedding_matrix)
        traverse_link_tree(Node.right,subgroup_ancestor,embedding_matrix)

def clustering_labeling(data):
      embedding_matrix = data['embedding_matrix']
      ids = data['embedding_ids']
      is_comment = np.char.startswith(ids, 't1_')
      is_post    = np.char.startswith(ids, 't3_')
      is_user = np.char.startswith(ids, 't2_')
      is_text    = is_comment | is_post

      pca = PCA(n_components=0.8, svd_solver='full')
      pca_reduced_embeddings = pca.fit_transform(embedding_matrix)

      text_idx = np.where(is_text)[0]

      linkage_matrix = linkage(pca_reduced_embeddings[text_idx], method="ward")
      link_tree = to_tree(linkage_matrix)

      recursive_children_decorator(link_tree, text_idx)
      compare_subgroups(link_tree, pca_reduced_embeddings)
      subgroup_tree = subgroup_hierarchy_tree(link_tree, pca_reduced_embeddings)
      visualize_subgroups_with_umap(data, subgroup_tree)
      user_idx = np.where(is_user)[0]

      for i in user_idx:
        id = ids[i]
        subgroup_tree.user_ids.append(id)
        subgroup_tree.user_locs.append(i)
        user_embedding = pca_reduced_embeddings[i]
        sort_user_into_hierarchy(user_embedding, i, subgroup_tree,id)
      make_subgroup_df(subgroup_tree,data)
      find_word_count_differences(data)
      return

def make_subgroup_df(subgroup_tree, data):
    users_df = data['users']
    comments_df = data['comments']
    posts_df = data['posts']
    ids = data['embedding_ids']
    for df in (users_df, comments_df, posts_df):
        df["Subgroup_hierarchy"] = pd.Series([[] for _ in range(len(df))], index=df.index, dtype="object")
    def _append_to_df(id_str, subgroup_id):
        if id_str.startswith("t2_"):
            if id_str in users_df.index:
                users_df.at[id_str, "Subgroup_hierarchy"].append(subgroup_id)
        elif id_str.startswith("t1_"):
            if id_str in comments_df.index:
                comments_df.at[id_str, "Subgroup_hierarchy"].append(subgroup_id)
        elif id_str.startswith("t3_"):
            if id_str in posts_df.index:
                posts_df.at[id_str, "Subgroup_hierarchy"].append(subgroup_id)

    stack = []
    subgroup_objects = []
    group_id = 0
    stack.append((subgroup_tree, None, 0))
    while stack:
        node,parent,depth = stack.pop()
        subgroup_objects.append({
            'subgroup_id':group_id,
            'subgroup_texts':node.children_ids,
            'subgroup_user_locs':node.user_locs,
            'subgroup_centroid':node.centroid,
            'subgroup_span':node.cutoff,
            'subgroup_parent':parent,
            'subgroup_depth':depth,
        })
        for uid in getattr(node, "user_ids", []):
            _append_to_df(uid, group_id)
        for gi in node.children_ids:
            _append_to_df(ids[int(gi)], group_id)
        for subgroup in node.subgroups:
            stack.append((subgroup,group_id, depth+1))
        group_id += 1
    subgroups_df = pd.DataFrame.from_records(subgroup_objects)
    data['subgroups'] = subgroups_df
    print(subgroups_df.head())

def generate_labels(data):
    #We'll find exemplar texts
    #find the word count differences between groups, and several used/non-used words
    #We'll use these to produce a structured query for a local llm.
    #The query will include
    # The name of the reddit, the name of the supergroup (if any), what words are commonly used or not used in the reddit, and the texts of our 3-5 exemplars
    # We'll request a label which is 1-3 words long and is descriptive.
    return

def find_exemplar_texts(link_tree,data):
    # In our list of texts, we want to find their distances from the centroid.
    # An exemplar is either - A, one of the texts which is most close to the centroid
    # B A text which is in the top half in terms of distance from the centroid, and has higher engagement than other points
    # Engagement can either be upvotes or comments/replies
    # if one text is all of these things, we'll find a few more.
    return

def find_word_count_differences(data):
    ids   = np.array(data["embedding_ids"])
    subgroups_df = data['subgroups']
    comments = data['comments']
    posts = data['posts']
    global_counts= data['global_word_vector'].astype(np.float32)
    vocab = data["words"].index.tolist()
    V = global_counts.size

    summaries = []
    all_idx = (subgroups_df["subgroup_texts"]
               .explode().dropna().astype(int).unique())
    def _get_word_vector(gi):
        id_str = ids[gi]
        if id_str.startswith("t1_"):
            if id_str in comments.index:
                return comments.at[id_str, "word_count_vector"]
        elif id_str.startswith("t3_"):
            if id_str in posts.index:
                return posts.at[id_str, "word_count_vector"]
    vec_by_idx = {int(gi): _get_word_vector(int(gi)) for gi in all_idx}

    for text_list in subgroups_df['subgroup_texts']:
        summary = np.zeros_like(_get_word_vector(text_list[0]))
        for gi in text_list:
            vec = vec_by_idx.get(int(gi))
            if vec is not None:
                summary += vec
        summaries.append(summary)
    subgroups_df['subgroup_word_counts'] = summaries
    subgroups_df["wlogodds_z"] = [
    weighted_log_odds_z(vec.astype(np.float32), global_counts.astype(np.float32), alpha=1.0)
    for vec in subgroups_df["subgroup_word_counts"]
    ]
    group = 0
    for logs_odds in subgroups_df["wlogodds_z"]:
        print(f"Finding most common words for group {group} :")
        group += 1
        p = np.argsort(logs_odds)
        top5 = p[-5:][::-1]
        for word in top5:
            print(vocab[word])




def weighted_log_odds_z(y1, y_global, alpha=10.0):
    # y1: subgroup counts (V,)
    # y_global: global counts (V,)
    y2 = np.clip(y_global - y1, 0, None)  # background excluding the group
    n1, n2 = y1.sum(), y2.sum()
    # prior π: global probabilities
    pi = y_global / max(y_global.sum(), 1e-12)

    # smoothed probabilities
    p1 = (y1 + alpha * pi) / (n1 + alpha)
    p2 = (y2 + alpha * pi) / (n2 + alpha)

    # log-odds
    logit1 = np.log(p1) - np.log1p(-p1)
    logit2 = np.log(p2) - np.log1p(-p2)
    delta  = logit1 - logit2

    # variance approximation (Monroe et al.)
    var = 1.0 / (y1 + alpha * pi) + 1.0 / (y2 + alpha * pi)
    z = delta / np.sqrt(var)
    return z.astype(np.float32)



    # we should gather, summarize, and normalize the word counts between each of the different groups.
    # We should also have a normalized form of the entire subreddit wordcount.
    # The difference between the normalized form and the entire subreddit is the "Difference"
    # Then, for each subreddit we should find the words with the largest and smallest values - these are our summary.
    # Do we want to do any kind of elbow method here?
    # What about weighting by engagement?



data = load_enriched_embeddings()
calculate_word_vectors(data)
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