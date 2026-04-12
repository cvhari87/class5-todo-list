import { Category } from "./types"

// Normalize for comparison: lowercase, strip punctuation, collapse whitespace
function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s]/g, "").replace(/\s+/g, " ")
}

// Levenshtein distance
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// Similarity score 0–1 (1 = identical)
function similarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(na, nb) / maxLen
}

export type DuplicateMatch = {
  matchedText: string
  categoryName: string
  source: "fuzzy" | "semantic"
}

const FUZZY_THRESHOLD = 0.82

/**
 * Fuzzy + cross-category duplicate detection.
 * Returns a map of import text → best matching existing item.
 */
export function findFuzzyDuplicates(
  importTexts: string[],
  allCategories: Category[]
): Map<string, DuplicateMatch> {
  const result = new Map<string, DuplicateMatch>()

  for (const text of importTexts) {
    let best: { score: number; match: DuplicateMatch } | null = null

    for (const cat of allCategories) {
      for (const item of cat.items) {
        if (item.type !== "todo") continue
        const score = similarity(text, item.text)
        if (score >= FUZZY_THRESHOLD) {
          if (!best || score > best.score) {
            best = {
              score,
              match: {
                matchedText: item.text,
                categoryName: cat.name,
                source: "fuzzy",
              },
            }
          }
        }
      }
    }

    if (best) result.set(text, best.match)
  }

  return result
}
