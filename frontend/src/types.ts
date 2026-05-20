export interface TaxRecord {
  id: number;
  description_of_property: string;
  quantity_and_token: string;
  date_acquired: string;
  date_sold: string;
  gross_proceeds: number;
  total_cost_basis: number;
  capital_gain_or_loss: number;
  classification: 'SHORT' | 'LONG';
  running_net_gain_loss: number;
}

export interface TaxSummary {
  net_short_term: number;
  net_long_term: number;
  net_total: number;
  winning_trades: number;
  losing_trades: number;
  total_trades: number;
  total_staking_income: number;
}

export interface TaxLot {
  id: number;
  transaction_id: string;
  asset_symbol: string;
  buy_timestamp: string;
  initial_qty: number;
  remaining_qty: number;
  price_per_unit: number;
  remaining_cost_basis: number;
}

export interface IncomeEvent {
  id: number;
  transaction_id: string;
  asset_symbol: string;
  event_timestamp: string;
  qty: number;
  value_usd: number;
  income_type: string;
}
