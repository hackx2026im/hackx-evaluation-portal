import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Vercel serverless config: extend timeout for large PDF downloads
export const maxDuration = 30; // seconds (default is 10 on hobby tier)
export const dynamic = "force-dynamic";

// Simple in-memory rate limiter: userId -> { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60; // max requests per minute
const RATE_WINDOW = 60_000; // 1 minute in ms

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT;
}

/**
 * Extract a Google Drive file ID from various URL formats:
 *  - https://drive.google.com/file/d/FILE_ID/view
 *  - https://drive.google.com/open?id=FILE_ID
 *  - https://docs.google.com/document/d/FILE_ID/edit
 */
function extractGoogleDriveId(url: string): string | null {
  // Pattern: /d/FILE_ID/
  const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch) return dMatch[1];

  // Pattern: ?id=FILE_ID
  try {
    const parsed = new URL(url);
    const id = parsed.searchParams.get("id");
    if (id) return id;
  } catch {
    // Not a valid URL
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate caller
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Rate limit
    if (isRateLimited(user.id)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    // 3. Get and validate URL
    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get("url");

    if (!rawUrl) {
      return NextResponse.json(
        { error: "Missing 'url' query parameter" },
        { status: 400 }
      );
    }

    // 4. Build the download URL
    let downloadUrl: string;
    const driveId = extractGoogleDriveId(rawUrl);

    if (driveId) {
      // Google Drive — use direct download endpoint with confirm=t to bypass virus scan warning for large files
      downloadUrl = `https://drive.google.com/uc?export=download&id=${driveId}&confirm=t`;
    } else {
      // Not Google Drive — attempt to fetch directly
      downloadUrl = rawUrl;
    }

    // SSRF Protection: strictly allowlist hosts
    let targetUrl: URL;
    try {
      targetUrl = new URL(downloadUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    const ALLOWED_HOSTS = ["drive.google.com", "docs.google.com"];
    if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
      console.error(`[PDF proxy] SSRF attempt blocked for host: ${targetUrl.hostname}`);
      return NextResponse.json(
        { error: "Only Google Drive/Docs links are permitted for security reasons." },
        { status: 403 }
      );
    }

    // 5. Fetch the PDF server-side
    const pdfResponse = await fetch(downloadUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; hackX-proxy/1.0)",
      },
      redirect: "follow",
    });

    if (!pdfResponse.ok) {
      console.error(`[PDF proxy] Upstream error: ${pdfResponse.status} ${pdfResponse.statusText} for ${downloadUrl}`);
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}` },
        { status: 502 }
      );
    }

    const contentType = pdfResponse.headers.get("content-type") || "";

    // Google Drive returns HTML pages for login walls, virus scan confirmations, etc.
    // Valid PDF downloads come as application/pdf OR application/octet-stream.
    if (contentType.includes("text/html")) {
      console.error(`[PDF proxy] Got HTML instead of PDF for ${downloadUrl}`);
      return NextResponse.json(
        { error: "Google Drive returned an HTML page instead of a PDF. Please ensure the Google Drive link is set to 'Anyone with the link can view' and is a direct file link." },
        { status: 403 }
      );
    }

    // 6. Read the full response
    const pdfBuffer = await pdfResponse.arrayBuffer();

    // 7. Validate that the buffer actually starts with %PDF
    const header = new Uint8Array(pdfBuffer.slice(0, 5));
    const headerStr = String.fromCharCode(...header);
    if (!headerStr.startsWith("%PDF")) {
      console.error(`[PDF proxy] Response is not a PDF. First bytes: "${headerStr}" for ${downloadUrl}`);
      return NextResponse.json(
        { error: "The downloaded file is not a valid PDF." },
        { status: 422 }
      );
    }

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": "inline",
      },
    });
  } catch (err) {
    console.error("PDF proxy error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
