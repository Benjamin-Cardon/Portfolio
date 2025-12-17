function stack_average_user_embeddings(enriched_embeddings) {
  const { users, embeddings } = enriched_embeddings;
  for (const [user_id, user] of Object.entries(users)) {
    const text_embeddings = []
    for (const text_id of user.text_ids) {
      const embedding = embeddings[text_id]
      if (embedding) {
        text_embeddings.push(embedding)
      }
    }
    if (text_embeddings.length == 0) {
      continue
    }
    if (text_embeddings.length == 1) {
      user.only_one_text = true;
    } else {
      user.only_one_text = false;
    }
    const stacked = stack(text_embeddings, 0);
    const mean_embedding = mean(stacked, 0).squeeze();
    const embedding_norm = mean_embedding.norm();
    const invNorm = 1 / embedding_norm.data[0];  // extract scalar, take reciprocal
    const normalized = mean_embedding.mul(invNorm);
    if (!user.only_one_text) {
      enriched_embeddings.embeddings[user_id] = normalized;
    }
  }
}
