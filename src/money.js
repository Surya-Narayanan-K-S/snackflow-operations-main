/**
 * Exact decimal & integer-paisa arithmetic utility for currency and GST.
 * Prevents floating point drift across financial transactions.
 */

export function toPaisa(rupees) {
  return Math.round((Number(rupees) + Number.EPSILON) * 100);
}

export function fromPaisa(paisa) {
  return Math.round(Number(paisa)) / 100;
}

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function round3(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

export function formatINR(rupees) {
  const rounded = round2(rupees);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

export function formatQty(qty, unit = '') {
  const num = Number(qty);
  const formatted = Number.isInteger(num) ? num.toString() : num.toFixed(2);
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Calculates Indian GST tax based on Place of Supply and Seller state.
 * Seller state is Tamil Nadu ('33').
 * Intra-state (Customer state == '33'): CGST (half) + SGST (half)
 * Inter-state (Customer state != '33'): IGST (full)
 */
export function calculateGST(taxableValue, gstRate, sellerStateCode = '33', customerStateCode = '33') {
  const taxablePaisa = toPaisa(taxableValue);
  const isInterState = String(sellerStateCode).trim() !== String(customerStateCode).trim();

  if (isInterState) {
    const igstPaisa = Math.round((taxablePaisa * gstRate) / 100);
    const totalPaisa = taxablePaisa + igstPaisa;
    return {
      taxableValue: fromPaisa(taxablePaisa),
      isInterState: true,
      gstRate,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: gstRate,
      igstAmount: fromPaisa(igstPaisa),
      totalTax: fromPaisa(igstPaisa),
      totalWithTax: fromPaisa(totalPaisa),
    };
  } else {
    const halfRate = gstRate / 2;
    const halfTaxPaisa = Math.round((taxablePaisa * halfRate) / 100);
    const totalTaxPaisa = halfTaxPaisa * 2;
    const totalPaisa = taxablePaisa + totalTaxPaisa;
    return {
      taxableValue: fromPaisa(taxablePaisa),
      isInterState: false,
      gstRate,
      cgstRate: halfRate,
      cgstAmount: fromPaisa(halfTaxPaisa),
      sgstRate: halfRate,
      sgstAmount: fromPaisa(halfTaxPaisa),
      igstRate: 0,
      igstAmount: 0,
      totalTax: fromPaisa(totalTaxPaisa),
      totalWithTax: fromPaisa(totalPaisa),
    };
  }
}

/**
 * Variance calculation with tolerance threshold
 */
export function calculateVariance(actual, standard, tolerancePercent = 3.0) {
  const act = Number(actual);
  const std = Number(standard);
  const diffQty = round3(act - std);

  if (std === 0) {
    return {
      diffQty,
      variancePercent: 0,
      isFlagged: false,
      direction: 'exact',
    };
  }

  const variancePercent = round2(((act - std) / std) * 100);
  const isFlagged = Math.abs(variancePercent) > tolerancePercent;
  const direction = diffQty > 0 ? 'excess' : diffQty < 0 ? 'saving' : 'exact';

  return {
    diffQty,
    variancePercent,
    isFlagged,
    direction,
  };
}

