import Counter from '../models/Counter.js';

/** Generates human-friendly sequential IDs like DEPT-0042, scoped per department + prefix. */
export async function nextSequence(scope, prefix, session = null) {
  const doc = await Counter.findOneAndUpdate(
    { scope },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  );
  return `${prefix}-${String(doc.seq).padStart(4, '0')}`;
}
