import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import {
  validateResearchItem,
  validatePlaybook,
  validateTradeReview
} from '../../shared/contract.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'friday_archive.db');

let globalDb = null;

/**
 * Initializes SQLite database for ARCHIVE with WAL mode and FTS5 search
 * @param {string} [customPath]
 * @returns {DatabaseSync}
 */
export function initArchiveDatabase(customPath = null) {
  const targetPath = customPath || DB_PATH;

  if (targetPath !== ':memory:') {
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
  }

  const db = new DatabaseSync(targetPath);

  // Enable WAL mode (Section 4)
  if (targetPath !== ':memory:') {
    try {
      db.exec('PRAGMA journal_mode = WAL;');
    } catch (e) {
      // Memory db ignores WAL
    }
  }

  // 1. research_items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS research_items (
      item_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      symbol TEXT,
      symbols_json TEXT NOT NULL,
      asset_class TEXT NOT NULL DEFAULT 'equity',
      timeframe TEXT NOT NULL DEFAULT 'swing',
      market_regime TEXT,
      setup TEXT,
      thesis TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      source_refs_json TEXT NOT NULL DEFAULT '[]',
      linked_trade_ids_json TEXT NOT NULL DEFAULT '[]',
      linked_workflow_ids_json TEXT NOT NULL DEFAULT '[]',
      linked_news_ids_json TEXT NOT NULL DEFAULT '[]',
      linked_filing_ids_json TEXT NOT NULL DEFAULT '[]',
      confidence REAL NOT NULL DEFAULT 1.0,
      user_authored INTEGER NOT NULL DEFAULT 1,
      model_generated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT
    )
  `);

  // 2. research_links table
  db.exec(`
    CREATE TABLE IF NOT EXISTS research_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      link_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // 3. playbooks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS playbooks (
      playbook_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      market_regime TEXT NOT NULL DEFAULT 'all',
      symbols_json TEXT NOT NULL DEFAULT '[]',
      timeframes_json TEXT NOT NULL DEFAULT '[]',
      entry_rules_json TEXT NOT NULL DEFAULT '[]',
      invalidation_rules_json TEXT NOT NULL DEFAULT '[]',
      stop_rules_json TEXT NOT NULL DEFAULT '[]',
      target_rules_json TEXT NOT NULL DEFAULT '[]',
      position_sizing_rules_json TEXT NOT NULL DEFAULT '[]',
      event_filters_json TEXT NOT NULL DEFAULT '[]',
      required_context_json TEXT NOT NULL DEFAULT '[]',
      example_trade_ids_json TEXT NOT NULL DEFAULT '[]',
      performance_summary_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // 4. playbook_trades table
  db.exec(`
    CREATE TABLE IF NOT EXISTS playbook_trades (
      playbook_id TEXT NOT NULL,
      trade_id TEXT NOT NULL,
      PRIMARY KEY (playbook_id, trade_id)
    )
  `);

  // 5. trade_reviews table
  db.exec(`
    CREATE TABLE IF NOT EXISTS trade_reviews (
      review_id TEXT PRIMARY KEY,
      trade_id TEXT NOT NULL UNIQUE,
      symbol TEXT NOT NULL,
      outcome TEXT NOT NULL DEFAULT 'open',
      result_r REAL,
      process_score INTEGER NOT NULL DEFAULT 100,
      discipline_score INTEGER NOT NULL DEFAULT 100,
      what_went_right_json TEXT NOT NULL DEFAULT '[]',
      what_went_wrong_json TEXT NOT NULL DEFAULT '[]',
      mistakes_json TEXT NOT NULL DEFAULT '[]',
      lessons_json TEXT NOT NULL DEFAULT '[]',
      market_context TEXT NOT NULL DEFAULT '',
      thesis_at_entry TEXT NOT NULL DEFAULT '',
      thesis_validated INTEGER,
      followed_plan INTEGER,
      emotional_tags_json TEXT NOT NULL DEFAULT '[]',
      user_notes TEXT NOT NULL DEFAULT '',
      model_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )
  `);

  // 6. archive_embeddings table (local vector storage)
  db.exec(`
    CREATE TABLE IF NOT EXISTS archive_embeddings (
      item_id TEXT PRIMARY KEY,
      vector_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // 7. archive_tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS archive_tags (
      item_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (item_id, tag)
    )
  `);

  // 8. archive_events audit log
  db.exec(`
    CREATE TABLE IF NOT EXISTS archive_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      item_id TEXT,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // 9. archive_exports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS archive_exports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      export_format TEXT NOT NULL,
      item_count INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // 10. FTS5 Virtual Table for full-text search
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS research_fts USING fts5(
        item_id UNINDEXED,
        title,
        thesis,
        body,
        tags,
        symbol,
        setup
      )
    `);
  } catch (err) {
    console.warn('[ARCHIVE] FTS5 initialization notice:', err.message);
  }

  if (!customPath) {
    globalDb = db;
  }
  return db;
}

