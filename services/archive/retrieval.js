/**
 * ARCHIVE — Hybrid Retrieval Engine
 * Phase 6.5: FTS5 keyword search + local semantic (cosine) search
 * 
 * Combines keyword (BM25-ranked via FTS5) and vector (cosine similarity)
 * results with configurable weighting. Falls back to keyword-only when
 * no embeddings are available.
 * 
 * Privacy: all computation is local. No cloud calls.
 */

import { getArchiveDb, listAllEmbeddings, getResearchItem } from './archivePersistence.js';

// =============================================================================
// COSINE SIMILARITY (local, no external deps)
// =============================================================================

/**
 * Computes cosine similarity between two vectors
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} similarity in [-1, 1]
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// =============================================================================
// SIMPLE LOCAL EMBEDDING STUB
// =============================================================================

/**
 * Generates a simple bag-of-words embedding vector for local semantic search.
 * 
 * This is a placeholder / stub that creates a deterministic, low-dimensional
 * vector from the text's term frequencies. A real implementation would call
 * a local model (e.g., ONNX sentence-transformers) but this keeps the system
 * dependency-free and fully local.
 * 
 * @param {string} text
 * @param {number} [dims=128] vector dimensionality
 * @returns {number[]} unit-normalized vector
 */
export function generateLocalEmbedding(text, dims = 128) {
  const tokens = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 1);

  const vec = new Float64Array(dims);

  for (const token of tokens) {
    // Hash each token to a bucket
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
    }
    const bucket = Math.abs(hash) % dims;
    vec[bucket] += 1;
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dims; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dims; i++) vec[i] /= norm;
  }

  return Array.from(vec);
}

// =============================================================================
// FTS5 KEYWORD SEARCH
// =============================================================================

/**
 * Searches research_fts for keyword matches
 * @param {string} query
 * @param {number} [limit=50]
 * @param {DatabaseSync} [db]
 * @returns {{ item_id: string, rank: number }[]}
 */
