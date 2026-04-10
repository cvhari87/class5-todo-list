import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { initializeApp, getApps, cert } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

// ── Firebase Admin (server-side only) ────────────────────────────────────────
// Initialise once per cold start
function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]
  return initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      // Replace escaped newlines that env vars sometimes introduce
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  })
}

// ── POST /api/categorize ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Verify Firebase ID token from Authorization header
  const authHeader = req.headers.get("authorization") ?? ""
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null

  if (!idToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const adminApp = getAdminApp()
    await getAuth(adminApp).verifyIdToken(idToken)
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  // 2. Parse request body
  const { text, existingCategories } = (await req.json()) as {
    text: string
    existingCategories: string[] // names of existing categories
  }

  if (!text?.trim()) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 })
  }

  // 3. Call Gemini
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 })
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

  const existingList =
    existingCategories.length > 0
      ? `Existing categories: ${existingCategories.map(n => `"${n}"`).join(", ")}.`
      : "There are no existing categories yet."

  const prompt = `You are a smart note organizer. Analyze the following pasted text and:
1. Suggest the best category name (use an existing one if it fits, otherwise suggest a new short name).
2. Classify each non-empty line as one of: "todo", "header", or "text".
   - "header": a short title/section label (≤ 6 words, no trailing punctuation, title-case or ALL CAPS)
   - "todo": an actionable task or checklist item
   - "text": a note, description, or sentence that is not a task
3. Detect if a line starts with ✓ ✔ ☑ ✅ — mark it completed:true.
4. Strip bullet characters (-, •, *, [ ], [x]) from the start of lines.

${existingList}

Return ONLY valid JSON in this exact shape, no markdown, no explanation:
{
  "suggestedCategory": "string",
  "items": [
    { "text": "cleaned line text", "type": "todo"|"header"|"text", "completed": true|false }
  ]
}

Text to analyze:
${text}`

  try {
    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()

    // Strip markdown code fences if Gemini wraps in ```json ... ```
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
    const parsed = JSON.parse(jsonStr)

    return NextResponse.json(parsed)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("Gemini error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
