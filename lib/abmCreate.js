function computeBarcodeCheckDigit(code) {
  const value = String(code || '');
  if (value.length !== 12) return null;
  const padded = `0000000000000000${value}`.slice(-17);
  let total = 0;
  let weight = 3;
  for (let i = 0; i <= 17; i += 1) {
    const digit = Number(padded.charAt(i)) || 0;
    total += digit * weight;
    weight = 4 - weight;
  }
  let digito = total % 10;
  if (digito !== 0) digito = 10 - digito;
  return digito;
}

function buildArticuloCodigo(baseDigits) {
  const base = String(baseDigits || '').replace(/\D/g, '');
  if (base.length !== 8) return null;
  const codigoBase = `7798${base}`;
  const digito = computeBarcodeCheckDigit(codigoBase);
  if (digito === null) return null;
  return `${codigoBase}${digito}`;
}

module.exports = {
  computeBarcodeCheckDigit,
  buildArticuloCodigo,
};
