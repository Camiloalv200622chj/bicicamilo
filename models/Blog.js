const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  image: { type: String, required: true },
  summary: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: String, default: 'Bicicamilo Official' },
  category: { type: String, default: 'Noticias' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Blog', blogSchema);
