# Plan: Add Transaction Fee to Trades

## Context

Users need to record brokerage/commission fees when creating buy/sell trades (GitHub discussion #607). Currently fees are not tracked, causing the activity feed to not match bank ledger totals. For example, buying 1 AAPL at $200 with a $9.95 fee shows as $200 in the app but $209.95 on the bank statement.

**Goal**: The activity feed entry amount should include the fee (e.g., $209.95). The detail/edit view breaks it down into qty, price, fee, and total — all editable, with smart recalculation when values conflict.

## Design Decisions

1. **Fee stored as column on `trades` table** — simple, queryable, no extra entries
2. **Entry amount = qty × price + fee** — matches bank ledger
3. **Flat fee only** (no percentage for v1)
4. **Inline recalculation picker** (no modal-on-modal) when editing total amount

## Recalculation UX

The edit form shows 4 editable fields: **Qty, Price, Fee, Total Amount**

Equation: `Total = Qty × Price + Fee`

**Default behavior** (no picker needed):
- User edits Qty → Total auto-recalculates
- User edits Price → Total auto-recalculates
- User edits Fee → Total auto-recalculates

**Picker appears only when user edits Total** (the ambiguous case):
- Inline radio group appears below the total field:
  - Price (recommended) — adjusts price to fit new total
  - Quantity — adjusts qty to fit new total
  - Fee — adjusts fee to fit new total
- User selects option → value recalculates client-side → form auto-submits → picker hides

This is cleaner than Quicken's approach — the picker only appears when there's genuine ambiguity.

**Stimulus controller**: `trade-recalculate` — intercepts changes on the 4 fields, handles client-side recalculation, shows/hides the picker, then delegates to `auto-submit-form` for submission.

## Sign Convention for Fee + Amount

- Buy: `signed_qty` is positive, `signed_amount = signed_qty * price + fee` → positive (cash outflow) ✓
- Sell: `signed_qty` is negative, `signed_amount = signed_qty * price + fee` → less negative (fee reduces proceeds) ✓
- Fee is always stored as a positive value on the trade

## Implementation Steps

### 1. Migration: add `fee` column to `trades`

```
db/migrate/XXXXX_add_fee_to_trades.rb
```

- `add_column :trades, :fee, :decimal, precision: 19, scale: 10, default: 0, null: false`
- Match precision/scale with existing `price` column (precision: 19, scale: 10)

### 2. Trade model: add fee monetize

**File**: `app/models/trade.rb`
- Add `monetize :fee` (consistent with existing `monetize :price`)

### 3. Trade::CreateForm: incorporate fee into trade creation

**File**: `app/models/trade/create_form.rb`
- Add `fee` to `attr_accessor`
- In `create_trade`: `signed_amount = signed_qty * price.to_d + fee.to_d`
- Pass `fee: fee.to_d` to `Trade.new`

### 4. Controller: permit fee param, update recalculation logic

**File**: `app/controllers/trades_controller.rb`

**create_params**: add `:fee`

**entry_params**: add `:fee` to `entryable_attributes`

**update_entry_params**: update amount calculation to include fee:
```ruby
fee = update_params[:entryable_attributes][:fee].to_d
update_params[:amount] = qty * price.to_d + fee
```

Add support for a `recalculate` param (from the recalculation picker). When present, instead of always recalculating amount, recalculate the chosen field:
- `recalculate=price`: `price = (amount - fee) / qty`
- `recalculate=qty`: `qty = (amount - fee) / price`
- `recalculate=fee`: `fee = amount - (qty * price)`

### 5. Creation form: add fee field

**File**: `app/views/trades/_form.html.erb`

Add `money_field :fee` inside the buy/sell block, after price, not required.

### 6. Edit view (show.html.erb): add fee field + total amount + recalculation picker

**File**: `app/views/trades/show.html.erb`

In the Details section, add:
- Fee field (money_field on entryable, after price)
- Total amount field (money_field on entry amount, after fee)
- Hidden recalculation picker div (shown by Stimulus when total is edited)

The recalculation picker HTML (hidden by default):
```erb
<div data-trade-recalculate-target="picker" class="hidden p-3 rounded-lg bg-container-inset space-y-2">
  <p class="text-sm text-secondary"><%= t(".recalculate_prompt") %></p>
  <div class="space-y-1">
    <label class="flex items-center gap-2 text-sm">
      <input type="radio" name="recalculate" value="price" checked
             data-action="trade-recalculate#select">
      <%= t(".recalculate_price") %>
    </label>
    <label class="flex items-center gap-2 text-sm">
      <input type="radio" name="recalculate" value="qty"
             data-action="trade-recalculate#select">
      <%= t(".recalculate_qty") %>
    </label>
    <label class="flex items-center gap-2 text-sm">
      <input type="radio" name="recalculate" value="fee"
             data-action="trade-recalculate#select">
      <%= t(".recalculate_fee") %>
    </label>
  </div>
</div>
```

### 7. Stimulus controller: trade-recalculate

**File**: `app/javascript/controllers/trade_recalculate_controller.js`

Targets: `qty`, `price`, `fee`, `total`, `picker`

Logic:
- On qty/price/fee change → compute `total = qty * price + fee`, update total field value, let auto-submit proceed
- On total change → show picker, prevent auto-submit until user selects
- On picker selection → recalculate chosen field client-side, hide picker, trigger auto-submit
- Wire into the existing auto-submit-form by controlling when `requestSubmit()` fires

### 8. Header partial: no changes needed

**File**: `app/views/trades/_header.html.erb`

Already displays `entry.amount_money` which will now include the fee.

### 9. i18n translations

**File**: `config/locales/views/trades/en.yml`

Add under `trades.form`:
- `fee: "Transaction fee"`

Add under `trades.show`:
- `fee_label: "Transaction fee"`
- `total_label: "Total amount"`
- `recalculate_prompt: "Recalculate which value?"`
- `recalculate_price: "Price per share (recommended)"`
- `recalculate_qty: "Quantity"`
- `recalculate_fee: "Transaction fee"`

### 10. Tests

**File**: `test/controllers/trades_controller_test.rb`
- Test create buy with fee → entry amount = qty*price + fee
- Test create buy without fee → entry amount = qty*price (backward compatible)
- Test create sell with fee → entry amount = -(qty*price) + fee
- Test update with recalculate=price → price recalculated
- Test update with recalculate=fee → fee recalculated

**File**: `test/models/trade_test.rb`
- Test fee defaults to 0

## Files Summary

| File | Change |
|------|--------|
| `db/migrate/XXXXX_add_fee_to_trades.rb` | New migration |
| `app/models/trade.rb` | Add `monetize :fee` |
| `app/models/trade/create_form.rb` | Include fee in amount calculation |
| `app/controllers/trades_controller.rb` | Permit fee, recalculate param, update logic |
| `app/views/trades/_form.html.erb` | Add fee money_field (creation) |
| `app/views/trades/show.html.erb` | Add fee field, total field, recalculation picker (edit) |
| `app/javascript/controllers/trade_recalculate_controller.js` | New Stimulus controller |
| `config/locales/views/trades/en.yml` | i18n keys |
| `test/controllers/trades_controller_test.rb` | Fee creation + recalculation tests |
| `test/models/trade_test.rb` | Fee default test |

## Verification

1. `bin/rails db:migrate`
2. `bin/rails test test/controllers/trades_controller_test.rb test/models/trade_test.rb`
3. `bin/rails test` — full suite passes
4. `bin/rubocop -f github -a` — no lint issues
5. Manual: create buy trade with fee → activity feed shows total including fee → open detail → see fee field → edit total → recalculation picker appears → select price → price recalculates → form submits
