import { NextResponse } from "next/server";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

// Compute the absolute path to your certificate file.
// This assumes your certificate file is in [project_root]/certs/do-ca.crt
const certFilePath = path.join(process.cwd(), "certs", "do-ca.crt");
const caCert = fs.readFileSync(certFilePath, "utf8");

// Create a connection pool using the certificate from the file system.
// Your DATABASE_URL should now simply include sslmode=require.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: caCert,
  },
});

// Utility: Get the daily target word and precomputed ranking.
// Daily files are stored in src/app/api/daily_word/daily
const dailyDir = path.join(process.cwd(), "src", "app", "api", "daily_word", "daily");
const countFilePath = path.join(dailyDir, "dailyCount.json");

// Helper to synchronously read the daily count.
function getDailyCountSync(): { date: string; count: number } {
  try {
    const content = fs.readFileSync(countFilePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error reading dailyCount.json:", error);
    return { date: "", count: 0 };
  }
}

// Helper to read the target word and ranking based on the current daily count.
function getTargetWordAndRanking(): { targetWord: string; ranking: Array<{ word: string; similarity: number }> } {
  const dailyCount = getDailyCountSync().count;
  const targetFile = path.join(dailyDir, `${dailyCount}.txt`);
  const rankingFile = path.join(dailyDir, `top1000_${dailyCount}.json`);
  let targetWord = "";
  let ranking: Array<{ word: string; similarity: number }> = [];
  try {
    targetWord = fs.readFileSync(targetFile, "utf8").trim().toLowerCase();
  } catch (error) {
    console.error("Error reading target word file:", error);
  }
  try {
    const rawData = fs.readFileSync(rankingFile, "utf8");
    ranking = JSON.parse(rawData);
  } catch (error) {
    console.error("Error reading ranking file:", error);
  }
  return { targetWord, ranking };
}

// Utility: Fetch an embedding from the database.
async function getEmbeddingForWord(word: string): Promise<number[] | null> {
  console.log(`Fetching embedding for word: ${word}`);
  const res = await pool.query("SELECT vector FROM embeddings WHERE word = $1", [word.toLowerCase()]);
  if (res.rows.length === 0) {
    console.log(`No embedding found for word: ${word}`);
    return null;
  }
  console.log(`Found embedding for word: ${word}`);
  return res.rows[0].vector;
}

// Utility: Compute cosine similarity between two vectors.
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
  const normB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
  console.log(`Computed cosine similarity: dot=${dotProduct}, normA=${normA}, normB=${normB}`);
  return dotProduct / (normA * normB);
}

// API Route Handler using Next.js 13 App Router conventions.
export async function POST(request: Request) {
  try {
    // Get the daily target word and its precomputed ranking.
    const { targetWord, ranking: precomputedRanking } = getTargetWordAndRanking();
    if (!targetWord) {
      console.error("No daily target word found.");
      return NextResponse.json({ error: "Daily target word not found" }, { status: 500 });
    }
    console.log(`Daily target word: ${targetWord}`);

    // Parse the request body.
    const body = await request.json();
    console.log("Received request body:", body);
    const { guess } = body;
    if (!guess) {
      console.log("Missing guess in request body.");
      return NextResponse.json({ error: 'Missing "guess" in request body' }, { status: 400 });
    }
    const guessLower = guess.trim().toLowerCase();
    console.log(`Normalized guess: '${guessLower}'`);

    // If the guess exactly matches the daily target, return a perfect score.
    if (guessLower === targetWord) {
      console.log(`Exact match: guess (${guessLower}) equals target (${targetWord}).`);
      return NextResponse.json({ guess, rank: 0, closeness: 1.0 });
    }

    // Check if the guess is found in the precomputed ranking.
    const foundIndex = precomputedRanking.findIndex(item => item.word.toLowerCase() === guessLower);
    if (foundIndex !== -1) {
      console.log(`Found '${guessLower}' in precomputed ranking at position ${foundIndex + 1}.`);
      return NextResponse.json({ guess, rank: foundIndex + 1, closeness: null });
    }
    console.log(`'${guessLower}' not found in precomputed ranking. Falling back to computing similarity via embeddings.`);

    // Retrieve the target word's embedding from the database.
    const targetEmbedding = await getEmbeddingForWord(targetWord);
    if (!targetEmbedding) {
      console.error(`Target embedding for '${targetWord}' not found in database.`);
      throw new Error(`Target embedding for "${targetWord}" not found in database.`);
    }

    // Retrieve the guessed word's embedding.
    const guessEmbedding = await getEmbeddingForWord(guessLower);
    if (!guessEmbedding) {
      console.log(`Embedding for '${guessLower}' not found in database.`);
      return NextResponse.json({ error: `Embedding for "${guess}" not found` }, { status: 404 });
    }

    // Compute cosine similarity.
    const closeness = cosineSimilarity(targetEmbedding, guessEmbedding);
    console.log(`Returning computed closeness for '${guessLower}': ${closeness}`);
    return NextResponse.json({ guess, rank: null, closeness });
  } catch (error) {
    console.error("Error in daily_word API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
