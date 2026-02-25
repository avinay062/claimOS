const express = require('express');
const router = express.Router();
const Substantiation = require('../models/Substantiation');
const ClaimSubstantiation = require('../models/ClaimSubstantiation');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { log } = require('../services/auditService');

router.use(protect);

const TRANSITIONS = {
  Draft: ['Under Review'],
  'Under Review': ['Approved', 'Draft'],
  Approved: ['Expired'],
  Expired: [],
};

router.get('/', async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    const [data, total] = await Promise.all([
      Substantiation.find(query).populate('createdBy', 'name').sort('-updatedAt')
        .skip((page - 1) * limit).limit(Number(limit)),
      Substantiation.countDocuments(query),
    ]);
    res.json({ data, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/by-claim/:claimId', async (req, res) => {
  try {
    const links = await ClaimSubstantiation.find({ claim: req.params.claimId })
      .populate('substantiation');
    res.json(links.map(l => l.substantiation));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const s = await Substantiation.findById(req.params.id).populate('createdBy', 'name email');
    if (!s) return res.status(404).json({ message: 'Not found' });
    const links = await ClaimSubstantiation.find({ substantiation: s._id }).populate('claim', 'title status');
    res.json({ ...s.toObject(), linkedClaims: links.map(l => l.claim) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const s = await Substantiation.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(s);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const s = await Substantiation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!s) return res.status(404).json({ message: 'Not found' });
    res.json(s);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/upload', authorize('admin', 'brand_manager'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const s = await Substantiation.findById(req.params.id);
    if (!s) return res.status(404).json({ message: 'Not found' });

    // Memory mode — store file metadata only (file data in req.file.buffer)
    s.file = {
      originalName: req.file.originalname,
      key: `memory-${Date.now()}-${req.file.originalname}`,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
    };
    await s.save();
    res.json({ message: 'File uploaded', file: s.file });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/download-url', async (req, res) => {
  try {
    const s = await Substantiation.findById(req.params.id);
    if (!s?.file?.key) return res.status(404).json({ message: 'No file attached' });
    // In dev mode, return a placeholder
    res.json({ url: `/dev/file/${s.file.key}`, expiresIn: 3600 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/transition', authorize('admin', 'brand_manager', 'regulatory_approver'), async (req, res) => {
  try {
    const { to } = req.body;
    const s = await Substantiation.findById(req.params.id);
    if (!s) return res.status(404).json({ message: 'Not found' });
    if (!TRANSITIONS[s.status]?.includes(to)) {
      return res.status(400).json({ message: `Cannot transition from ${s.status} to ${to}` });
    }
    s.status = to;
    await s.save();
    res.json(s);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/link-claims', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const { claimIds } = req.body;
    const ops = claimIds.map(claimId => ({
      updateOne: {
        filter: { claim: claimId, substantiation: req.params.id },
        update: { $setOnInsert: { claim: claimId, substantiation: req.params.id, linkedBy: req.user._id } },
        upsert: true,
      },
    }));
    await ClaimSubstantiation.bulkWrite(ops);
    res.json({ message: `Linked ${claimIds.length} claims` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id/unlink-claim/:claimId', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    await ClaimSubstantiation.deleteOne({ claim: req.params.claimId, substantiation: req.params.id });
    res.json({ message: 'Unlinked' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/bulk-link', authorize('admin', 'brand_manager'), async (req, res) => {
  try {
    const { substantiationId, claimIds } = req.body;
    const ops = claimIds.slice(0, 1000).map(claimId => ({
      updateOne: {
        filter: { claim: claimId, substantiation: substantiationId },
        update: { $setOnInsert: { claim: claimId, substantiation: substantiationId, linkedBy: req.user._id } },
        upsert: true,
      },
    }));
    const result = await ClaimSubstantiation.bulkWrite(ops);
    res.json({ linked: result.upsertedCount });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await Substantiation.findByIdAndDelete(req.params.id);
    await ClaimSubstantiation.deleteMany({ substantiation: req.params.id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
