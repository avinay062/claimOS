const mongoose = require('mongoose');

const PACKAGING_LEVELS = ['primary', 'secondary', 'tertiary'];
const PANELS = ['front', 'back', 'left', 'right', 'top', 'bottom', 'inner'];
const PACK_COPY_STATUSES = ['draft', 'in_review', 'approved', 'published', 'withdrawn'];

const packElementSchema = new mongoose.Schema({
  claimId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Claim' },
  elementType: { type: String, enum: ['claim', 'text', 'legal', 'ingredient', 'warning'], default: 'claim' },
  freeText:  { type: String }, // used when elementType !== 'claim'
  panel:     { type: String, enum: PANELS, required: true },
  position:  { type: Number, default: 0 },  // ordering within panel
  specialInstructions: { type: String },
  // per-locale translation cache: { 'fr-FR': 'translated text' }
  translations: { type: Map, of: String, default: {} },
  isRequired:  { type: Boolean, default: false },
}, { _id: true });

const packHistorySchema = new mongoose.Schema({
  from: String,
  to:   String,
  by:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  at:   { type: Date, default: Date.now },
  comment: String,
}, { _id: false });

const packCopySchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },
  product:         { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  isGlobal:        { type: Boolean, default: true },
  locationCode:    { type: String, uppercase: true },   // null if global master
  locale:          { type: String },                     // e.g. 'fr-FR'
  globalPackCopyId:{ type: mongoose.Schema.Types.ObjectId, ref: 'PackCopy' }, // source master
  packagingLevel:  { type: String, enum: PACKAGING_LEVELS, required: true },
  panels:          { type: [String], enum: PANELS, default: ['front', 'back'] },
  elements:        [packElementSchema],
  status:          { type: String, enum: PACK_COPY_STATUSES, default: 'draft' },
  statusHistory:   [packHistorySchema],
  missingLocalizations: [String], // computed: element IDs missing translations
  notes:           { type: String },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastModifiedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

packCopySchema.index({ product: 1, isGlobal: 1 });
packCopySchema.index({ globalPackCopyId: 1 });
packCopySchema.index({ locationCode: 1, status: 1 });

const PackCopy = mongoose.model('PackCopy', packCopySchema);
module.exports = { PackCopy, PACKAGING_LEVELS, PANELS, PACK_COPY_STATUSES };
