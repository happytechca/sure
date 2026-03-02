class AddArchivedToCategories < ActiveRecord::Migration[7.0]
  def change
    add_column :categories, :archived, :boolean, default: false, null: false
    add_index :categories, :archived
  end
end
