class TransactionSplitsController < ApplicationController
  before_action :set_entry

  def new
    @categories = Current.family.categories.alphabetically
    @tags = Current.family.tags.alphabetically
  end

  private
    def set_entry
      @entry = Current.family.entries.find(params[:transaction_id])
    end
end
