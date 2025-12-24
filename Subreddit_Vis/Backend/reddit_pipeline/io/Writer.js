import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from 'path'

export default class Writer(){

}

function write_to_json(data, out_dir, outName) {
  const embeddings_serialized = {};
  for (const [key, emb] of Object.entries(data.embeddings)) {
    embeddings_serialized[key] = Array.from(emb.data);
  }
  data.embeddings = embeddings_serialized;
  mkdirSync(out_dir, { recursive: true });
  const fullPath = path.join(out_dir, outName);
  writeFileSync(fullPath, JSON.stringify(data));
}
