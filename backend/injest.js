const { pipeline } = require("@xenova/transformers");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

async function run() {
  const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
  const PINECONE_INDEX = process.env.PINECONE_INDEX;

  const descRes = await fetch(`https://api.pinecone.io/indexes/${PINECONE_INDEX}`, {
    headers: { "Api-Key": PINECONE_API_KEY },
  });
  const descJson = await descRes.json();
  // console.log("Index info:", JSON.stringify(descJson, null, 2));

const HOST = "https://food2-70ak3it.svc.aped-4627-b74a.pinecone.io";

  const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");//This loads a local AI model (all-MiniLM-L6-v2) that converts text into numbers (vectors). 
  // It runs entirely on your machine — no API call needed. The model outputs 384 numbers per chunk of text.

  const embed = async (text) => {
    const output = await extractor(text, { pooling: "mean", normalize: true });
    return [...output.data];
  };
//pooling: "mean" — averages all token vectors into one single vector representing the whole sentence
// normalize: true — scales the vector so its length = 1, which makes cosine similarity comparisons accurate
// [...output.data] — converts the raw Float32Array into a plain JS array that Pinecone accepts


  const text = fs.readFileSync("animal_food.txt", "utf-8");
  const chunks = text
    .split(/[.\n]/)
    .map((c) => c.trim())
    .filter((c) => c.length > 20);

  console.log("Chunks:", chunks.length);

  const vectors = [];
  for (let i = 0; i < chunks.length; i++) {
    vectors.push({
      id: `doc-${i}`,
      values: await embed(chunks[i]),
      metadata: { text: chunks[i] },
    });
  }

// console.log("Vectors built:", vectors.length);
// console.log("Sample:", JSON.stringify(vectors[0]).slice(0, 100));

const batchSize = 50;
for (let i = 0; i < vectors.length; i += batchSize) {
  const batch = vectors.slice(i, i + batchSize);
  console.log(`Sending batch of ${batch.length}...`);

  const res = await fetch(`${HOST}/vectors/upsert`, {
    method: "POST",
    headers: {
      "Api-Key": PINECONE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ vectors: batch }),
  });

  const json = await res.json();
  // console.log(`Batch ${i + 1}–${i + batch.length}:`, json);
}

  console.log(" Done");
}

run().catch(console.error);