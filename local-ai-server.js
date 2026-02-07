// local-ai-server.js （极简版，仅存/取prompt，无rid、无清理，纯中转）
const http = require('http');
const querystring = require('querystring');

let AI_PROMPT = ''; // 仅存最新prompt，极简中转

const server = http.createServer((req, res) => {
  // 跨域允许
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 预检请求直接通过
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 发起端POST：存prompt
  if (req.method === 'POST' && req.url === '/ai-prompt') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { prompt } = querystring.parse(body);
      if (prompt) AI_PROMPT = prompt; // 直接覆盖存最新的
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 0 }));
    });
    return;
  }

  // 接收端GET：取prompt
  if (req.method === 'GET' && req.url === '/ai-prompt') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 0, prompt: AI_PROMPT }));
    return;
  }

  res.writeHead(404);
  res.end();
});

// 启动端口3000，极简到底
server.listen(3000, '127.0.0.1', () => {
  console.log('✅ 极简本地AI接口启动：http://127.0.0.1:3000/ai-prompt');
});