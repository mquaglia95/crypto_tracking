-- Drop tables if re-running migrations
DROP TABLE IF EXISTS matched_trades CASCADE;
DROP TABLE IF EXISTS crypto_sales CASCADE;
DROP TABLE IF EXISTS tax_lots CASCADE;
DROP TABLE IF EXISTS income_events CASCADE;
DROP TABLE IF EXISTS unmatched_transactions CASCADE;

-- Tax lots: one row per purchase event
CREATE TABLE tax_lots (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(100),
    asset_symbol VARCHAR(20) NOT NULL,
    buy_timestamp TIMESTAMPTZ NOT NULL,
    initial_qty NUMERIC(28, 10) NOT NULL,
    remaining_qty NUMERIC(28, 10) NOT NULL,
    price_per_unit NUMERIC(28, 10) NOT NULL,
    total_cost_usd NUMERIC(18, 4) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales: one row per disposal event
CREATE TABLE crypto_sales (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(100),
    asset_symbol VARCHAR(20) NOT NULL,
    sell_timestamp TIMESTAMPTZ NOT NULL,
    qty NUMERIC(28, 10) NOT NULL,
    price_per_unit NUMERIC(28, 10) NOT NULL,
    total_proceeds_usd NUMERIC(18, 4) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staking rewards, airdrops, and other income events
CREATE TABLE income_events (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(100),
    asset_symbol VARCHAR(20) NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL,
    qty NUMERIC(28, 10) NOT NULL,
    value_usd NUMERIC(18, 4) NOT NULL,
    income_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HIFO-matched trades (populated by run_hifo_matching_engine())
CREATE TABLE matched_trades (
    id SERIAL PRIMARY KEY,
    sale_id INT REFERENCES crypto_sales(id) ON DELETE CASCADE,
    buy_lot_id INT REFERENCES tax_lots(id) ON DELETE CASCADE,
    asset_symbol VARCHAR(20) NOT NULL,
    qty_matched NUMERIC(28, 10) NOT NULL,
    cost_basis NUMERIC(18, 4) NOT NULL,
    proceeds NUMERIC(18, 4) NOT NULL,
    gain_loss NUMERIC(18, 4) NOT NULL,
    holding_period VARCHAR(10) NOT NULL CHECK (holding_period IN ('SHORT', 'LONG')),
    matched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions that could not be automatically classified
CREATE TABLE unmatched_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(100),
    raw_timestamp VARCHAR(50),
    transaction_type VARCHAR(100),
    asset VARCHAR(50),
    quantity VARCHAR(50),
    notes TEXT,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_tax_lots_asset_remaining ON tax_lots (asset_symbol, remaining_qty) WHERE remaining_qty > 0;
CREATE INDEX idx_tax_lots_asset_price ON tax_lots (asset_symbol, price_per_unit DESC);
CREATE INDEX idx_crypto_sales_asset_timestamp ON crypto_sales (asset_symbol, sell_timestamp ASC);
CREATE INDEX idx_matched_trades_sale ON matched_trades (sale_id);
CREATE INDEX idx_matched_trades_lot ON matched_trades (buy_lot_id);
