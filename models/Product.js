const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  price: { type: String, required: true },
  description: { type: String },
  specs: { type: String },
  category: { type: String, required: true },
  image: { type: String },
  gallery: [{ type: String }],
  stock: { type: Number, default: 0 },
  variants: [{
    size: { type: String, required: true },
    color: { type: String, required: true },
    stock: { type: Number, default: 0 },
    image: { type: String }
  }],
  // Logistics for Skydropx
  weight: { type: Number, default: 1 }, // in kg
  height: { type: Number, default: 10 }, // in cm
  width: { type: Number, default: 10 }, // in cm
  length: { type: Number, default: 10 }, // in cm
  isOnSale: { type: Boolean, default: false },
  originalPrice: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
