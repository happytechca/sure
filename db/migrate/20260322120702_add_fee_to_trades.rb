class AddFeeToTrades < ActiveRecord::Migration[7.2]
  def change
    add_column :trades, :fee, :decimal, precision: 19, scale: 10, default: 0, null: false
  end
end
