import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { Pool } from "pg";

// Create a Postgres connection pool.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Compute cosine similarity between two numeric arrays.
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((acc, a, i) => acc + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((acc, a) => acc + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((acc, b) => acc + b * b, 0));
  return dotProduct / (normA * normB);
}

// Get today's date string in YYYY-MM-DD format.
function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

// Define paths.
// Candidate words file (one word per line) is in src folder.
// Daily files will be stored in src/app/api/daily_word/daily.
const candidatePath = path.join(process.cwd(), "src", "candidate_words.txt");
const dailyDir = path.join(process.cwd(), "src", "app", "api", "daily_word", "daily");
const countFilePath = path.join(dailyDir, "dailyCount.json");

// Ensure the daily directory exists.
if (!existsSync(dailyDir)) {
  mkdirSync(dailyDir, { recursive: true });
}

// Helper: Load daily count info.
async function getDailyCount(): Promise<{ date: string; count: number }> {
  try {
    const content = await fs.readFile(countFilePath, "utf8");
    return JSON.parse(content);
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    const initial = { date: "", count: 0 };
    await fs.writeFile(countFilePath, JSON.stringify(initial), "utf8");
    return initial;
  }
}

// Helper: Save daily count info.
async function saveDailyCount(data: { date: string; count: number }): Promise<void> {
  await fs.writeFile(countFilePath, JSON.stringify(data), "utf8");
}

// Helper: Get embedding for a given word from the database.
async function getEmbeddingForWord(word: string): Promise<number[] | null> {
  const res = await pool.query("SELECT vector FROM embeddings WHERE word = $1", [word.toLowerCase()]);
  if (res.rows.length === 0) return null;
  return res.rows[0].vector;
}

// Helper: Get all embeddings for single words from the database.
async function getAllEmbeddings(): Promise<{ word: string; vector: number[] }[]> {
  const res = await pool.query("SELECT word, vector FROM embeddings WHERE word NOT LIKE '%\\_%'");
  return res.rows;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: Request) {
  try {
    const today = getToday();
    let dailyData = await getDailyCount();
    let dailyCount: number;

    // If the stored date isn't today, increment the count.
    if (dailyData.date !== today) {
      dailyCount = dailyData.count + 1;
      dailyData = { date: today, count: dailyCount };
      await saveDailyCount(dailyData);
    } else {
      dailyCount = dailyData.count;
    }

    // Construct today's file paths.
    const targetFilePath = path.join(dailyDir, `${dailyCount}.txt`);
    const rankingFilePath = path.join(dailyDir, `top1000_${dailyCount}.json`);

    // If today's files already exist, return their info.
    try {
      await fs.access(targetFilePath);
      await fs.access(rankingFilePath);
      return NextResponse.json({
        message: "Daily word already generated",
        day: dailyCount,
        targetFile: `${dailyCount}.txt`,
        rankingFile: `top1000_${dailyCount}.json`,
      });
    } catch (_err) { // eslint-disable-line @typescript-eslint/no-unused-vars
      // Files do not exist; continue.
    }

    // Load candidate words from candidate_words.txt.
    const candidateData = await fs.readFile(candidatePath, "utf8");
    const candidateWords = candidateData
      .split(/\r?\n/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w !== "");
    if (candidateWords.length === 0) {
      return NextResponse.json({ error: "No candidate words found" }, { status: 500 });
    }

    // Randomly pick a target word from candidateWords that exists in the DB embeddings.
    let targetWord = "";
    let attempts = 0;
    while (attempts < 1000) {
      const candidate = candidateWords[Math.floor(Math.random() * candidateWords.length)];
      const embedding = await getEmbeddingForWord(candidate);
      if (embedding) {
        targetWord = candidate;
        break;
      }
      attempts++;
    }
    if (!targetWord) {
      return NextResponse.json({ error: "Could not find a valid target word in database." }, { status: 500 });
    }

    console.log(`Daily target word for day ${dailyCount}: ${targetWord}`);

    // Get the target embedding.
    const targetEmbedding = await getEmbeddingForWord(targetWord);
    if (!targetEmbedding) {
      return NextResponse.json({ error: "Target embedding not found" }, { status: 500 });
    }

    // Get all embeddings (only single words) from the database.
    const allEmbeddings = await getAllEmbeddings();
    const ranking: { word: string; similarity: number }[] = [];

    for (const { word, vector } of allEmbeddings) {
      if (word.toLowerCase() === targetWord || word.includes("_")) continue;
      const sim = cosineSimilarity(targetEmbedding, vector);
      ranking.push({ word: word.toLowerCase(), similarity: sim });
    }

    // Sort descending by similarity and take the top 1000.
    ranking.sort((a, b) => b.similarity - a.similarity);
    const top1000 = ranking.slice(0, 1000);

    // Save the target word and the ranking results.
    await fs.writeFile(targetFilePath, targetWord, "utf8");
    await fs.writeFile(rankingFilePath, JSON.stringify(top1000), "utf8");

    return NextResponse.json({
      message: "Daily word generated successfully",
      day: dailyCount,
      targetWord,
      targetFile: `${dailyCount}.txt`,
      rankingFile: `top1000_${dailyCount}.json`,
    });
  } catch (error) {
    console.error("Error in daily_word API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
