const mongoose = require('mongoose');

const SlideSchema = new mongoose.Schema({
  image: { type: String, default: '' },
  title: { type: String, default: '' },
  badge: { type: String, default: '' },
  description: { type: String, default: '' }
});

const settingsSchema = new mongoose.Schema({
  heroSlides: { 
    type: [SlideSchema], 
    default: [
      { 
        image: '/hero/road.png', 
        title: 'INGENIERÍA DE Alto RENDIMIENTO.', 
        badge: 'COLECCIÓN CORE 2026', 
        description: 'Experimenta la cima del diseño de bicicletas. Carbón ligero, precisión quirúrgica y una estética inigualable para el ciclista exigente.' 
      },
      { 
        image: '/hero/mountain.png', 
        title: 'AVENTURA SIN LÍMITES.', 
        badge: 'ENDURO PRO 2026', 
        description: 'Domina cualquier terreno con nuestra nuestra linea de montaña. Suspensión avanzada y durabilidad extrema.' 
      },
      { 
        image: '/hero/gravel.png', 
        title: 'EXPLORA NUEVOS CAMINOS.', 
        badge: 'GRAVEL SERIE X', 
        description: 'La versatilidad definitiva. Rapidez en asfalto y control total en grava. Tu próxima aventura comienza aquí.' 
      }
    ]
  },
  megaMenuImage: { type: String, default: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&q=80&w=1000' },
  megaMenuTitle: { type: String, default: 'S-WORKS TARMAC SL8' },
  megaMenuSubtitle: { type: String, default: 'NUEVO' },
  megaMenuDescription: { type: String, default: 'La culminación de la velocidad.' },
  aboutUsTitle: { type: String, default: 'INGENIERÍA DE EXCELENCIA' },
  aboutUsContent: { type: String, default: 'En Bicicamilo, no solo fabricamos bicicletas de alto rendimiento; esculpimos instrumentos de precisión para aquellos que ven el camino como un lienzo de posibilidades infinitas.' },
  aboutUsImage: { type: String, default: 'https://images.unsplash.com/photo-1511994298241-608e28f14f66?auto=format&fit=crop&q=80&w=1000' }
});

module.exports = mongoose.model('Settings', settingsSchema);
