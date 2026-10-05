import fs from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { readCatalogShareByCode, readCatalogShareToken } from "@/lib/catalog-share";

export const runtime = "nodejs";

const SHARE_BRAND_NAME = "PARKSONMX";
const SHARE_BRAND_SUBTITLE = "百盛供应链";

async function loadShare(token: string) {
  const payload = token.includes(".")
    ? readCatalogShareToken(token)
    : await readCatalogShareByCode(token);
  if (!payload) return null;
  return {
    payload,
    brandName: SHARE_BRAND_NAME,
  };
}

async function loadLogoDataUrl() {
  const file = path.join(process.cwd(), "public", "BSLOGO.png");
  const buffer = await fs.readFile(file);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const share = await loadShare(token);
  if (!share) {
    return new Response("Not found", { status: 404 });
  }

  const titleZh = share.payload.categoryZh || "产品清单";
  const titleEs = (share.payload.categoryEs || titleZh || "CATALOG").toUpperCase();
  const logoUrl = await loadLogoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 46%, #fdf2f8 100%)",
          color: "#0f172a",
          fontFamily: "sans-serif",
          padding: "48px",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            borderRadius: "36px",
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(226,232,240,0.95)",
            boxShadow: "0 24px 80px rgba(15,23,42,0.14)",
            padding: "44px 48px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "28px",
              }}
            >
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "18px",
                  background: "#ffffff",
                  border: "1px solid #dbe3f0",
                }}
              >
                <img
                  src={logoUrl}
                  alt={SHARE_BRAND_NAME}
                  width="44"
                  height="44"
                  style={{ objectFit: "contain" }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  maxWidth: "820px",
                }}
              >
                <div
                  style={{
                    fontSize: "32px",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    color: "#2f3c7e",
                    textTransform: "uppercase",
                  }}
                >
                  {SHARE_BRAND_NAME}
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 700,
                    color: "#334155",
                  }}
                >
                  {SHARE_BRAND_SUBTITLE}
                </div>
                <div
                  style={{
                    fontSize: "58px",
                    fontWeight: 900,
                    lineHeight: 1.06,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {titleZh}
                </div>
                <div
                  style={{
                    fontSize: "30px",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    color: "#475569",
                    textTransform: "uppercase",
                  }}
                >
                  {titleEs}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  fontSize: "26px",
                  color: "#64748b",
                }}
              >
                <div
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "999px",
                    background: "#2f3c7e",
                  }}
                />
                {`PARKSONMX-${titleZh}.${share.payload.format}`}
              </div>
              <div
                style={{
                  padding: "14px 22px",
                  borderRadius: "999px",
                  background: "#2f3c7e",
                  color: "#ffffff",
                  fontSize: "24px",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                }}
              >
                {share.payload.format.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
