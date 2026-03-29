class AddFeeAndSplitDataToImportRows < ActiveRecord::Migration[7.2]
  def change
    add_column :import_rows, :fee, :string
    add_column :import_rows, :split_data, :jsonb
  end
end
