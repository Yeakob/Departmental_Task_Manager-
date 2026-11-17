/**
 * softDelete plugin: adds deletedAt/deletedBy and filters deleted docs from
 * find/count/aggregate queries unless `.where({ deletedAt: ... })` or
 * option `withDeleted: true` is set.
 */
export function softDelete(schema) {
  schema.add({
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: schema.constructor.Types.ObjectId, ref: 'User', default: null },
  });

  const excludeDeleted = function () {
    if (this.getOptions().withDeleted) return;
    const filter = this.getFilter();
    if (!('deletedAt' in filter)) this.where({ deletedAt: null });
  };

  for (const hook of ['find', 'findOne', 'findOneAndUpdate', 'countDocuments', 'updateMany', 'updateOne']) {
    schema.pre(hook, excludeDeleted);
  }

  schema.pre('aggregate', function () {
    if (this.options?.withDeleted) return;
    this.pipeline().unshift({ $match: { deletedAt: null } });
  });

  schema.methods.softDelete = function (userId) {
    this.deletedAt = new Date();
    this.deletedBy = userId || null;
    return this.save();
  };
  schema.methods.restore = function () {
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };
}

export const toJSONClean = {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.passwordHash;
    delete ret.refreshTokens;
    return ret;
  },
};
