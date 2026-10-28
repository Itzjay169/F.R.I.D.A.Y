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
import { ArchiveAgent, archiveHealthCheck, parseArchiveIntent } from './agents/archive/archiveAgent.js';
import {
  saveResearchItem,
  getResearchItem,
  listResearchItems,
  deleteResearchItem,
  getPlaybook,
  listPlaybooks as listArchivePlaybooks,
  getTradeReview as getArchiveReview,
  listTradeReviews as listArchiveReviews
} from './services/archive/archivePersistence.js';
import { hybridSearch } from './services/archive/retrieval.js';
import { getReviewStats } from './services/archive/reviewEngine.js';
import { SentinelXAgent } from './agents/sentinel-x/sentinelXAgent.js';
import { calculateAccountSnapshot, calculatePortfolioHeat } from './services/sentinel-x/portfolioRiskModel.js';
import { calculateCorrelationMatrix, detectCorrelatedClusters } from './services/sentinel-x/correlationEngine.js';
import { runStressTest } from './services/sentinel-x/stressTesting.js';
import { calculateRiskBudget } from './services/sentinel-x/riskBudget.js';
import { killSwitchManager } from './services/sentinel-x/killSwitch.js';
import { generateRiskReductionPlan } from './services/sentinel-x/riskReductionPlanner.js';
import { DEFAULT_RISK_CONFIG } from './shared/config.js';
import { sendContactMessage } from './services/contactService.js';

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

        // ═══════════════════════════════════════════════════════════
        // 17. ARCHIVE: Research Library, Playbooks, Trade Reviews
        // ═══════════════════════════════════════════════════════════

        // ARCHIVE Health
        server.middlewares.use('/api/archive/health', (req, res) => {
          try {
            const health = archiveHealthCheck();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(health));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // ARCHIVE Reviews Stats
        server.middlewares.use('/api/archive/reviews/stats', (req, res) => {
          try {
            const url = new URL(req.url, 'http://localhost');
            const symbol = url.searchParams.get('symbol') || undefined;
            const stats = getReviewStats({ symbol });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(stats));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // ARCHIVE Reviews
        server.middlewares.use('/api/archive/reviews', (req, res) => {
          try {
            const url = new URL(req.url, 'http://localhost');
            const symbol = url.searchParams.get('symbol') || undefined;
            const outcome = url.searchParams.get('outcome') || undefined;
            const limit = parseInt(url.searchParams.get('limit') || '50', 10);
            const reviews = listArchiveReviews({ symbol, outcome, limit });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', reviews }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // ARCHIVE Playbooks
        server.middlewares.use('/api/archive/playbooks', (req, res) => {
          try {
            const url = new URL(req.url, 'http://localhost');
            const id = url.searchParams.get('id');
            if (id) {
              const pb = getPlaybook(id);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: pb ? 'ok' : 'not_found', playbook: pb }));
            }
            const playbooks = listArchivePlaybooks();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', playbooks }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // ARCHIVE Search (hybrid FTS5 + semantic)
        server.middlewares.use('/api/archive/search', (req, res) => {
          try {
            const url = new URL(req.url, 'http://localhost');
            const q = url.searchParams.get('q') || '';
            const symbol = url.searchParams.get('symbol') || undefined;
            const kind = url.searchParams.get('kind') || undefined;
            const limit = parseInt(url.searchParams.get('limit') || '30', 10);

            if (!q) {
              const items = listResearchItems({ symbol, kind, limit });
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: 'ok', items, total: items.length, method: 'list' }));
            }

            const results = hybridSearch(q, { limit, symbol, kind });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', ...results }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // ARCHIVE Actions (delete, save, command)
        server.middlewares.use('/api/archive/action', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end('Method not allowed');
          }
          try {
            const body = await parseJson(req);
            const { action, item_id, command, context } = body;

            if (action === 'delete' && item_id) {
              deleteResearchItem(item_id);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ status: 'ok', deleted: item_id }));
            }

            if (action === 'command' && command) {
              const archive = new ArchiveAgent();
              const result = await archive.handleCommand(command, context || {});
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(result));
            }

            res.statusCode = 400;
            res.end(JSON.stringify({ error: `Unknown archive action: ${action}` }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // ARCHIVE Command (natural language dispatch)
        server.middlewares.use('/api/archive/command', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end('Method not allowed');
          }
          try {
            const body = await parseJson(req);
            const archive = new ArchiveAgent();
            const result = await archive.handleCommand(body.command || '', body.context || {});
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // ═══════════════════════════════════════════════════════════
        // SENTINEL-X PORTFOLIO RISK API (Phase 7.5)
        // ═══════════════════════════════════════════════════════════

        // Portfolio Snapshot & Risk Summary
        server.middlewares.use('/api/risk/portfolio', async (req, res) => {
          try {
            const paperSnap = getAccountSnapshot();
            const snap = calculateAccountSnapshot(paperSnap);
            const heat = calculatePortfolioHeat(snap.open_positions, snap.current_equity, snap.starting_equity);
            killSwitchManager.evaluateAutoTriggers(snap, heat);
            const killSwitch = killSwitchManager.getState();
            const budget = calculateRiskBudget({ ...snap, total_heat_dollars: heat.total_heat_dollars }, killSwitch.active);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              status: 'ok',
              snapshot: snap,
              heat,
              budget,
              kill_switch: killSwitch
            }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // Portfolio Heat
        server.middlewares.use('/api/risk/heat', async (req, res) => {
          try {
            const paperSnap = getAccountSnapshot();
            const snap = calculateAccountSnapshot(paperSnap);
            const heat = calculatePortfolioHeat(snap.open_positions, snap.current_equity, snap.starting_equity);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', heat, equity: snap.current_equity }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // Correlation Matrix & Clusters
        server.middlewares.use('/api/risk/correlation', async (req, res) => {
          try {
            const paperSnap = getAccountSnapshot();
            const syms = (paperSnap.positions || []).map(p => p.symbol);
            const matrix = calculateCorrelationMatrix(syms);
            const clusters = detectCorrelatedClusters(paperSnap.positions || [], matrix);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', matrix, clusters }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // Stress Testing
        server.middlewares.use('/api/risk/stress-test', async (req, res) => {
          try {
            let scenario = 'market_down_2_percent';
            if (req.method === 'POST') {
              const body = await parseJson(req);
              if (body.scenario) scenario = body.scenario;
            }
            const paperSnap = getAccountSnapshot();
            const result = runStressTest(paperSnap.positions || [], paperSnap.equity, scenario);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', result }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // Risk Budget
        server.middlewares.use('/api/risk/budget', async (req, res) => {
          try {
            const paperSnap = getAccountSnapshot();
            const snap = calculateAccountSnapshot(paperSnap);
            const heat = calculatePortfolioHeat(snap.open_positions, snap.current_equity, snap.starting_equity);
            const killSwitch = killSwitchManager.getState();
            const budget = calculateRiskBudget({ ...snap, total_heat_dollars: heat.total_heat_dollars }, killSwitch.active);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', budget }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // Kill Switch (GET state, POST activate/deactivate)
        server.middlewares.use('/api/risk/kill-switch', async (req, res) => {
          try {
            if (req.method === 'POST') {
              const body = await parseJson(req);
              if (body.action === 'activate') {
                const result = killSwitchManager.activate({
                  activated_by: 'user',
                  reason: body.reason || 'User manual activation'
                });
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ status: 'ok', state: result.state }));
              }
              if (body.action === 'deactivate') {
                const result = killSwitchManager.deactivate({
                  user_reason: body.reason,
                  confirmed: body.confirmed
                });
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify(result));
              }
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', state: killSwitchManager.getState() }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // Risk Reduction Planner
        server.middlewares.use('/api/risk/reduce', async (req, res) => {
          try {
            const body = req.method === 'POST' ? await parseJson(req) : {};
            const paperSnap = getAccountSnapshot();
            const plan = generateRiskReductionPlan(paperSnap.positions || [], {
              equity: paperSnap.equity,
              targetReductionPercent: body.targetReductionPercent || 30,
              targetSector: body.targetSector,
              mode: body.mode || 'defensive'
            });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', plan }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // SENTINEL-X Command (natural language dispatch)
        server.middlewares.use('/api/risk/command', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end('Method not allowed');
          }
          try {
            const body = await parseJson(req);
            const agent = new SentinelXAgent();
            const paperSnap = getAccountSnapshot();
            const result = await agent.handleCommand(body.command || '', paperSnap);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // ═══════════════════════════════════════════════════════════
        // VEXORA CONTACT SERVICE API
        // ═══════════════════════════════════════════════════════════
        server.middlewares.use('/api/contact/send', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end('Method not allowed');
          }
          try {
            const body = await parseJson(req);
            const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local_user';
            const result = await sendContactMessage(body, clientIp);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = result.success ? 200 : (result.unconfigured ? 503 : 400);
            res.end(JSON.stringify(result));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Internal contact server error' }));
          }
        });
      }

    }
  ],
  base: './',
  define: {
    '__WEB_FORM_API_KEY__': JSON.stringify(process.env.WEB_FORM_API_KEY || '')
  },
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
