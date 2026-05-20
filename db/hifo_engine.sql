-- HIFO Matching Engine
-- Iterates sales chronologically, consuming the highest-cost lots first.
-- Safe to re-run: resets remaining_qty and clears matched_trades before each run.

CREATE OR REPLACE FUNCTION run_hifo_matching_engine() RETURNS VOID AS $$
DECLARE
    r_sale RECORD;
    r_lot  RECORD;
    v_remaining_sale_qty NUMERIC(28, 10);
    v_match_qty          NUMERIC(28, 10);
BEGIN
    -- Reset state so the function is idempotent
    UPDATE tax_lots SET remaining_qty = initial_qty;
    DELETE FROM matched_trades;

    FOR r_sale IN
        SELECT * FROM crypto_sales ORDER BY sell_timestamp ASC, id ASC
    LOOP
        v_remaining_sale_qty := r_sale.qty;

        -- HIFO: consume highest-priced lots first, then break ties by oldest first
        FOR r_lot IN
            SELECT * FROM tax_lots
            WHERE asset_symbol = r_sale.asset_symbol
              AND remaining_qty > 0.000000001
              AND buy_timestamp <= r_sale.sell_timestamp
            ORDER BY price_per_unit DESC, buy_timestamp ASC
            FOR UPDATE
        LOOP
            EXIT WHEN v_remaining_sale_qty <= 0.000000001;

            v_match_qty := LEAST(r_lot.remaining_qty, v_remaining_sale_qty);

            INSERT INTO matched_trades (
                sale_id,
                buy_lot_id,
                asset_symbol,
                qty_matched,
                cost_basis,
                proceeds,
                gain_loss,
                holding_period
            ) VALUES (
                r_sale.id,
                r_lot.id,
                r_sale.asset_symbol,
                v_match_qty,
                ROUND(v_match_qty * r_lot.price_per_unit, 4),
                ROUND(v_match_qty * r_sale.price_per_unit, 4),
                ROUND((v_match_qty * r_sale.price_per_unit) - (v_match_qty * r_lot.price_per_unit), 4),
                CASE
                    WHEN (r_sale.sell_timestamp - r_lot.buy_timestamp) > INTERVAL '1 year' THEN 'LONG'
                    ELSE 'SHORT'
                END
            );

            UPDATE tax_lots
            SET remaining_qty = remaining_qty - v_match_qty
            WHERE id = r_lot.id;

            v_remaining_sale_qty := v_remaining_sale_qty - v_match_qty;
        END LOOP;

        IF v_remaining_sale_qty > 0.000001 THEN
            RAISE WARNING 'Sale ID % (%) could not be fully matched — unmatched qty: %',
                r_sale.id, r_sale.asset_symbol, v_remaining_sale_qty;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;


-- IRS Form 8949 reporting view
CREATE OR REPLACE VIEW irs_form_8949_export AS
SELECT
    mt.id,
    mt.asset_symbol                                              AS description_of_property,
    ROUND(mt.qty_matched, 8)::TEXT || ' ' || mt.asset_symbol    AS quantity_and_token,
    TO_CHAR(tl.buy_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD')  AS date_acquired,
    TO_CHAR(cs.sell_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date_sold,
    mt.proceeds                                                  AS gross_proceeds,
    mt.cost_basis                                                AS total_cost_basis,
    mt.gain_loss                                                 AS capital_gain_or_loss,
    mt.holding_period                                            AS classification,
    SUM(mt.gain_loss) OVER (
        ORDER BY cs.sell_timestamp ASC, mt.id ASC
    )                                                            AS running_net_gain_loss
FROM matched_trades mt
JOIN crypto_sales cs ON mt.sale_id  = cs.id
JOIN tax_lots     tl ON mt.buy_lot_id = tl.id
ORDER BY cs.sell_timestamp ASC, mt.id ASC;


-- Summary statistics view (for dashboard cards)
CREATE OR REPLACE VIEW tax_summary AS
SELECT
    COALESCE(SUM(gain_loss) FILTER (WHERE holding_period = 'SHORT'), 0) AS net_short_term,
    COALESCE(SUM(gain_loss) FILTER (WHERE holding_period = 'LONG'),  0) AS net_long_term,
    COALESCE(SUM(gain_loss), 0)                                          AS net_total,
    COUNT(*) FILTER (WHERE gain_loss > 0)                                AS winning_trades,
    COUNT(*) FILTER (WHERE gain_loss < 0)                                AS losing_trades,
    COUNT(*)                                                             AS total_trades
FROM matched_trades;


-- Remaining open tax lots (unrealized positions)
CREATE OR REPLACE VIEW open_tax_lots AS
SELECT
    id,
    transaction_id,
    asset_symbol,
    buy_timestamp,
    initial_qty,
    remaining_qty,
    price_per_unit,
    ROUND(remaining_qty * price_per_unit, 4) AS remaining_cost_basis
FROM tax_lots
WHERE remaining_qty > 0.000000001
ORDER BY asset_symbol, buy_timestamp ASC;
