const fs = require("node:fs");
const path = require("node:path");

const filePath = path.join(process.cwd(), "lib", "i18n.ts");
const source = fs.readFileSync(filePath, "utf8");

function extractBlock(lang) {
  const startToken = `${lang}: {`;
  const start = source.indexOf(startToken);
  if (start < 0) {
    throw new Error(`Missing ${lang} dictionary block`);
  }

  let depth = 0;
  let bodyStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (char === "{") {
      depth += 1;
      if (bodyStart === -1) bodyStart = i + 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(bodyStart, i);
      }
    }
  }

  throw new Error(`Unclosed ${lang} dictionary block`);
}

function extractKeys(block) {
  const matches = block.match(/"([^"]+)":/g) || [];
  return new Set(matches.map((item) => item.slice(1, -2)));
}

const zhKeys = extractKeys(extractBlock("zh"));
const esKeys = extractKeys(extractBlock("es"));

const missingInEs = [...zhKeys].filter((key) => !esKeys.has(key));
const missingInZh = [...esKeys].filter((key) => !zhKeys.has(key));

if (missingInEs.length || missingInZh.length) {
  if (missingInEs.length) {
    console.error("Missing in es:", missingInEs.join(", "));
  }
  if (missingInZh.length) {
    console.error("Missing in zh:", missingInZh.join(", "));
  }
  process.exit(1);
}

console.log(`i18n-check passed: ${zhKeys.size} shared keys`);
