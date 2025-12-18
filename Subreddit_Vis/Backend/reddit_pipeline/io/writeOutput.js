import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
export function write_to_json(data, out_dir, reddit) {
  const embeddings_serialized = {};
  for (const [key, emb] of Object.entries(data.embeddings)) {
    embeddings_serialized[key] = Array.from(emb.data);
  }
  data.embeddings = embeddings_serialized;
  mkdirSync(config.out_dir, { recursive: true });
  const fullPath = path.join(config.out_dir, config.out);
  writeFileSync(fullPath, JSON.stringify(data));
}
