// Number formatting based on user settings.

export function formatNumber(value, settings) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'number') return String(value);
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';

  const fmt = (settings && settings.numberFormat) || {
    useGrouping: true, maxDecimals: 8, trimTrailingZeros: true,
  };

  // Round to maxDecimals first
  const rounded = Number(value.toFixed(fmt.maxDecimals));

  let str;
  if (fmt.trimTrailingZeros) {
    // Use toFixed then strip trailing zeros and lonely decimal point
    str = rounded.toFixed(fmt.maxDecimals);
    if (str.indexOf('.') >= 0) {
      str = str.replace(/0+$/, '').replace(/\.$/, '');
    }
  } else {
    str = rounded.toFixed(fmt.maxDecimals);
  }

  if (fmt.useGrouping) {
    const negative = str.startsWith('-');
    if (negative) str = str.slice(1);
    const dot = str.indexOf('.');
    const intPart = dot >= 0 ? str.slice(0, dot) : str;
    const fracPart = dot >= 0 ? str.slice(dot) : '';
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    str = (negative ? '-' : '') + grouped + fracPart;
  }

  return str;
}
