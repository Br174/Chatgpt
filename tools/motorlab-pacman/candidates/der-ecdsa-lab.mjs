// LAB-only: strict DER ECDSA signature to WebCrypto P1363 conversion.
export function derEcdsaToP1363(input) {
  if (!(input instanceof Uint8Array) || input.length < 8 || input.length > 72 || input[0] !== 0x30 || input[1] !== input.length - 2) throw new Error('INVALID_DER_ECDSA');
  let offset = 2;
  const readInteger = () => {
    if (input[offset++] !== 0x02) throw new Error('INVALID_DER_ECDSA');
    const length = input[offset++];
    if (!Number.isInteger(length) || length < 1 || length > 33 || offset + length > input.length) throw new Error('INVALID_DER_ECDSA');
    const value = input.subarray(offset, offset + length);
    offset += length;
    if (value[0] & 0x80) throw new Error('INVALID_DER_ECDSA');
    if (length > 1 && value[0] === 0 && !(value[1] & 0x80)) throw new Error('INVALID_DER_ECDSA');
    const unsigned = length === 33 ? (value[0] === 0 ? value.subarray(1) : null) : value;
    if (!unsigned || unsigned.length > 32) throw new Error('INVALID_DER_ECDSA');
    const result = new Uint8Array(32);
    result.set(unsigned, 32 - unsigned.length);
    return result;
  };
  const r = readInteger();
  const s = readInteger();
  if (offset !== input.length) throw new Error('INVALID_DER_ECDSA');
  const signature = new Uint8Array(64);
  signature.set(r, 0);
  signature.set(s, 32);
  return signature;
}
