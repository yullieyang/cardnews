import fs from 'fs';
import path from 'path';

const MCP_URL = 'https://api.anthropic.com/v2/ccr-sessions/cse_01Bgx6YU8uCpGyfpXbswsvAz/github/mcp';
const HEADERS = {
  'Content-Type': 'application/json',
  'X-Session-UUID': 'cse_01Bgx6YU8uCpGyfpXbswsvAz',
  'X-MCP-Server-ID': '7a758eb6-c90b-59a8-8b7c-ee6ed71a0676',
};

const SLUG = 'science-of-sleep-why-we-dream';
const OUTPUT_DIR = `/home/user/cardnews/output/${SLUG}`;
const REPO_PATH = `output/${SLUG}`;

const files = [
  'slide-01.png', 'slide-02.png', 'slide-03.png', 'slide-04.png',
  'slide-05.png', 'slide-06.png', 'slide-07.png', 'slide-08.png',
  'slide-09.png', 'slide-10.png', 'diary-shot.png'
];

async function callMCP(method, params) {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    method,
    params,
    id: Math.floor(Math.random() * 1e9),
  });
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: HEADERS,
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function pushFile(filePath, repoPath) {
  const content = fs.readFileSync(filePath);
  const b64 = content.toString('base64');
  const result = await callMCP('tools/call', {
    name: 'push_files',
    arguments: {
      owner: 'yullieyang',
      repo: 'cardnews',
      branch: 'main',
      message: `Card news: The Science of Sleep: Why We Dream — 2026-05-10 (${path.basename(filePath)})`,
      files: [{ path: repoPath, content: b64 }],
    },
  });
  return result;
}

for (const file of files) {
  const localPath = path.join(OUTPUT_DIR, file);
  const repoPath = `${REPO_PATH}/${file}`;
  process.stdout.write(`Pushing ${file}... `);
  try {
    const result = await pushFile(localPath, repoPath);
    if (result.error) {
      console.log(`ERROR: ${JSON.stringify(result.error)}`);
    } else {
      console.log('OK');
    }
  } catch (e) {
    console.log(`FAILED: ${e.message}`);
  }
}
console.log('Done.');