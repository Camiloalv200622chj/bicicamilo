const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  idNumber: { type: String },
  address: { type: String, required: true },
  city: { type: String, default: 'Villanueva, Santander' },
  notes: { type: String },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    title: { type: String },
    price: { type: Number },
    quantity: { type: Number, default: 1 },
    size: { type: String },
    color: { type: String }
  }],
  total: { type: Number, required: true },
  status: { type: String, default: 'Pendiente' },
  external_reference: { type: String }, // Links to Mercado Pago Pref
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
