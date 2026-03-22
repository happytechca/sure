import { Controller } from "@hotwired/stimulus";

// Manages the trade detail edit form: recalculates totals, shows a
// recalculation picker when the total is edited directly, and shows
// Save / Discard buttons only when the form is dirty.
//
// Targets price, fee, and total are wrapper divs around money_field
// partials — we querySelector for the actual <input> inside them.
// Targets qty, date, and nature are plain form inputs.
export default class extends Controller {
  static targets = [
    "date",
    "nature",
    "qty",
    "price",
    "fee",
    "total",
    "picker",
    "actions",
  ];

  connect() {
    this.#saveInitialValues();
  }

  // When a non-numeric field (date, nature) changes
  inputChanged() {
    this.#updateDirtyState();
  }

  // When qty, price, or fee changes → recalculate total
  fieldChanged() {
    const total = this.#qty * this.#price + this.#fee;
    this.#totalInput.value = Math.round(total * 100) / 100;
    this.#updateDirtyState();
  }

  // When total is edited directly → show the recalculation picker
  totalChanged() {
    this.pickerTarget.classList.remove("hidden");
    this.#updateDirtyState();
  }

  // User picks which field to recalculate → update that field, hide picker
  select(event) {
    const field = event.target.value;
    const total = this.#total;
    const qty = this.#qty;
    const price = this.#price;
    const fee = this.#fee;

    switch (field) {
      case "price": {
        const newPrice = qty === 0 ? 0 : (total - fee) / qty;
        this.#priceInput.value = Math.round(newPrice * 1e10) / 1e10;
        break;
      }
      case "qty": {
        const newQty = price === 0 ? 0 : (total - fee) / price;
        this.qtyTarget.value = Math.round(newQty * 1e4) / 1e4;
        break;
      }
      case "fee": {
        const newFee = total - qty * price;
        this.#feeInput.value = Math.round(newFee * 100) / 100;
        break;
      }
    }

    this.pickerTarget.classList.add("hidden");
    this.#updateDirtyState();
  }

  // Restore all fields to their saved initial values
  discard() {
    if (this.hasDateTarget) this.dateTarget.value = this.initialDate;
    if (this.hasNatureTarget) this.natureTarget.value = this.initialNature;
    this.qtyTarget.value = this.initialQty;
    this.#priceInput.value = this.initialPrice;
    this.#feeInput.value = this.initialFee;
    this.#totalInput.value = this.initialTotal;
    this.pickerTarget.classList.add("hidden");
    this.#updateDirtyState();
  }

  // --- Private helpers ---------------------------------------------------

  get #priceInput() {
    return this.priceTarget.querySelector("input[type='number']");
  }

  get #feeInput() {
    return this.feeTarget.querySelector("input[type='number']");
  }

  get #totalInput() {
    return this.totalTarget.querySelector("input[type='number']");
  }

  get #qty() {
    return parseFloat(this.qtyTarget.value) || 0;
  }

  get #price() {
    return parseFloat(this.#priceInput.value) || 0;
  }

  get #fee() {
    return parseFloat(this.#feeInput.value) || 0;
  }

  get #total() {
    return parseFloat(this.#totalInput.value) || 0;
  }

  get #isDirty() {
    return (
      (this.hasDateTarget && this.dateTarget.value !== this.initialDate) ||
      (this.hasNatureTarget &&
        this.natureTarget.value !== this.initialNature) ||
      this.qtyTarget.value !== this.initialQty ||
      this.#priceInput.value !== this.initialPrice ||
      this.#feeInput.value !== this.initialFee ||
      this.#totalInput.value !== this.initialTotal
    );
  }

  #updateDirtyState() {
    if (this.hasActionsTarget) {
      this.actionsTarget.classList.toggle("hidden", !this.#isDirty);
    }
  }

  #saveInitialValues() {
    this.initialDate = this.hasDateTarget ? this.dateTarget.value : "";
    this.initialNature = this.hasNatureTarget ? this.natureTarget.value : "";
    this.initialQty = this.qtyTarget.value;
    this.initialPrice = this.#priceInput.value;
    this.initialFee = this.#feeInput.value;
    this.initialTotal = this.#totalInput.value;
  }
}
