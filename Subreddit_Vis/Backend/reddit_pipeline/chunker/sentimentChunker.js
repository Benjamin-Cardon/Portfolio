async function sentiment_chunker_and_aggregator(text) {
  // if the text is less than 512 characters long, there is no need to chunk it.
  const chunks = chunk_text(text);
  const chunk_promises = chunks.map(async (chunk) => {
    let labels = await sentiment(chunk, { topk: null });
    return {
      weight: chunk.length / text.length,
      labels
    }
  })
  const labels_and_weights = await Promise.all(chunk_promises);
  return labels_and_weights.reduce((acc, curr) => {
    acc[0].score += curr.labels[0].score * curr.weight;
    acc[1].score += curr.labels[1].score * curr.weight;
    acc[2].score += curr.labels[2].score * curr.weight;
    return acc;
  }, [{ label: 'NEGATIVE', score: 0 }, { label: 'NEUTRAL', score: 0 }, { label: "POSITIVE", score: 0 },]).reduce((acc, curr) => {
    if (curr.score >= acc.score) {
      return curr;
    } else {
      return acc;
    }
  }, { label: '', score: 0 });
}