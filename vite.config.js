import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { getLiveQuotes, getNyseSession } from './services/marketData.js';
import { getLiveNews } from './services/newsService.js';
import { executeDeskCommand } from './services/geminiService.js';
import { getAccountSnapshot, evaluateRisk, executePaperOrder, closePosition, cancelOrder } from './services/paperEngine.js';
import {
  createWorkflow,
  advanceStep,
  confirmStep,
  pauseWorkflow,
  resumeWorkflow,
  cancelWorkflow,
  getWorkflow,
  listWorkflows,
  getWorkflowHudSummary,
  getWorkflowTemplates
} from './services/workflow/workflowEngine.js';
import {
  buildTradePlan,
  getTradePlan,
  listTradePlans,
  compassHealthCheck
} from './agents/compass/compassAgent.js';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'friday-api-server',
      configureServer(server) {
        // Parse JSON request body helper
        const parseJson = (req) => new Promise((resolve) => {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); }
          });
        });

        // 1. Live Quotes Endpoint
        server.middlewares.use('/api/quotes', async (req, res) => {
          try {
            const quotes = await getLiveQuotes();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(quotes));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // 2. Real NYSE Session State Endpoint
        server.middlewares.use('/api/session', (req, res) => {
          try {
            const session = getNyseSession();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(session));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // 3. Live News Endpoint
        server.middlewares.use('/api/news', async (req, res) => {
          try {
            const url = new URL(req.url, 'http://localhost');
            const ticker = url.searchParams.get('ticker');
            const news = await getLiveNews(ticker);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(news));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // 4. Command Dispatch via Gemini Flash
        server.middlewares.use('/api/command', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end('Method not allowed');
          }
          try {
            const body = await parseJson(req);
            const quotes = await getLiveQuotes();
            const news = await getLiveNews();
            const result = await executeDeskCommand({
              command: body.command,
              marketContext: quotes,
              newsContext: news
            });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // 5. Paper Portfolio Endpoint
        server.middlewares.use('/api/portfolio', async (req, res) => {
          try {
            const quotes = await getLiveQuotes();
            const priceMap = {};
            if (Array.isArray(quotes)) {
              quotes.forEach(q => { if (q.price) priceMap[q.symbol] = q.price; });
            }
            const snapshot = getAccountSnapshot(priceMap);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(snapshot));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // 6. Sentinel Risk Evaluation Endpoint
        server.middlewares.use('/api/order/evaluate', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end('Method not allowed');
          }
          try {
            const body = await parseJson(req);
            const verdict = evaluateRisk(body);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(verdict));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // 7. Pilot Paper Execution Endpoint
        server.middlewares.use('/api/order/execute', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end('Method not allowed');
          }
          try {
            const body = await parseJson(req);
            const fill = executePaperOrder(body);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(fill));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // 8. Close Position Endpoint
        server.middlewares.use('/api/order/close', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end('Method not allowed');
          }
          try {
            const body = await parseJson(req);
            const result = closePosition(body);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // 9. Cancel Order Endpoint
        server.middlewares.use('/api/order/cancel', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end('Method not allowed');
          }
          try {
            const body = await parseJson(req);
            const result = cancelOrder(body);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // 10. Workflows: List & Get Templates
        server.middlewares.use('/api/workflows/templates', (req, res) => {
          try {
            const templates = getWorkflowTemplates();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', templates }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // 11. Workflows: Create / List / Details
        server.middlewares.use('/api/workflows', async (req, res) => {
          try {
            if (req.method === 'POST') {
              const body = await parseJson(req);
              const wf = createWorkflow(body.templateId || body, body.params || {});
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: 'ok', workflow: wf }));
            }
            if (req.method === 'GET') {
              const url = new URL(req.url, 'http://localhost');
              const status = url.searchParams.get('status') || undefined;
              const list = listWorkflows({ status });
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: 'ok', workflows: list }));
            }
            res.statusCode = 405;
            res.end('Method not allowed');
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // 12. Workflow Actions (advance, confirm, pause, resume, cancel)
        server.middlewares.use('/api/workflow/action', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end('Method not allowed');
          }
          try {
            const body = await parseJson(req);
            const { action, workflowId, stepIndex, result, confirmationData, reason } = body;
            let response;
            switch (action) {
              case 'advance':
                response = advanceStep(workflowId, result);
                break;
              case 'confirm':
                response = confirmStep(workflowId, stepIndex, confirmationData);
                break;
              case 'pause':
                response = pauseWorkflow(workflowId);
                break;
              case 'resume':
                response = resumeWorkflow(workflowId);
                break;
              case 'cancel':
                response = cancelWorkflow(workflowId, reason);
                break;
              case 'summary':
                response = getWorkflowHudSummary(workflowId);
                break;
              case 'get':
                response = getWorkflow(workflowId);
                break;
              default:
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: `Unknown action: ${action}` }));
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(response));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // 13. COMPASS: Draft Trade Plan
        server.middlewares.use('/api/compass/plan', async (req, res) => {
          try {
            if (req.method === 'POST') {
              const body = await parseJson(req);
              const quotes = await getLiveQuotes();
              const quote = quotes?.find(q => q.symbol === (body.symbol || '').toUpperCase());
              const planResult = buildTradePlan(body, quote);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(planResult));
            }
            if (req.method === 'GET') {
              const url = new URL(req.url, 'http://localhost');
              const id = url.searchParams.get('id');
              const plan = id ? getTradePlan(id) : null;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: plan ? 'ok' : 'not_found', plan }));
            }
            res.statusCode = 405;
            res.end('Method not allowed');
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // 14. COMPASS: List Plans & Health
        server.middlewares.use('/api/compass/plans', (req, res) => {
          try {
            const url = new URL(req.url, 'http://localhost');
            const symbol = url.searchParams.get('symbol') || undefined;
            const status = url.searchParams.get('status') || undefined;
            const plans = listTradePlans({ symbol, status });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', plans }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        server.middlewares.use('/api/compass/health', (req, res) => {
          try {
            const health = compassHealthCheck();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(health));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      }
    }
  ],
  base: './',
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
