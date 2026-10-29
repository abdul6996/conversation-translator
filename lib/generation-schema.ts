// Large nested min/max constraints explode Gemini's constrained-decoding state
// space. Keep the output shape simple; the original Zod schema still enforces
// all lengths and array bounds on the returned response server-side.
const validationOnly = new Set(['$schema', 'minLength', 'maxLength', 'minItems', 'maxItems', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'pattern', 'format']);
export function generationSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(generationSchema);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !validationOnly.has(key)).map(([key, child]) => [key, generationSchema(child)]));
  }
  return value;
}
