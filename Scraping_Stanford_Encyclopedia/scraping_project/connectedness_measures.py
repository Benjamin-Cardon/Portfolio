from neo4j import GraphDatabase
from queue import Queue
from dotenv import load_dotenv
import os
load_dotenv()

URI=os.getenv('URI')
AUTH_USER=os.getenv('AUTH_USER')
AUTH_PASSWORD=os.getenv('AUTH_PASSWORD')
DATABASE=os.getenv('DATABASE')
AUTH = (AUTH_USER, AUTH_PASSWORD)

neo = GraphDatabase.driver(URI, auth=AUTH )
query = "MATCH (a:Article) return a"

def connectedness_measures():
  with neo.session(database=DATABASE) as session:
    query = "MATCH (a:Article) return a"
    result = session.run(query)
    raw_names = result.data()
    list_of_names = []
    for raw_name in raw_names:
      list_of_names.append(raw_name['a']['title'])
    name_set = set(list_of_names)
    unique_names = list(name_set)
    count = 0
    nodes_connectedness = dict()
    relationships_connectedness = dict()
    nodes_distance = dict()
    for name in unique_names:
       count += 1
       article_shortest_paths = find_paths_for_article(session=session, article=name)
       inter_nodes = find_all_inter_nodes(article_shortest_paths)
       inter_relationships = find_all_inter_relationship(article_shortest_paths)
       for node in inter_nodes:
          if node in nodes_connectedness:
             nodes_connectedness[node] += inter_nodes[node]
          else:
             nodes_connectedness[node] = inter_nodes[node]
       for relationship in inter_relationships:
          if relationship in relationships_connectedness:
             relationships_connectedness[relationship] += inter_relationships[relationship]
          else:
             relationships_connectedness[relationship] = inter_relationships[relationship]
       for article in article_shortest_paths:
          if article in nodes_distance:
             nodes_distance[article] += article_shortest_paths[article]['steps']
          else:
             nodes_distance[article] = article_shortest_paths[article]['steps']
       if count % 10 == 0:
          #print(nodes_connectedness)
          print(count)
          #print(nodes_distance)
    update_graph_node_connectedness(nodes_connectedness=nodes_connectedness,session=session)
    update_graph_node_distance(nodes_distance=nodes_distance, session=session)
    update_graph_relationship_connectedness(relationships_connectedness=relationships_connectedness,session=session)




def update_graph_node_connectedness(nodes_connectedness, session):
   for node in nodes_connectedness:
      connectedness = nodes_connectedness[node]
      query = "Match (a:Article {{title:'{title}'}}) Set a.connectivity = {connectivity} Return a".format(title=node, connectivity=connectedness)
      session.run(query)

def update_graph_node_distance(nodes_distance, session):
   for node in nodes_distance:
      distance = nodes_distance[node]
      query = "Match (a:Article {{title:'{title}'}}) Set a.total_distance = {distance} Return a".format(title=node, distance=distance)
      session.run(query)

def update_graph_relationship_connectedness(relationships_connectedness,session):
   for relate in relationships_connectedness:
      nodes = relate.split("+++")
      connectedness = relationships_connectedness[relate]
      query = "Match (a:Article {{title:'{node1}'}})-[r:RELATED_TO]->(b:Article{{title:'{node2}'}}) SET r.connectivity={connectivity} Return r".format(node1=nodes[0], node2=nodes[1],connectivity=connectedness)
      session.run(query)


def find_paths_for_article(session, article):
  paths = {article:{'paths':[], 'steps':0}}
  first_path = [article]
  paths[article]['paths'].append(first_path)
  q = Queue(maxsize=0)
  q.put(article)

  while not q.empty():
    current_node_title = q.get()
    query = "MATCH (a:Article {{ title:'{title}' }})-[r:RELATED_TO]->(b:Article) return b".format(title=current_node_title)
    result = session.run(query)
    for neighbor in result:
       neighbor_title = neighbor['b']['title']
       #print(neighbor_title)

       if neighbor_title not in paths:
          #print("Branch B")
          q.put(neighbor_title)
          new_paths = []
          for path in paths[current_node_title]['paths']:
            new_path = []
            for step in path:
               new_path.append(step)
            new_paths.append(new_path)
          for new_path in new_paths:
             new_path.append(neighbor_title)
          paths[neighbor_title] = {'paths':new_paths, 'steps': paths[current_node_title]['steps']+1}
          continue

       if paths[neighbor_title]['steps'] == paths[current_node_title]['steps'] + 1:
          #print("Branch A")
          new_paths = []
          for path in paths[current_node_title]['paths']:
            new_path = []
            for step in path:
               new_path.append(step)
            new_paths.append(new_path)
          for new_path in new_paths:
             new_path.append(neighbor_title)
             paths[neighbor_title]['paths'].append(new_path)
  return paths

def find_all_inter_nodes(article_paths):
   total_intermediaries = dict()
   for article in article_paths:
      intermediaries = set()
      for path in article_paths[article]['paths']:
         intermediaries.update(path[1:-1])
      for val in intermediaries:
         if val in total_intermediaries:
            total_intermediaries[val] += 1
         else:
            total_intermediaries[val] = 1
   return total_intermediaries


def find_all_inter_relationship(article_paths):
   total_intermediaries = dict()
   for article in article_paths:
      intermediaries = set()
      for path in article_paths[article]['paths']:
         for i in range(1, len(path), 1):
            intermediaries.add(path[i-1] + "+++" + path[i])
      for val in intermediaries:
         if val in total_intermediaries:
            total_intermediaries[val] += 1
         else:
            total_intermediaries[val] = 1
   return total_intermediaries

connectedness_measures()