export function ftsSearch(query, limit = 50, db = getArchiveDb()) {
  if (!query || !query.trim()) return [];

  // Sanitize FTS5 query: escape special characters, wrap tokens in quotes
  const tokens = query
    .replace(/['"]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 0)
    .map(t => `"${t}"`)
    .join(' OR ');

  if (!tokens) return [];

  try {
    const stmt = db.prepare(`
      SELECT item_id, rank
      FROM research_fts
      WHERE research_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    const rows = stmt.all(tokens, limit);
    return rows.map(r => ({
      item_id: r.item_id,
      rank: typeof r.rank === 'number' ? r.rank : -1
    }));
  } catch (err) {
    console.warn('[ARCHIVE:retrieval] FTS search error:', err.message);
    return [];
  }
}

// =============================================================================
// SEMANTIC SEARCH (local vector similarity)
// =============================================================================

/**
 * Finds items most similar to the query embedding
 * @param {number[]} queryVector
 * @param {number} [topK=20]
 * @param {DatabaseSync} [db]
 * @returns {{ item_id: string, similarity: number }[]}
 */
export function semanticSearch(queryVector, topK = 20, db = getArchiveDb()) {
  if (!queryVector || queryVector.length === 0) return [];

  const allEmbeddings = listAllEmbeddings(db);
  if (allEmbeddings.length === 0) return [];

  const scored = allEmbeddings.map(e => ({
    item_id: e.item_id,
    similarity: cosineSimilarity(queryVector, e.vector)
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}

// =============================================================================
// HYBRID RETRIEVAL
// =============================================================================

/**
 * Combines FTS5 keyword search and local semantic search into a single
 * ranked result set.
 * 
 * @param {string} query - Natural language query
 * @param {object} [options]
 * @param {number} [options.limit=20] - Max results
 * @param {number} [options.keywordWeight=0.5] - Weight for keyword results [0,1]
 * @param {number} [options.semanticWeight=0.5] - Weight for semantic results [0,1]
 * @param {string} [options.symbol] - Filter by symbol
 * @param {string} [options.kind] - Filter by kind
 * @param {string} [options.asset_class] - Filter by asset class
 * @param {DatabaseSync} [db]
 * @returns {{ items: object[], query: string, total: number, method: string }}
 */
export function hybridSearch(query, options = {}, db = getArchiveDb()) {
  const {
    limit = 20,
    keywordWeight = 0.5,
    semanticWeight = 0.5,
    symbol,
    kind,
    asset_class
  } = options;

  const scores = new Map(); // item_id -> { keyword: number, semantic: number }

  // 1. FTS5 keyword search
  const ftsResults = ftsSearch(query, limit * 3, db);
  const maxFtsRank = ftsResults.length > 0
    ? Math.max(...ftsResults.map(r => Math.abs(r.rank || 1)))
    : 1;

  for (const r of ftsResults) {
    const normalizedScore = 1 - (Math.abs(r.rank) / (maxFtsRank + 1));
    scores.set(r.item_id, {
      keyword: normalizedScore,
      semantic: 0,
      item_id: r.item_id
    });
  }

  // 2. Semantic search
  let method = 'keyword';
  try {
    const queryVector = generateLocalEmbedding(query);
    const semResults = semanticSearch(queryVector, limit * 3, db);

    if (semResults.length > 0) {
      method = 'hybrid';
      for (const r of semResults) {
        if (scores.has(r.item_id)) {
          scores.get(r.item_id).semantic = r.similarity;
        } else {
          scores.set(r.item_id, {
            keyword: 0,
            semantic: r.similarity,
            item_id: r.item_id
          });
        }
      }
    }
  } catch (err) {
    // Semantic search unavailable — keyword only
    method = 'keyword';
  }

  if (scores.size === 0 && ftsResults.length === 0) {
    method = 'keyword_fallback';
  }

  // 3. Fetch candidates and combine signals (Section 4 & Test 4: keyword, semantic, symbol, tag, recency)
  const queryLower = (query || '').toLowerCase();
  const queryTokens = queryLower.split(/\s+/).filter(Boolean);
  const nowMs = Date.now();
  const scoredItems = [];

  for (const s of scores.values()) {
    const item = getResearchItem(s.item_id, db);
    if (!item) continue;

    // Apply post-retrieval filters
    if (symbol && item.symbol !== symbol.toUpperCase() &&
        !(item.symbols || []).includes(symbol.toUpperCase())) continue;
    if (kind && item.kind !== kind) continue;
    if (asset_class && item.asset_class !== asset_class) continue;

    const reasons = [];
    let baseScore = (s.keyword * keywordWeight) + (s.semantic * semanticWeight);

    if (s.keyword > 0) reasons.push('keyword relevance');
    if (s.semantic > 0.2) reasons.push('semantic similarity');

    // Symbol signal boost
    let symbolBoost = 0;
    if (item.symbol && (queryTokens.includes(item.symbol.toLowerCase()) || (symbol && item.symbol === symbol.toUpperCase()))) {
      symbolBoost = 0.25;
      reasons.push(`symbol ${item.symbol}`);
    }

    // Tag signal boost
    let tagBoost = 0;
    const matchingTags = (item.tags || []).filter(t => queryTokens.includes(t.toLowerCase()));
    if (matchingTags.length > 0) {
      tagBoost = 0.15;
      reasons.push(`tag "${matchingTags[0]}"`);
    }

    // Recency signal boost (up to 0.1 for items created within 30 days)
    let recencyBoost = 0;
    if (item.created_at) {
      const ageDays = (nowMs - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24);
      recencyBoost = Math.max(0, 0.1 * (1 - (ageDays / 30)));
      if (recencyBoost > 0.05) reasons.push('recent entry');
    }

    // Setup signal boost
    if (item.setup && queryTokens.includes(item.setup.toLowerCase())) {
      baseScore += 0.1;
      reasons.push(`${item.setup} setup`);
    }

    const finalScore = baseScore + symbolBoost + tagBoost + recencyBoost;
    const matchReason = reasons.length > 0
      ? `This result matched because it shares ${reasons.join(', ')}.`
      : 'Keyword relevance match.';

    scoredItems.push({
      ...item,
      _score: Math.round(finalScore * 1000) / 1000,
      match_reason: matchReason
    });
  }

  scoredItems.sort((a, b) => b._score - a._score);
  const items = scoredItems.slice(0, limit);

  return {
    items,
    query,
    total: items.length,
    method
  };
}

// =============================================================================
// SEARCH BY TAG
// =============================================================================

/**
 * Finds all research items with a specific tag
 * @param {string} tag
 * @param {number} [limit=50]
 * @param {DatabaseSync} [db]
 * @returns {object[]}
 */
export function searchByTag(tag, limit = 50, db = getArchiveDb()) {
  try {
    const stmt = db.prepare(`
      SELECT ri.* FROM research_items ri
      INNER JOIN archive_tags at ON ri.item_id = at.item_id
      WHERE at.tag = ?
      ORDER BY ri.created_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(tag.toLowerCase(), limit);
    // Convert rows to objects using the same hydration pattern
    return rows.map(row => ({
      item_id: row.item_id,
      kind: row.kind,
      title: row.title,
      symbol: row.symbol,
      symbols: JSON.parse(row.symbols_json || '[]'),
      asset_class: row.asset_class,
      timeframe: row.timeframe,
      market_regime: row.market_regime,
      setup: row.setup,
      thesis: row.thesis,
      body: row.body,
      tags: JSON.parse(row.tags_json || '[]'),
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  } catch (err) {
    console.warn('[ARCHIVE:retrieval] Tag search error:', err.message);
    return [];
  }
}

// =============================================================================
// SEARCH BY DATE RANGE
// =============================================================================

/**
 * Finds research items within a date range
 * @param {string} from - ISO date
 * @param {string} to - ISO date
 * @param {object} [filters]
 * @param {DatabaseSync} [db]
 * @returns {object[]}
 */
export function searchByDateRange(from, to, filters = {}, db = getArchiveDb()) {
  let sql = 'SELECT * FROM research_items WHERE created_at >= ? AND created_at <= ?';
  const params = [from, to];

  if (filters.symbol) {
    sql += ' AND (symbol = ? OR symbols_json LIKE ?)';
    params.push(filters.symbol.toUpperCase(), `%"${filters.symbol.toUpperCase()}"%`);
  }
  if (filters.kind) {
    sql += ' AND kind = ?';
    params.push(filters.kind);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(filters.limit || 100);

  try {
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map(row => ({
      item_id: row.item_id,
      kind: row.kind,
      title: row.title,
      symbol: row.symbol,
      symbols: JSON.parse(row.symbols_json || '[]'),
      asset_class: row.asset_class,
      timeframe: row.timeframe,
      setup: row.setup,
      thesis: row.thesis,
      body: row.body,
      tags: JSON.parse(row.tags_json || '[]'),
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  } catch (err) {
    console.warn('[ARCHIVE:retrieval] Date range search error:', err.message);
    return [];
  }
}

// =============================================================================
// LINKED ITEM RETRIEVAL
// =============================================================================

/**
 * Retrieves all items linked to a specific item
 * @param {string} itemId
 * @param {DatabaseSync} [db]
 * @returns {{ links: object[], related: object[] }}
 */
export function getLinkedItems(itemId, db = getArchiveDb()) {
  try {
    const linkStmt = db.prepare(
      'SELECT * FROM research_links WHERE item_id = ? OR target_id = ?'
    );
    const links = linkStmt.all(itemId, itemId);

    const relatedIds = new Set();
    for (const link of links) {
      relatedIds.add(link.item_id === itemId ? link.target_id : link.item_id);
    }

    const related = [];
    for (const rid of relatedIds) {
      const item = getResearchItem(rid, db);
      if (item) related.push(item);
    }

    return { links, related };
  } catch (err) {
    console.warn('[ARCHIVE:retrieval] Linked items error:', err.message);
    return { links: [], related: [] };
  }
}

// =============================================================================
// SIMILAR TRADES RETRIEVAL (Section 11, Test 9)
// =============================================================================

/**
 * Finds similar trades or reviews to a target trade or symbol.
 * Excludes unrelated symbols unless crossSymbol is true.
 * 
 * @param {object} params
 * @param {string} params.symbol - Target symbol (e.g. 'NVDA')
 * @param {string} [params.setup] - Target setup (e.g. 'breakout')
 * @param {string} [params.market_regime] - Target regime
 * @param {string} [params.timeframe] - Target timeframe
 * @param {object} [options]
 * @param {boolean} [options.crossSymbol=false] - Whether to include other symbols
 * @param {number} [options.limit=10]
 * @param {DatabaseSync} [db]
 * @returns {object[]} Ranked similar trades/reviews
 */
export function findSimilarTrades(params = {}, options = {}, db = getArchiveDb()) {
  const { symbol, setup, market_regime } = params;
  const { crossSymbol = false, limit = 10 } = options;

  let sql = 'SELECT * FROM trade_reviews WHERE 1=1';
  const queryParams = [];

  // Exclude unrelated symbols unless crossSymbol is enabled
  if (!crossSymbol && symbol) {
    sql += ' AND symbol = ?';
    queryParams.push(symbol.toUpperCase());
  }

  const stmt = db.prepare(sql);
  const rows = stmt.all(...queryParams);

  const scored = rows.map(row => {
    let score = 0;
    const reasons = [];

    if (symbol && row.symbol === symbol.toUpperCase()) {
      score += 0.4;
      reasons.push(`matches symbol ${symbol}`);
    } else if (crossSymbol) {
      reasons.push(`cross-symbol match (${row.symbol})`);
    }

    if (setup && row.market_context && row.market_context.toLowerCase().includes(setup.toLowerCase())) {
      score += 0.3;
      reasons.push(`shares ${setup} setup`);
    }

    if (market_regime && row.market_context && row.market_context.toLowerCase().includes(market_regime.toLowerCase())) {
      score += 0.2;
      reasons.push(`shares ${market_regime} regime`);
    }

    // Process adherence bonus
    if (row.process_score >= 80) {
      score += 0.1;
      reasons.push('high process score');
    }

    return {
      review_id: row.review_id,
      trade_id: row.trade_id,
      symbol: row.symbol,
      outcome: row.outcome,
      result_r: row.result_r,
      process_score: row.process_score,
      discipline_score: row.discipline_score,
      market_context: row.market_context,
      thesis_at_entry: row.thesis_at_entry,
      followed_plan: Boolean(row.followed_plan),
      created_at: row.created_at,
      similarity_score: Math.round(score * 100) / 100,
      match_reason: `Matched because it ${reasons.join(', ')}`
    };
  });

  scored.sort((a, b) => b.similarity_score - a.similarity_score);
  return scored.slice(0, limit);
}

// =============================================================================
// EVENT SEARCH (Section 11, Test 10)
// =============================================================================

/**
 * Finds trades or reviews taken around a specific macroeconomic/earnings event
 * (e.g. CPI, FOMC, earnings)
 * 
 * @param {object} params
 * @param {string} [params.eventDate] - ISO date or 'YYYY-MM-DD'
 * @param {string} [params.eventName] - e.g. 'CPI', 'FOMC'
 * @param {number} [params.windowDays=2] - Days before/after the event
 * @param {DatabaseSync} [db]
 * @returns {object[]} Matching trades/reviews
 */
export function findTradesByEvent(params = {}, db = getArchiveDb()) {
  const { eventDate, eventName, windowDays = 2 } = params;

  // 1. If eventDate is provided, search within date window
  if (eventDate) {
    const targetTime = new Date(eventDate).getTime();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const fromTime = new Date(targetTime - windowMs).toISOString();
    const toTime = new Date(targetTime + windowMs).toISOString();

    const stmt = db.prepare(`
      SELECT * FROM trade_reviews
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(fromTime, toTime);
    if (rows.length > 0) {
      return rows.map(r => ({
        review_id: r.review_id,
        trade_id: r.trade_id,
        symbol: r.symbol,
        outcome: r.outcome,
        result_r: r.result_r,
        process_score: r.process_score,
        market_context: r.market_context,
        created_at: r.created_at,
        event_match: `Within ${windowDays} days of ${eventName || 'event'} (${eventDate})`
      }));
    }
  }

  // 2. Also search by eventName in market_context, user_notes, or thesis_at_entry
  if (eventName) {
    const query = eventName.toLowerCase();
    const stmt = db.prepare(`
      SELECT * FROM trade_reviews
      WHERE LOWER(market_context) LIKE ? OR LOWER(user_notes) LIKE ? OR LOWER(thesis_at_entry) LIKE ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(`%${query}%`, `%${query}%`, `%${query}%`);
    return rows.map(r => ({
      review_id: r.review_id,
      trade_id: r.trade_id,
      symbol: r.symbol,
      outcome: r.outcome,
      result_r: r.result_r,
      process_score: r.process_score,
      market_context: r.market_context,
      created_at: r.created_at,
      event_match: `Explicit mention of ${eventName}`
    }));
  }

  return [];
}

// =============================================================================
// MISTAKE SEARCH (Section 11, Test 11)
// =============================================================================

/**
 * Finds trades tagged with a recurring mistake
 * @param {object} params
 * @param {string} params.mistake - Mistake query (e.g. 'entered_without_stop', 'chased', 'fomo')
 * @param {string} [params.symbol]
 * @param {DatabaseSync} [db]
 * @returns {object[]} Matching reviews
 */
export function findMistakes(params = {}, db = getArchiveDb()) {
  const { mistake, symbol } = params;
  if (!mistake && !symbol) return [];

  const query = (mistake || '').toLowerCase();
  let sql = 'SELECT * FROM trade_reviews WHERE 1=1';
  const queryParams = [];

  if (symbol) {
    sql += ' AND symbol = ?';
    queryParams.push(symbol.toUpperCase());
  }

  const stmt = db.prepare(sql);
  const rows = stmt.all(...queryParams);

  const matched = [];
  for (const row of rows) {
    const mistakes = JSON.parse(row.mistakes_json || '[]');
    const emotionalTags = JSON.parse(row.emotional_tags_json || '[]');
    const userNotes = (row.user_notes || '').toLowerCase();

    const matchesMistakeList = mistakes.some(m => m.toLowerCase().includes(query));
    const matchesEmotionalTag = emotionalTags.some(t => t.toLowerCase().includes(query));
    const matchesNotes = userNotes.includes(query);

    if (matchesMistakeList || matchesEmotionalTag || matchesNotes) {
      matched.push({
        review_id: row.review_id,
        trade_id: row.trade_id,
        symbol: row.symbol,
        outcome: row.outcome,
        result_r: row.result_r,
        process_score: row.process_score,
        mistakes,
        emotional_tags: emotionalTags,
        user_notes: row.user_notes,
        created_at: row.created_at,
        matched_mistake: mistake
      });
    }
  }

  return matched;
}
