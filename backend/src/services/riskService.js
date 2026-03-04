const { RiskConfig, DEFAULT_RISK_WORDS } = require('../models/RiskConfig');

/**
 * Analyse text for high-risk words and return a risk assessment.
 * Seeds defaults on first call if DB is empty.
 */
const analyseRisk = async (text) => {
  if (!text) return { riskLevel: 'low', flaggedWords: [], riskScore: 0 };

  let configs = await RiskConfig.find({ isActive: true }).lean();
  if (configs.length === 0) {
    await RiskConfig.insertMany(DEFAULT_RISK_WORDS.map(w => ({ ...w })));
    configs = await RiskConfig.find({ isActive: true }).lean();
  }

  const lower = text.toLowerCase();
  const flagged = configs.filter(c => lower.includes(c.word));

  if (flagged.length === 0) return { riskLevel: 'low', flaggedWords: [], riskScore: 0 };

  const scoreMap = { low: 1, medium: 3, high: 7 };
  const riskScore = flagged.reduce((sum, w) => sum + scoreMap[w.riskLevel], 0);

  let riskLevel = 'low';
  if (riskScore >= 7) riskLevel = 'high';
  else if (riskScore >= 3) riskLevel = 'medium';

  return {
    riskLevel,
    flaggedWords: flagged.map(w => ({ word: w.word, riskLevel: w.riskLevel, category: w.category })),
    riskScore,
  };
};

module.exports = { analyseRisk };
