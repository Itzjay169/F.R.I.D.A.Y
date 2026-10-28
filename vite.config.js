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
import {
  createWorkflow as createMasterWorkflow,
  runTradePlanningWorkflow,
  pauseWorkflow as pauseMasterWorkflow,
  resumeWorkflow as resumeMasterWorkflow,
  cancelWorkflow as cancelMasterWorkflow,
  submitUserDecision,
  getWorkflowSummary,
  listWorkflows as listMasterWorkflows
} from './master/workflow/workflowEngine.js';
import {
  saveAlert,
  getAlert,
  listAlerts,
  updateAlert,
  deleteAlert,
  pauseAlerts,
  resumeAlerts,
  listRoutines,
  updateRoutine,
  saveRoutine,
  getAlertEvents,
  recordAlertEvent
} from './services/alerts/alertPersistence.js';
import { RelayAgent, parseNaturalLanguageAlert } from './agents/relay/relayAgent.js';
import { executeRoutineWithOverlapProtection } from './services/alerts/routineScheduler.js';
import { evaluateAlert } from './services/alerts/evaluator.js';


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
              const symbol = (body.symbol || body.params?.symbol || 'AAPL').toUpperCase();
              const goal = body.goal || `Plan a swing trade in ${symbol}`;
              const wf = createMasterWorkflow({
                goal,
                symbol,
                intent: body.intent || 'plan_trade',
                template: body.templateId || 'plan_equity_swing_trade'
              });
              const quotes = await getLiveQuotes();
              const completedWf = await runTradePlanningWorkflow(wf.workflow_id, {
                marketContext: quotes
              });
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: 'ok', workflow: completedWf }));
            }
            if (req.method === 'GET') {
              const url = new URL(req.url, 'http://localhost');
              const status = url.searchParams.get('status') || undefined;
              const symbol = url.searchParams.get('symbol') || undefined;
              const list = listMasterWorkflows({ status, symbol });
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

        // 12. Workflow Actions (user_decision, approve, reject, modify, pause, resume, cancel)
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
              case 'user_decision':
              case 'approve':
              case 'reject':
              case 'modify': {
                const decision = action === 'user_decision' ? (body.decision || 'approve') : action;
                response = submitUserDecision(workflowId, decision, body.notes);
                break;
              }
              case 'advance':
                response = advanceStep(workflowId, result);
                break;
              case 'confirm':
                response = submitUserDecision(workflowId, 'approve');
                break;
              case 'pause':
                response = pauseMasterWorkflow(workflowId);
                break;
              case 'resume':
                response = resumeMasterWorkflow(workflowId);
                break;
              case 'cancel':
                response = cancelMasterWorkflow(workflowId, reason);
                break;
              case 'summary':
                response = getWorkflowSummary(workflowId) || getWorkflowHudSummary(workflowId);
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

        // 15. RELAY: Alerts Endpoints
        server.middlewares.use('/api/alerts/action', async (req, res) => {
          try {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              return res.end('Method not allowed');
            }
            const body = await parseJson(req);
            const { action, alert_id, updates, alert_ids, event_data } = body;

            if (action === 'pause') {
              const alerts = pauseAlerts(alert_ids || (alert_id ? [alert_id] : null));
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: 'ok', alerts }));
            }
            if (action === 'resume') {
              const alerts = resumeAlerts(alert_ids || (alert_id ? [alert_id] : null));
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: 'ok', alerts }));
            }
            if (action === 'delete') {
              deleteAlert(alert_id);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: 'ok', deleted: alert_id }));
            }
            if (action === 'update') {
              const updated = updateAlert(alert_id, updates);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: 'ok', alert: updated }));
            }
            if (action === 'evaluate') {
              const activeAlerts = listAlerts({ status: 'active' });
              const triggered = [];
              for (const a of activeAlerts) {
                const evalRes = evaluateAlert(a, event_data || {});
                if (evalRes.triggered) {
                  triggered.push(evalRes.event);
                  recordAlertEvent(evalRes.event);
                  saveAlert(a);
                }
              }
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: 'ok', triggeredCount: triggered.length, triggered }));
            }

            res.statusCode = 400;
            res.end(JSON.stringify({ error: `Unknown action ${action}` }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        server.middlewares.use('/api/alerts/events', (req, res) => {
          try {
            const url = new URL(req.url, 'http://localhost');
            const limit = parseInt(url.searchParams.get('limit') || '50', 10);
            const alertId = url.searchParams.get('alert_id') || undefined;
            const events = getAlertEvents({ alertId, limit });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', events }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        server.middlewares.use('/api/alerts', async (req, res) => {
          try {
            if (req.method === 'GET') {
              const url = new URL(req.url, 'http://localhost');
              const status = url.searchParams.get('status') || undefined;
              const symbol = url.searchParams.get('symbol') || undefined;
              const type = url.searchParams.get('type') || undefined;
              const alerts = listAlerts({ status, symbol, type });
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: 'ok', alerts }));
            }
            if (req.method === 'POST') {
              const body = await parseJson(req);
              const relay = new RelayAgent();
              let alertData = body;
              if (body.prompt) {
                const parsed = parseNaturalLanguageAlert(body.prompt);
                if (parsed.ambiguous) {
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ status: 'clarification_required', question: parsed.clarifying_question }));
                }
                alertData = { ...parsed, ...body };
              }
              const created = relay.createAlert(alertData);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: 'ok', alert: created }));
            }
            res.statusCode = 405;
            res.end('Method not allowed');
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // 16. RELAY: Routines Endpoints
        server.middlewares.use('/api/routines/action', async (req, res) => {
          try {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              return res.end('Method not allowed');
            }
            const body = await parseJson(req);
            const { action, routine_id, updates } = body;

            if (action === 'run') {
              const runRes = await executeRoutineWithOverlapProtection(routine_id);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: 'ok', result: runRes }));
            }
            if (action === 'toggle' || action === 'update') {
              const updated = updateRoutine(routine_id, updates);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: 'ok', routine: updated }));
            }

            res.statusCode = 400;
            res.end(JSON.stringify({ error: `Unknown routine action ${action}` }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        server.middlewares.use('/api/routines', (req, res) => {
          try {
            if (req.method === 'GET') {
              const routines = listRoutines();
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: 'ok', routines }));
            }
            res.statusCode = 405;
            res.end('Method not allowed');
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
