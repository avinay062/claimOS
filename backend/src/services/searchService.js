const Statement = require('../models/Statement');
const Claim = require('../models/Claim');
const Substantiation = require('../models/Substantiation');
const { Project } = require('../models/Project');
const { LocalAdaptation } = require('../models/LocalAdaptation');
const Product = require('../models/Product');

/**
 * Global search across all entity types using MongoDB $text index.
 * Returns results grouped by type with highlights.
 */
const globalSearch = async ({ q, types, limit = 10 }) => {
  if (!q || q.trim().length < 2) return { results: [], total: 0 };

  const searchTypes = types
    ? types.split(',').map(t => t.trim().toLowerCase())
    : ['statements', 'claims', 'substantiations', 'projects', 'products'];

  const lim = Math.min(Number(limit), 50);
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const searches = [];

  if (searchTypes.includes('statements')) {
    searches.push(
      Statement.find({ $or: [{ text: regex }, { category: regex }, { tags: regex }] })
        .select('text category status tags')
        .limit(lim)
        .lean()
        .then(r => r.map(d => ({ type: 'statement', id: d._id, title: d.text.slice(0, 80), subtitle: d.category, status: d.status, data: d })))
    );
  }

  if (searchTypes.includes('claims')) {
    searches.push(
      Claim.find({ title: regex })
        .populate('product', 'name')
        .select('title status product')
        .limit(lim)
        .lean()
        .then(r => r.map(d => ({ type: 'claim', id: d._id, title: d.title, subtitle: d.product?.name, status: d.status, data: d })))
    );
  }

  if (searchTypes.includes('substantiations')) {
    searches.push(
      Substantiation.find({ $or: [{ title: regex }, { description: regex }] })
        .select('title type status')
        .limit(lim)
        .lean()
        .then(r => r.map(d => ({ type: 'substantiation', id: d._id, title: d.title, subtitle: d.type, status: d.status, data: d })))
    );
  }

  if (searchTypes.includes('projects')) {
    searches.push(
      Project.find({ $or: [{ name: regex }, { description: regex }] })
        .select('name status description')
        .limit(lim)
        .lean()
        .then(r => r.map(d => ({ type: 'project', id: d._id, title: d.name, subtitle: d.description?.slice(0, 60), status: d.status, data: d })))
    );
  }

  if (searchTypes.includes('products')) {
    searches.push(
      Product.find({ $or: [{ name: regex }, { category: regex }, { sku: regex }] })
        .select('name category sku isActive')
        .limit(lim)
        .lean()
        .then(r => r.map(d => ({ type: 'product', id: d._id, title: d.name, subtitle: d.category, status: d.isActive ? 'active' : 'inactive', data: d })))
    );
  }

  const allResults = await Promise.all(searches);
  const flat = allResults.flat().slice(0, lim * 2);

  return { results: flat, total: flat.length };
};

module.exports = { globalSearch };
