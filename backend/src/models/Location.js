const mongoose = require('mongoose');

/**
 * Location represents a country or region with its supported languages.
 * Used by Local Adaptations to know which locales are valid per country.
 */
const locationSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    // ISO 3166-1 alpha-2 country code e.g. 'US', 'FR', 'DE'
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  region: {
    type: String,
    trim: true,
    // e.g. 'Europe', 'North America', 'APAC'
  },
  languages: [
    {
      locale: { type: String, required: true }, // e.g. 'fr-FR', 'en-US'
      label:  { type: String, required: true }, // e.g. 'French', 'English (US)'
      isDefault: { type: Boolean, default: false },
    }
  ],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

locationSchema.index({ code: 1 });
locationSchema.index({ region: 1 });
locationSchema.index({ name: 'text' });

// Seed data helper — call once at startup if collection is empty
locationSchema.statics.seedDefaults = async function () {
  const count = await this.countDocuments();
  if (count > 0) return;

  const defaults = [
    { code: 'US', name: 'United States', region: 'North America', languages: [{ locale: 'en-US', label: 'English (US)', isDefault: true }] },
    { code: 'GB', name: 'United Kingdom', region: 'Europe', languages: [{ locale: 'en-GB', label: 'English (UK)', isDefault: true }] },
    { code: 'FR', name: 'France', region: 'Europe', languages: [{ locale: 'fr-FR', label: 'French', isDefault: true }, { locale: 'en-GB', label: 'English (UK)' }] },
    { code: 'DE', name: 'Germany', region: 'Europe', languages: [{ locale: 'de-DE', label: 'German', isDefault: true }] },
    { code: 'ES', name: 'Spain', region: 'Europe', languages: [{ locale: 'es-ES', label: 'Spanish', isDefault: true }] },
    { code: 'IT', name: 'Italy', region: 'Europe', languages: [{ locale: 'it-IT', label: 'Italian', isDefault: true }] },
    { code: 'NL', name: 'Netherlands', region: 'Europe', languages: [{ locale: 'nl-NL', label: 'Dutch', isDefault: true }] },
    { code: 'PL', name: 'Poland', region: 'Europe', languages: [{ locale: 'pl-PL', label: 'Polish', isDefault: true }] },
    { code: 'SE', name: 'Sweden', region: 'Europe', languages: [{ locale: 'sv-SE', label: 'Swedish', isDefault: true }] },
    { code: 'AU', name: 'Australia', region: 'APAC', languages: [{ locale: 'en-AU', label: 'English (AU)', isDefault: true }] },
    { code: 'JP', name: 'Japan', region: 'APAC', languages: [{ locale: 'ja-JP', label: 'Japanese', isDefault: true }] },
    { code: 'CN', name: 'China', region: 'APAC', languages: [{ locale: 'zh-CN', label: 'Simplified Chinese', isDefault: true }] },
    { code: 'IN', name: 'India', region: 'APAC', languages: [{ locale: 'en-IN', label: 'English (IN)', isDefault: true }, { locale: 'hi-IN', label: 'Hindi' }] },
    { code: 'BR', name: 'Brazil', region: 'Latin America', languages: [{ locale: 'pt-BR', label: 'Portuguese (BR)', isDefault: true }] },
    { code: 'MX', name: 'Mexico', region: 'Latin America', languages: [{ locale: 'es-MX', label: 'Spanish (MX)', isDefault: true }] },
    { code: 'CA', name: 'Canada', region: 'North America', languages: [{ locale: 'en-CA', label: 'English (CA)', isDefault: true }, { locale: 'fr-CA', label: 'French (CA)' }] },
    { code: 'ZA', name: 'South Africa', region: 'Africa', languages: [{ locale: 'en-ZA', label: 'English (ZA)', isDefault: true }] },
    { code: 'NG', name: 'Nigeria', region: 'Africa', languages: [{ locale: 'en-NG', label: 'English (NG)', isDefault: true }] },
    { code: 'AE', name: 'UAE', region: 'Middle East', languages: [{ locale: 'ar-AE', label: 'Arabic', isDefault: true }, { locale: 'en-AE', label: 'English (AE)' }] },
    { code: 'SA', name: 'Saudi Arabia', region: 'Middle East', languages: [{ locale: 'ar-SA', label: 'Arabic (SA)', isDefault: true }] },
  ];

  await this.insertMany(defaults);
  console.log('✅ Location seed data inserted');
};

const Location = mongoose.model('Location', locationSchema);
module.exports = { Location };
