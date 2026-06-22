const express = require('express')
const cors = require('cors')
const { RunnableSequence, RunnableMap } = require('@langchain/core/runnables')
const { StringOutputParser } = require('@langchain/core/output_parsers')
const { ChatPromptTemplate } = require('@langchain/core/prompts')
const { ChatGroq } = require('@langchain/groq')
const { Pinecone } = require('@pinecone-database/pinecone')
const { pipeline } = require('@xenova/transformers')
const dotenv = require("dotenv");

dotenv.config();
const app = express()

app.use(express.json())
app.use(cors({ origin: "http://localhost:5173" }))

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
})

const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.1-8b-instant",
})


const index = pc.Index(process.env.PINECONE_INDEX);

// Cache the embedding pipeline so it's loaded once, not on every request
let embedderPromise = null;
function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedderPromise;
}

const embedQuery = async (text) => {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  // output.data is a Float32Array — Pinecone needs a plain array of numbers
  return Array.from(output.data);
};

const getRelevantDocuments = async (query) => {
  const queryVector = await embedQuery(query);

  const res = await index.query({
    vector: queryVector,
    topK: 5,
    includeMetadata: true,
  });

  console.log("Pinecone matches:", res.matches?.length ?? 0);

  if (!res.matches || res.matches.length === 0) {
    return [];
  }

  return res.matches
    .filter((m) => m.metadata && m.metadata.text) // guard against missing metadata
    .map((m) => ({
      pageContent: m.metadata.text,
    }));
};

const retriever = { getRelevantDocuments };

const prompt = ChatPromptTemplate.fromMessages([
  {
    role: "system",
    content: "You are a veterinary assistant. Answer the question based only on retrieved documents. List specific cat vaccines, the diseases they prevent, and recommended schedules. Do not include generic advice or vague statements."
  },
  {
    role: "user",
    content: "{context}\n\nQuestion: {question}"
  }
]);

const chain = RunnableSequence.from([
  RunnableMap.from({
    question: (input) => input.question,
    context: async (input) => {
      const docs = await retriever.getRelevantDocuments(input.question);

      if (docs.length === 0) {
        return "No relevant documents found.";
      }

      return docs.map((d) => d.pageContent).join("\n\n");
    },
  }),
  prompt,
  llm,
  new StringOutputParser(),
]);

app.post("/query", async (req, res) => {
  const { question } = req.body;

  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "`question` is required and must be a string" });
  }

  try {
    const answer = await chain.invoke({ question });
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});