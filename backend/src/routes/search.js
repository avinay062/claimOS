const express = require('express');
const { Statement } = require('../models/Statement');
const { Claim } = require('../models/Claim');
const { Substantiation } = require('../models/Substantiation');
const { Project } = require('../models/Project');
const { LocalAdaptation } = require('../models/LocalAdaptation');
const { Product } = require('../models/Product');
const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(protect);

/**
 * ── GET /api/search?q=term&types=statements,claims&limit=10 ──
 *
 * Global search across all major object types.
 * Falls back to MongoDB $text index search if Atlas Search is not configured.
 * For Atlas Search, swap out the filter with a $search aggregation pipeline.
 */
router.get('/', asyncHandler(async (req, res) => {
  const { q, types, limit = 10 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters.' });
  }

  const searchTypes = types
    ? types.split(',').map(t => t.trim().toLowerCase())
    : ['statements', 'claims', 'substantiations', 'projects', 'products'];

  const maxPerType = Math.max(3, Math.min(parseInt(limit), 20));

  // Helper: safely run a text search
  const textSearch = async (Model, filter, select, populate = []) => {
    try {
      let q = Model.find({ $text: { $search: filter._q }, ...filter })
        .select(select)
        .limit(maxPerType);
      for (const p of populate) q = q.populate(p);
      return await q;
    } catch {
      return [];
    }
  };

  const results = {};

  const searchTerm = q.trim();

  if (searchTypes.includes('statements')) {
    results.statements = (await Statement.find(
      { $text: { $search: searchTerm } },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } }).select('name category status riskLevel').limit(maxPerType)).map(s => ({
      _id: s._id, type: 'statement', title: s.name, subtitle: s.category, status: s.status,
      url: `/statements/${s._id}`,
    }));
  }

  if (searchTypes.includes('claims')) {
    // Claims don't have text index directly — search via populated statement name
    const matchingStatements = await Statement.find({ $text: { $search: searchTerm } }).select('_id').limit(50);
    const statIds = matchingStatements.map(s => s._id);
    const claims = await Claim.find({ statementId: { $in: statIds } })
      .populate('statementId', 'name')
      .populate('productId', 'name brand')
      .limit(maxPerType);
    results.claims = claims.map(c => ({
      _id: c._id, type: 'claim',
      title: c.statementId?.name,
      subtitle: `${c.productId?.name}${c.productId?.brand ? ' · ' + c.productId.brand : ''}`,
      status: c.status, url: `/claims/${c._id}`,
    }));
  }

  if (searchTypes.includes('substantiations')) {
    const subs = await Substantiation.find(
      { $text: { $search: searchTerm } },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } }).select('title documentType status').limit(maxPerType);
    results.substantiations = subs.map(s => ({
      _id: s._id, type: 'substantiation', title: s.title, subtitle: s.documentType, status: s.status,
      url: `/substantiations/${s._id}`,
    }));
  }

  if (searchTypes.includes('projects')) {
    const projects = await Project.find(
      { $text: { $search: searchTerm } },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } }).select('name description status claimsCount').limit(maxPerType);
    results.projects = projects.map(p => ({
      _id: p._id, type: 'project', title: p.name, subtitle: p.description, status: p.status,
      url: `/projects/${p._id}`,
    }));
  }

  if (searchTypes.includes('products')) {
    const products = await Product.find(
      { $text: { $search: searchTerm } },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } }).select('name brand category claimsCount').limit(maxPerType);
    results.products = products.map(p => ({
      _id: p._id, type: 'product', title: p.name, subtitle: `${p.brand || ''} · ${p.category || ''}`, status: 'active',
      url: `/products`,
    }));
  }

  const totalHits = Object.values(results).reduce((acc, arr) => acc + arr.length, 0);

  res.json({ success: true, query: searchTerm, totalHits, results });
}));

/**
 * ── GET /api/search/claims ── (advanced claim search with filters)
 */
router.get('/claims', asyncHandler(async (req, res) => {
  const { q, status, riskRating, productId, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (status)     filter.status     = status;
  if (riskRating) filter.riskRating = riskRating;
  if (productId)  filter.productId  = productId;

  if (q) {
    const matchingStatements = await Statement.find({ $text: { $search: q } }).select('_id');
    filter.statementId = { $in: matchingStatements.map(s => s._id) };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [claims, total] = await Promise.all([
    Claim.find(filter)
      .skip(skip).limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .populate('statementId', 'name riskLevel highRiskWords')
      .populate('productId', 'name brand category'),
    Claim.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: claims,
    pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) },
  });
}));

module.exports = router;
