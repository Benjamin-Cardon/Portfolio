import { pipeline, env as transformersEnv } from "@xenova/transformers";
import path from "path";
import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

transformersEnv.allowLocalModels = true;
transformersEnv.localModelPath = path.resolve("./models");
transformersEnv.allowRemoteModels = false;

export const sentiment = await pipeline(
  "sentiment-analysis",
  "cardiffnlp_roberta_onnx", { dtype: 'fp32', quantized: false }
);

export const embeddings = await pipeline(
  "feature-extraction",
  "all-MiniLM-L6-v2-onnx", { dtype: 'fp32', quantized: false }
);


const nlp = winkNLP(model, ['sbd', 'negation', 'sentiment', 'ner', 'pos']);
const its = nlp.its;
const as = nlp.as;

export { nlp, its, as };