const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  heroImage: { type: String, default: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&q=80&w=2070' },
  heroTitle: { type: String, default: 'INGENIERÍA DE Alto RENDIMIENTO.' },
  heroBadge: { type: String, default: 'COLECCIÓN CORE 2026' },
  heroDescription: { type: String, default: 'Experimenta la cima del diseño de bicicletas. Carbón ligero, precisión quirúrgica y una estética inigualable para el ciclista exigente.' }
});

module.exports = mongoose.model('Settings', settingsSchema);
