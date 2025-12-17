function write_to_json(enriched_embeddings, config) {
  const embeddings_serialized = {};
  for (const [key, emb] of Object.entries(enriched_embeddings.embeddings)) {
    embeddings_serialized[key] = Array.from(emb.data);
  }
  enriched_embeddings.embeddings = embeddings_serialized;
  mkdirSync(config.out_dir, { recursive: true });
  const fullPath = path.join(config.out_dir, config.out);
  writeFileSync(fullPath, JSON.stringify(enriched_embeddings));
}