export function getArchiveDb() {
  if (!globalDb) {
    globalDb = initArchiveDatabase();
  }
  return globalDb;
}

// =============================================================================
// RESEARCH ITEM CRUD & SYNC
// =============================================================================

function rowToResearchItem(row) {
  if (!row) return null;
  return {
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
    source_refs: JSON.parse(row.source_refs_json || '[]'),
    linked_trade_ids: JSON.parse(row.linked_trade_ids_json || '[]'),
    linked_workflow_ids: JSON.parse(row.linked_workflow_ids_json || '[]'),
    linked_news_ids: JSON.parse(row.linked_news_ids_json || '[]'),
    linked_filing_ids: JSON.parse(row.linked_filing_ids_json || '[]'),
    confidence: Number(row.confidence),
    user_authored: Boolean(row.user_authored),
    model_generated: Boolean(row.model_generated),
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at
  };
}

export function saveResearchItem(item, db = getArchiveDb()) {
  const check = validateResearchItem(item);
  if (!check.valid) {
    throw new Error(`Invalid ResearchItem: ${check.errors.join('; ')}`);
  }

  const stmt = db.prepare(`
    INSERT INTO research_items (
      item_id, kind, title, symbol, symbols_json, asset_class, timeframe,
      market_regime, setup, thesis, body, tags_json, source_refs_json,
      linked_trade_ids_json, linked_workflow_ids_json, linked_news_ids_json,
      linked_filing_ids_json, confidence, user_authored, model_generated,
      created_at, updated_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(item_id) DO UPDATE SET
      kind = excluded.kind,
      title = excluded.title,
      symbol = excluded.symbol,
      symbols_json = excluded.symbols_json,
      asset_class = excluded.asset_class,
      timeframe = excluded.timeframe,
      market_regime = excluded.market_regime,
      setup = excluded.setup,
      thesis = excluded.thesis,
      body = excluded.body,
      tags_json = excluded.tags_json,
      source_refs_json = excluded.source_refs_json,
      linked_trade_ids_json = excluded.linked_trade_ids_json,
      linked_workflow_ids_json = excluded.linked_workflow_ids_json,
      linked_news_ids_json = excluded.linked_news_ids_json,
      linked_filing_ids_json = excluded.linked_filing_ids_json,
      confidence = excluded.confidence,
      user_authored = excluded.user_authored,
      model_generated = excluded.model_generated,
      updated_at = excluded.updated_at,
      archived_at = excluded.archived_at
  `);

  stmt.run(
    item.item_id,
    item.kind,
    item.title,
    item.symbol || null,
    JSON.stringify(item.symbols || (item.symbol ? [item.symbol] : [])),
    item.asset_class || 'equity',
    item.timeframe || 'swing',
    item.market_regime || null,
    item.setup || null,
    item.thesis || '',
    item.body || '',
    JSON.stringify(item.tags || []),
    JSON.stringify(item.source_refs || []),
    JSON.stringify(item.linked_trade_ids || []),
    JSON.stringify(item.linked_workflow_ids || []),
    JSON.stringify(item.linked_news_ids || []),
    JSON.stringify(item.linked_filing_ids || []),
    item.confidence !== undefined ? item.confidence : 1.0,
    item.user_authored ? 1 : 0,
    item.model_generated ? 1 : 0,
    item.created_at || new Date().toISOString(),
    item.updated_at || new Date().toISOString(),
    item.archived_at || null
  );

  // Sync to FTS5 table
  try {
    db.prepare('DELETE FROM research_fts WHERE item_id = ?').run(item.item_id);
    const ftsStmt = db.prepare(`
      INSERT INTO research_fts (item_id, title, thesis, body, tags, symbol, setup)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    ftsStmt.run(
      item.item_id,
      item.title || '',
      item.thesis || '',
      item.body || '',
      (item.tags || []).join(' '),
      item.symbol || '',
      item.setup || ''
    );
  } catch (err) {
    // If FTS not present in testing environment
  }

  // Sync tags
  try {
    db.prepare('DELETE FROM archive_tags WHERE item_id = ?').run(item.item_id);
    const tagStmt = db.prepare('INSERT OR IGNORE INTO archive_tags (item_id, tag) VALUES (?, ?)');
    for (const t of (item.tags || [])) {
      tagStmt.run(item.item_id, t.toLowerCase());
    }
  } catch (err) {}

  return item;
}

export function getResearchItem(itemId, db = getArchiveDb()) {
  const stmt = db.prepare('SELECT * FROM research_items WHERE item_id = ?');
  const row = stmt.get(itemId);
  return rowToResearchItem(row);
}

export function listResearchItems({ symbol, kind, setup, asset_class, limit = 100 } = {}, db = getArchiveDb()) {
  let sql = 'SELECT * FROM research_items WHERE 1=1';
  const params = [];

  if (symbol) {
    sql += ' AND (symbol = ? OR symbols_json LIKE ?)';
    params.push(symbol.toUpperCase(), `%"${symbol.toUpperCase()}"%`);
  }
  if (kind) {
    sql += ' AND kind = ?';
    params.push(kind);
  }
  if (setup) {
    sql += ' AND setup = ?';
    params.push(setup);
  }
  if (asset_class) {
    sql += ' AND asset_class = ?';
    params.push(asset_class);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params);
  return rows.map(rowToResearchItem);
}

export function updateResearchItem(itemId, updates, db = getArchiveDb()) {
  const existing = getResearchItem(itemId, db);
  if (!existing) {
    throw new Error(`ResearchItem with id ${itemId} not found`);
  }

  const merged = {
    ...existing,
    ...updates,
    tags: updates.tags ? updates.tags : existing.tags,
    symbols: updates.symbols ? updates.symbols : existing.symbols,
    updated_at: new Date().toISOString()
  };

  return saveResearchItem(merged, db);
}

export function deleteResearchItem(itemId, db = getArchiveDb()) {
  // Delete from main table
  db.prepare('DELETE FROM research_items WHERE item_id = ?').run(itemId);
  // Delete from FTS
  try { db.prepare('DELETE FROM research_fts WHERE item_id = ?').run(itemId); } catch (e) {}
  // Delete from embeddings (Test 12 requirement: removes or invalidates embedding)
  try { db.prepare('DELETE FROM archive_embeddings WHERE item_id = ?').run(itemId); } catch (e) {}
  // Delete from tags
  try { db.prepare('DELETE FROM archive_tags WHERE item_id = ?').run(itemId); } catch (e) {}
  // Delete from links
  try { db.prepare('DELETE FROM research_links WHERE item_id = ?').run(itemId); } catch (e) {}

  return { deleted: true, item_id: itemId };
}

// =============================================================================
// PLAYBOOK CRUD
// =============================================================================

function rowToPlaybook(row) {
  if (!row) return null;
  return {
    playbook_id: row.playbook_id,
    name: row.name,
    description: row.description,
    market_regime: row.market_regime,
    symbols: JSON.parse(row.symbols_json || '[]'),
    timeframes: JSON.parse(row.timeframes_json || '[]'),
    entry_rules: JSON.parse(row.entry_rules_json || '[]'),
    invalidation_rules: JSON.parse(row.invalidation_rules_json || '[]'),
    stop_rules: JSON.parse(row.stop_rules_json || '[]'),
    target_rules: JSON.parse(row.target_rules_json || '[]'),
    position_sizing_rules: JSON.parse(row.position_sizing_rules_json || '[]'),
    event_filters: JSON.parse(row.event_filters_json || '[]'),
    required_context: JSON.parse(row.required_context_json || '[]'),
    example_trade_ids: JSON.parse(row.example_trade_ids_json || '[]'),
    performance_summary: JSON.parse(row.performance_summary_json),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function savePlaybook(playbook, db = getArchiveDb()) {
  const check = validatePlaybook(playbook);
  if (!check.valid) {
    throw new Error(`Invalid Playbook: ${check.errors.join('; ')}`);
  }

  const stmt = db.prepare(`
    INSERT INTO playbooks (
      playbook_id, name, description, market_regime, symbols_json, timeframes_json,
      entry_rules_json, invalidation_rules_json, stop_rules_json, target_rules_json,
      position_sizing_rules_json, event_filters_json, required_context_json,
      example_trade_ids_json, performance_summary_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(playbook_id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      market_regime = excluded.market_regime,
      symbols_json = excluded.symbols_json,
      timeframes_json = excluded.timeframes_json,
      entry_rules_json = excluded.entry_rules_json,
      invalidation_rules_json = excluded.invalidation_rules_json,
      stop_rules_json = excluded.stop_rules_json,
      target_rules_json = excluded.target_rules_json,
      position_sizing_rules_json = excluded.position_sizing_rules_json,
      event_filters_json = excluded.event_filters_json,
      required_context_json = excluded.required_context_json,
      example_trade_ids_json = excluded.example_trade_ids_json,
      performance_summary_json = excluded.performance_summary_json,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    playbook.playbook_id,
    playbook.name,
    playbook.description,
    playbook.market_regime || 'all',
    JSON.stringify(playbook.symbols || []),
    JSON.stringify(playbook.timeframes || []),
    JSON.stringify(playbook.entry_rules || []),
    JSON.stringify(playbook.invalidation_rules || []),
    JSON.stringify(playbook.stop_rules || []),
    JSON.stringify(playbook.target_rules || []),
    JSON.stringify(playbook.position_sizing_rules || []),
    JSON.stringify(playbook.event_filters || []),
    JSON.stringify(playbook.required_context || []),
    JSON.stringify(playbook.example_trade_ids || []),
    JSON.stringify(playbook.performance_summary),
    playbook.created_at || new Date().toISOString(),
    playbook.updated_at || new Date().toISOString()
  );

  return playbook;
}

export function getPlaybook(playbookId, db = getArchiveDb()) {
  const stmt = db.prepare('SELECT * FROM playbooks WHERE playbook_id = ?');
  const row = stmt.get(playbookId);
  return rowToPlaybook(row);
}

export function listPlaybooks(db = getArchiveDb()) {
  const stmt = db.prepare('SELECT * FROM playbooks ORDER BY created_at DESC');
  const rows = stmt.all();
  return rows.map(rowToPlaybook);
}

// =============================================================================
// TRADE REVIEW CRUD
// =============================================================================

function rowToTradeReview(row) {
  if (!row) return null;
  return {
    review_id: row.review_id,
    trade_id: row.trade_id,
    symbol: row.symbol,
    outcome: row.outcome,
    result_r: row.result_r !== null ? Number(row.result_r) : null,
    process_score: Number(row.process_score),
    discipline_score: Number(row.discipline_score),
    what_went_right: JSON.parse(row.what_went_right_json || '[]'),
    what_went_wrong: JSON.parse(row.what_went_wrong_json || '[]'),
    mistakes: JSON.parse(row.mistakes_json || '[]'),
    lessons: JSON.parse(row.lessons_json || '[]'),
    market_context: row.market_context,
    thesis_at_entry: row.thesis_at_entry,
    thesis_validated: row.thesis_validated !== null ? Boolean(row.thesis_validated) : null,
    followed_plan: row.followed_plan !== null ? Boolean(row.followed_plan) : null,
    emotional_tags: JSON.parse(row.emotional_tags_json || '[]'),
    user_notes: row.user_notes,
    model_notes: row.model_notes,
    created_at: row.created_at
  };
}

export function saveTradeReview(review, db = getArchiveDb()) {
  const check = validateTradeReview(review);
  if (!check.valid) {
    throw new Error(`Invalid TradeReview: ${check.errors.join('; ')}`);
  }

  const stmt = db.prepare(`
    INSERT INTO trade_reviews (
      review_id, trade_id, symbol, outcome, result_r, process_score, discipline_score,
      what_went_right_json, what_went_wrong_json, mistakes_json, lessons_json,
      market_context, thesis_at_entry, thesis_validated, followed_plan,
      emotional_tags_json, user_notes, model_notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(trade_id) DO UPDATE SET
      outcome = excluded.outcome,
      result_r = excluded.result_r,
      process_score = excluded.process_score,
      discipline_score = excluded.discipline_score,
      what_went_right_json = excluded.what_went_right_json,
      what_went_wrong_json = excluded.what_went_wrong_json,
      mistakes_json = excluded.mistakes_json,
      lessons_json = excluded.lessons_json,
      market_context = excluded.market_context,
      thesis_at_entry = excluded.thesis_at_entry,
      thesis_validated = excluded.thesis_validated,
      followed_plan = excluded.followed_plan,
      emotional_tags_json = excluded.emotional_tags_json,
      user_notes = excluded.user_notes,
      model_notes = excluded.model_notes
  `);

  stmt.run(
    review.review_id,
    review.trade_id,
    review.symbol.toUpperCase(),
    review.outcome,
    review.result_r !== undefined ? review.result_r : null,
    review.process_score !== undefined ? review.process_score : 100,
    review.discipline_score !== undefined ? review.discipline_score : 100,
    JSON.stringify(review.what_went_right || []),
    JSON.stringify(review.what_went_wrong || []),
    JSON.stringify(review.mistakes || []),
    JSON.stringify(review.lessons || []),
    review.market_context || '',
    review.thesis_at_entry || '',
    review.thesis_validated !== undefined && review.thesis_validated !== null ? (review.thesis_validated ? 1 : 0) : null,
    review.followed_plan !== undefined && review.followed_plan !== null ? (review.followed_plan ? 1 : 0) : null,
    JSON.stringify(review.emotional_tags || []),
    review.user_notes || '',
    review.model_notes || '',
    review.created_at || new Date().toISOString()
  );

  return review;
}

export function getTradeReview(tradeIdOrReviewId, db = getArchiveDb()) {
  const stmt = db.prepare('SELECT * FROM trade_reviews WHERE review_id = ? OR trade_id = ?');
  const row = stmt.get(tradeIdOrReviewId, tradeIdOrReviewId);
  return rowToTradeReview(row);
}

export function listTradeReviews({ symbol, outcome, limit = 50 } = {}, db = getArchiveDb()) {
  let sql = 'SELECT * FROM trade_reviews WHERE 1=1';
  const params = [];

  if (symbol) {
    sql += ' AND symbol = ?';
    params.push(symbol.toUpperCase());
  }
  if (outcome) {
    sql += ' AND outcome = ?';
    params.push(outcome);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params);
  return rows.map(rowToTradeReview);
}

// =============================================================================
// EMBEDDINGS STORAGE
// =============================================================================

export function saveEmbedding(itemId, vector, db = getArchiveDb()) {
  const stmt = db.prepare(`
    INSERT INTO archive_embeddings (item_id, vector_json, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT(item_id) DO UPDATE SET
      vector_json = excluded.vector_json,
      created_at = excluded.created_at
  `);
  stmt.run(itemId, JSON.stringify(vector), new Date().toISOString());
}

export function getEmbedding(itemId, db = getArchiveDb()) {
  const stmt = db.prepare('SELECT vector_json FROM archive_embeddings WHERE item_id = ?');
  const row = stmt.get(itemId);
  return row ? JSON.parse(row.vector_json) : null;
}

export function listAllEmbeddings(db = getArchiveDb()) {
  const stmt = db.prepare('SELECT item_id, vector_json FROM archive_embeddings');
  const rows = stmt.all();
  return rows.map(r => ({
    item_id: r.item_id,
    vector: JSON.parse(r.vector_json)
  }));
}

// =============================================================================
// RESEARCH LINKS
// =============================================================================

export function createResearchLink(itemId, linkType, targetId, db = getArchiveDb()) {
  const stmt = db.prepare(`
    INSERT INTO research_links (item_id, link_type, target_id, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(itemId, linkType, targetId, new Date().toISOString());
  return { item_id: itemId, link_type: linkType, target_id: targetId };
}

// =============================================================================
// EXPORT ARCHIVE (Markdown, JSON, CSV)
// =============================================================================

export function exportArchive(format = 'json', filters = {}, db = getArchiveDb()) {
  const items = listResearchItems(filters, db);
  const normalizedFormat = format.toLowerCase().trim();
  let data = '';

  if (normalizedFormat === 'markdown' || normalizedFormat === 'md') {
    const lines = [
      '# ARCHIVE Research Export',
      `*Exported at ${new Date().toISOString()} | Total items: ${items.length}*`,
      '',
      '| Title | Symbol | Kind | Timeframe | Tags | Created |',
      '|-------|--------|------|-----------|------|---------|'
    ];
    for (const item of items) {
      const tagsStr = (item.tags || []).join(', ');
      lines.push(`| ${item.title.replace(/\|/g, '-')} | ${item.symbol || '—'} | ${item.kind} | ${item.timeframe || '—'} | ${tagsStr} | ${item.created_at} |`);
    }
    lines.push('', '## Detail Entries', '');
    for (const item of items) {
      lines.push(`### ${item.title}`);
      lines.push(`- **Kind**: ${item.kind}`);
      lines.push(`- **Symbol**: ${item.symbol || '—'}`);
      lines.push(`- **Thesis**: ${item.thesis || '—'}`);
      if (item.body) {
        lines.push(`- **Body**: ${item.body.slice(0, 300)}`);
      }
      lines.push('');
    }
    data = lines.join('\n');
  } else if (normalizedFormat === 'csv') {
    const headers = ['item_id', 'kind', 'title', 'symbol', 'timeframe', 'setup', 'thesis', 'created_at'];
    const rows = [headers.map(h => `"${h}"`).join(',')];
    for (const item of items) {
      const row = [
        item.item_id,
        item.kind,
        (item.title || '').replace(/"/g, '""'),
        item.symbol || '',
        item.timeframe || '',
        item.setup || '',
        (item.thesis || '').replace(/"/g, '""'),
        item.created_at
      ];
      rows.push(row.map(val => `"${val}"`).join(','));
    }
    data = rows.join('\n');
  } else {
    // Default JSON
    data = JSON.stringify({
      exported_at: new Date().toISOString(),
      item_count: items.length,
      filters,
      items
    }, null, 2);
  }

  // Record audit entry in archive_exports table
  try {
    db.prepare(`
      INSERT INTO archive_exports (export_format, item_count, created_at)
      VALUES (?, ?, ?)
    `).run(normalizedFormat, items.length, new Date().toISOString());
  } catch (e) {
    // Audit insert shouldn't block export
  }

  return {
    format: normalizedFormat,
    data,
    item_count: items.length,
    exported_at: new Date().toISOString()
  };
}
