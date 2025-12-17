export function chunk_text(text) {
  const chunks = []
  if (text.length < 512) {
    chunks.push(text);
    return chunks;
  }

  const paragraphs = text.split(/\n\s*\n/);

  for (const paragraph of paragraphs) {
    chunks.push(...chunk_paragraph(paragraph));
  }
  return chunks;
}

function chunk_paragraph(paragraph) {
  const paragraph_chunks = [];
  if (paragraph.length < 512) {
    paragraph_chunks.push(paragraph);
    return paragraph_chunks
  }
  const sentences = nlp.readDoc(paragraph.trim()).sentences().out();
  paragraph_chunks.push(...chunk_sentences(sentences))
  return paragraph_chunks;
}

function chunk_sentences(sentences) {
  const chunks = [];
  let currentChunk = '';
  for (let sentence of sentences) {
    if (sentence.length > 512) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      chunks.push(...chunk_long_sentence(sentence.trim()))
      continue;
    }
    if ((currentChunk + ' ' + sentence).trim().length <= 512) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

function chunk_long_sentence(long_sentence) {
  const words = nlp.readDoc(long_sentence).tokens().out();
  const chunks = [];
  let currentChunk = '';

  for (const word of words) {
    if (word.length > 512) {
      // extreme case: a single word longer than limit
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      chunks.push(...chunk_incoherently_long_string(word));
      continue;
    }

    if ((currentChunk + ' ' + word).trim().length <= 512) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      chunks.push(currentChunk.trim());
      currentChunk = word;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

function chunk_incoherently_long_string(incoherently_long_string) {
  const numParts = Math.ceil(incoherently_long_string.length / 512);
  const partSize = Math.ceil(incoherently_long_string.length / numParts);
  const parts = [];

  for (let i = 0; i < incoherently_long_string.length; i += partSize) {
    parts.push(incoherently_long_string.slice(i, i + partSize));
  }

  return parts;
}