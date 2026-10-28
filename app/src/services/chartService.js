import {
  routeChartCommand,
  parseNaturalChartCommand,
  getChartCapabilities
} from '../../../services/chart/chartRouter.js';

import {
  createTradeOverlay,
  updateTradeOverlay,
  removeTradeOverlay,
  getOverlaysForSymbol,
  getAllOverlays,
  addStructureDrawing,
  getStructureDrawingsForSymbol,
  clearAgentDrawings
} from '../../../services/chart/chartTradeOverlay.js';

/**
 * Dispatches a chart action through the authoritative Chart Command Router
 */
export async function executeChartAction(intent, payload = {}, agent = 'CHARTIST') {
  return await routeChartCommand({ intent, payload, agent });
}

/**
 * Parses natural voice/text commands into structured chart actions
 */
export function parseVoiceChartCommand(command, currentSymbol, liveQuote) {
  return parseNaturalChartCommand(command, currentSymbol, liveQuote);
}

/**
 * Called by PILOT whenever a paper order is placed/filled
 */
export function syncPaperTradeToOverlay({ tradeId, symbol, side, shares, price, stopLoss, takeProfit, token }) {
  return createTradeOverlay({
    tradeId,
    symbol,
    side,
    shares,
    price,
    stopLoss,
    takeProfit,
    token
  });
}

/**
 * Called by PILOT whenever an open position is flattened or closed
 */
export function syncTradeCloseToOverlay(tradeId, reason = 'CLOSED') {
  return removeTradeOverlay(tradeId, reason);
}

/**
 * Returns active trade overlays for a symbol
 */
export function getSymbolTradeOverlays(symbol) {
  return getOverlaysForSymbol(symbol);
}

/**
 * Returns active structure drawings (support/resistance, Fibonacci, zones) for a symbol
 */
export function getSymbolStructureDrawings(symbol) {
  return getStructureDrawingsForSymbol(symbol);
}

/**
 * Clears agent drawings while preserving user manual drawings
 */
export function clearAgentDrawingsForSymbol(symbol, targetAgent = null) {
  return clearAgentDrawings(symbol, targetAgent);
}

/**
 * Gets live machine-readable chart capability map
 */
export function getCapabilities() {
  return getChartCapabilities();
}
