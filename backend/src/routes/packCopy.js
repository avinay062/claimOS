const express = require('express');
const router = express.Router();
const { PackCopy, PACKAGING_LEVELS, PANELS, PACK_COPY_STATUSES } = require('../models/PackCopy');
const Claim = require('../models/Claim');
const { protect, authorize } = require('../middleware/auth');
const { log } = require('../services/auditService');

router.use(protect);

const TRANSITIONS = {
  draft: ['in_review'],
  in_review: ['approved', 'draft'],
  approved: ['published', 'withdrawn'],
  published: ['withdrawn'],
  withdrawn: [],
};

// GET all pack copies
router.get('/', async (req, res) => {
  try {
    const { product, isGlobal, locationCode, status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (product) query.product = product;
    if (isGlobal !== undefined) query.isGlobal = isGlobal === 'true';
    if (locationCode) query.locationCode = locationCode.toUpperCase();
    if (status) query.status = status;

    const [data, total] = await Promise.all([
      PackCopy.find(query)
        .populate('product', 'name sku')
        .populate('createdBy', 'name')
        .populate('globalPackCopyId', 'name')
        .sort('-updatedAt')
        .skip((page - 1) * limit).limit(Number(limit)),
      PackCopy.countDocuments(query),
    ]);
    res.json({ data, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single pack copy with populated elements
router.get('/:id', async (req, res) => {
  try {
    const pc = await PackCopy.findById(req.params.id)
      .populate('product', 'name sku category')
      .populate('createdBy lastModifiedBy', 'name email')
      .populate('globalPackCopyId', 'name packagingLevel')
      .populate('elements.claimId', 'title status');
    if (!pc) return res.status(404).json({ message: 'Pack copy not found' });
    res.json(pc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create pack copy (global or local)
router.post('/', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const { name, product, packagingLevel, panels, isGlobal, locationCode, locale, globalPackCopyId, elements, notes } = req.body;

    if (!isGlobal && !globalPackCopyId) {
      return res.status(400).json({ message: 'Local pack copies must reference a global master' });
    }

    const pc = await PackCopy.create({
      name, product, packagingLevel, panels: panels || ['front', 'back'],
      isGlobal: isGlobal !== false,
      locationCode: locationCode?.toUpperCase(),
      locale, globalPackCopyId,
      elements: elements || [],
      notes,
      createdBy: req.user._id,
    });

    await log({ userId: req.user._id, action: 'CREATE', entity: 'PackCopy', entityId: pc._id, req });
    res.status(201).json(pc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST generate local pack copy from global master
router.post('/:id/generate-local', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const { locationCode, locale, name } = req.body;
    const master = await PackCopy.findById(req.params.id);
    if (!master) return res.status(404).json({ message: 'Master pack copy not found' });
    if (!master.isGlobal) return res.status(400).json({ message: 'Source must be a global pack copy' });

    // Check for existing
    const existing = await PackCopy.findOne({
      globalPackCopyId: master._id, locationCode: locationCode.toUpperCase(), locale
    });
    if (existing) return res.status(409).json({ message: 'Local copy already exists for this location/locale', existing });

    // Clone elements and attach locale translations if available
    const localElements = master.elements.map(el => ({
      ...el.toObject(),
      freeText: el.translations?.get(locale) || el.freeText || '',
      _id: undefined,
    }));

    const localPc = await PackCopy.create({
      name: name || `${master.name} — ${locationCode}`,
      product: master.product,
      packagingLevel: master.packagingLevel,
      panels: master.panels,
      isGlobal: false,
      locationCode: locationCode.toUpperCase(),
      locale,
      globalPackCopyId: master._id,
      elements: localElements,
      createdBy: req.user._id,
    });

    await log({ userId: req.user._id, action: 'GENERATE_LOCAL', entity: 'PackCopy', entityId: localPc._id, changes: { from: master._id, locationCode, locale }, req });
    res.status(201).json(localPc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update pack copy (edit elements, panels, notes)
router.put('/:id', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const allowed = ['name', 'panels', 'elements', 'notes', 'packagingLevel'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    update.lastModifiedBy = req.user._id;

    const pc = await PackCopy.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate('elements.claimId', 'title status');
    if (!pc) return res.status(404).json({ message: 'Not found' });

    await log({ userId: req.user._id, action: 'UPDATE', entity: 'PackCopy', entityId: pc._id, changes: update, req });
    res.json(pc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST add element to pack copy
router.post('/:id/elements', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const pc = await PackCopy.findById(req.params.id);
    if (!pc) return res.status(404).json({ message: 'Not found' });

    const { claimId, elementType, freeText, panel, position, specialInstructions, isRequired } = req.body;
    if (!panel) return res.status(400).json({ message: 'Panel is required' });

    // Validate claim if provided
    if (claimId) {
      const claim = await Claim.findById(claimId);
      if (!claim) return res.status(404).json({ message: 'Claim not found' });
      if (claim.status !== 'Approved') return res.status(400).json({ message: 'Only Approved claims can be linked to pack copy' });
    }

    pc.elements.push({ claimId, elementType: elementType || 'claim', freeText, panel, position: position || pc.elements.length, specialInstructions, isRequired });
    pc.lastModifiedBy = req.user._id;
    await pc.save();
    res.json(pc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE element from pack copy
router.delete('/:id/elements/:elementId', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const pc = await PackCopy.findById(req.params.id);
    if (!pc) return res.status(404).json({ message: 'Not found' });
    pc.elements = pc.elements.filter(el => el._id.toString() !== req.params.elementId);
    pc.lastModifiedBy = req.user._id;
    await pc.save();
    res.json({ message: 'Element removed', pc });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST add/update translation for an element
router.put('/:id/elements/:elementId/translation', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const { locale, text } = req.body;
    if (!locale || !text) return res.status(400).json({ message: 'locale and text required' });
    const pc = await PackCopy.findById(req.params.id);
    if (!pc) return res.status(404).json({ message: 'Not found' });
    const el = pc.elements.id(req.params.elementId);
    if (!el) return res.status(404).json({ message: 'Element not found' });
    el.translations.set(locale, text);
    pc.lastModifiedBy = req.user._id;
    await pc.save();
    res.json(pc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST check localization completeness
router.post('/:id/check-completeness', async (req, res) => {
  try {
    const { locales } = req.body; // e.g. ['fr-FR', 'de-DE']
    const pc = await PackCopy.findById(req.params.id);
    if (!pc) return res.status(404).json({ message: 'Not found' });

    const missing = [];
    for (const el of pc.elements) {
      for (const locale of (locales || [])) {
        const hasTranslation = el.translations?.get(locale) || (pc.locale === locale && el.freeText);
        if (!hasTranslation && el.elementType === 'claim') {
          missing.push({ elementId: el._id, panel: el.panel, locale, claimId: el.claimId });
        }
      }
    }

    const isComplete = missing.length === 0;
    // Persist computed missing localizations
    pc.missingLocalizations = missing.map(m => m.elementId?.toString());
    await pc.save();

    res.json({ isComplete, missing, totalElements: pc.elements.length, missingCount: missing.length });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST lifecycle transition
router.post('/:id/transition', authorize('admin', 'brand_manager', 'regulatory_approver'), async (req, res) => {
  try {
    const { to, comment } = req.body;
    const pc = await PackCopy.findById(req.params.id);
    if (!pc) return res.status(404).json({ message: 'Not found' });
    if (!TRANSITIONS[pc.status]?.includes(to)) {
      return res.status(400).json({ message: `Cannot transition from '${pc.status}' to '${to}'` });
    }
    pc.statusHistory.push({ from: pc.status, to, by: req.user._id, comment });
    pc.status = to;
    pc.lastModifiedBy = req.user._id;
    await pc.save();
    await log({ userId: req.user._id, action: 'TRANSITION', entity: 'PackCopy', entityId: pc._id, changes: { to, comment }, req });
    res.json(pc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET list of local copies derived from a global master
router.get('/:id/local-copies', async (req, res) => {
  try {
    const copies = await PackCopy.find({ globalPackCopyId: req.params.id })
      .populate('createdBy', 'name')
      .sort('locationCode');
    res.json({ data: copies, total: copies.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const pc = await PackCopy.findByIdAndDelete(req.params.id);
    if (!pc) return res.status(404).json({ message: 'Not found' });
    // Also delete all local copies derived from this global
    if (pc.isGlobal) await PackCopy.deleteMany({ globalPackCopyId: req.params.id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
