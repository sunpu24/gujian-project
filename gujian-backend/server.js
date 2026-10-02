require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { pipeline } = require('stream');

const app = express();
const PORT = process.env.PORT || 8080;

// 中间件
app.use(cors());
app.use(express.json());

// DeepSeek API 配置
const client = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com"
    })
  : null;

// System Prompt - 古建灵犀的人设
const SYSTEM_PROMPT = `你是「古建灵犀」，一位资深的中国传统古建筑学专家，也是"国风筑韵（古建筑可视化）"网站的专属智能向导。你精通中国历代建筑风格（京派、徽派、苏派等）、木构架体系（如榫卯、斗拱、藻井）、营造法式以及建筑背后的历史文化。

语言风格：
- 儒雅、温和、专业、充满对古典文化的敬意。
- 对用户尊称为"先生"或"姑娘"（如果不确定性别统一称"阁下"），自称为"灵犀"。
- 用通俗易懂的现代白话文进行科普，可适当点缀成语或简短古文，但避免过度堆砌生僻学术词汇，做到雅俗共赏。

核心任务：
1. 知识科普：准确解答用户关于古建筑结构、历史背景、美学特征的疑问。
2. 精准总结：因聊天视窗空间有限，每次回复请保持精炼，字数严格控制在 200-300 字以内。

行为守则（严格遵守）：
1. 排版规范：使用 HTML 标签优化阅读体验。关键术语（如<strong>歇山顶</strong>、<strong>大木作</strong>）必须加粗；分类解释时使用无序列表（-）。
2. 边界把控：你的使命仅限古建筑、传统文化及本网站导览。若用户询问政治、现代科技、代码编写等无关话题，请以古风委婉拒绝。
   （拒绝示例："恕灵犀才疏学浅，灵犀终日沉醉于飞檐斗拱之中，对阁下所言之物未曾涉猎。关于这木构营造的门道，阁下可还有其他兴致？"）
3. 恪守真实：知之为知之，不知为不知。遇生僻或无确切史料的古建问题，需坦诚告知资料不足，绝不编造建筑名称或伪造历史。
4. 启发追问：若遇宏大问题（如"介绍一下故宫"），请先给出精简概括，并在末尾抛出具体细节供用户选择深入（如："阁下是更想了解其宏大的中轴线布局，还是精妙的太和殿藻井？"）。`;

// POST /api/chat 接口
app.post('/api/chat', async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({
        reply: "古建灵犀尚未配置完成，请稍后再试。"
      });
    }

    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        reply: "先生/姑娘，提问不可为空也。" 
      });
    }
    
    // 在前端传来的消息数组最前面插入人设
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages
    ];
    
    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: fullMessages,
      max_tokens: 1000,
      temperature: 0.7
    });
    
    const reply = completion.choices[0].message.content;
    res.json({ reply });
    
  } catch (error) {
    console.error('API 调用错误:', error);
    res.status(500).json({ 
      reply: "吾已尽力，然此番求索之路途遇阻，还望先生/姑娘稍后再试。" 
    });
  }
});

// Zeabur 使用同一个服务提供前端页面和 API。
// API 路由需要放在静态文件中间件之前，避免被前端资源处理覆盖。
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const frontendRoot = path.resolve(__dirname, '..');

// 后端源码不作为静态资源对外提供。
app.use('/gujian-backend', (req, res) => {
  res.sendStatus(404);
});

// Zeabur 当前不会自动压缩这些静态文件。对文本、JSON 和大型 GLB 模型
// 进行流式 gzip，可在不改变文件内容的情况下显著减少首次下载量。
// 带 Range 的请求（尤其视频）仍交给 express.static，保留断点和分段加载。
const gzipExtensions = new Set(['.html', '.css', '.js', '.json', '.glb']);
const compressedContentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary'
};
app.get(/\.(?:html|css|js|json|glb)$/i, (req, res, next) => {
  if (req.headers.range || !/\bgzip\b/i.test(req.headers['accept-encoding'] || '')) {
    return next();
  }

  let pathname;
  try {
    pathname = decodeURIComponent(req.path);
  } catch {
    return next();
  }

  const filePath = path.resolve(frontendRoot, `.${pathname}`);
  const rootPrefix = frontendRoot.endsWith(path.sep) ? frontendRoot : `${frontendRoot}${path.sep}`;
  const extension = path.extname(filePath).toLowerCase();
  if (!filePath.startsWith(rootPrefix) || !gzipExtensions.has(extension)) {
    return next();
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) return next();

    try {
      const isHtml = extension === '.html';
      const etag = `W/\"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}\"`;

      // Do not pass an absolute file path to res.type(). On Linux it contains
      // slashes, so Express mistakes the path itself for a MIME value; Chinese
      // filenames then cause ERR_INVALID_CHAR and terminate the Node process.
      res.setHeader('Content-Type', compressedContentTypes[extension]);
      res.setHeader('Cache-Control', isHtml ? 'no-cache' : 'public, max-age=604800');
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', stats.mtime.toUTCString());

      if (req.fresh) return res.status(304).end();
      if (req.method === 'HEAD') return res.end();

      pipeline(
        fs.createReadStream(filePath),
        zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED }),
        res,
        (error) => {
          if (error && !res.headersSent) next(error);
        }
      );
    } catch (error) {
      next(error);
    }
  });
});

app.use(express.static(frontendRoot, {
  dotfiles: 'ignore',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  }
}));

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`古建灵犀已启动，恭候大驾光临！`);
  console.log(`服务器运行在端口: ${PORT}`);
});
