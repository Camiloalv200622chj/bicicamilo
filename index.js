require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const Product = require('./models/Product');
const Category = require('./models/Category');
const Order = require('./models/Order');
const Settings = require('./models/Settings');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3001;

const JWT_SECRET = process.env.JWT_SECRET || 'bicicamilo_secret_key_2026';

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer Storage Configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'bicicamilo/products',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

const upload = multer({ storage: storage });

// --- PAYMENT CONFIG (MERCADO PAGO) ---
const mpClient = new MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN 
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error de conexión:', err));

// --- AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- UPLOAD ROUTE ---
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    res.json({ secure_url: req.file.path });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- AUTH ROUTES ---
app.post('/api/auth/setup', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ message: 'User already exists' });
    const newUser = new User({ username, password });
    await newUser.save();
    res.json({ message: 'Admin user created successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, username: user.username });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- SETTINGS ROUTES ---
app.get('/api/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate({}, req.body, { new: true, upsert: true });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CATEGORY ROUTES ---
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
  try {
    const newCategory = new Category(req.body);
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- PRODUCT ROUTES ---
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedProduct);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- PAYMENT ROUTES (MERCADO PAGO) ---
app.post('/api/payments/create-preference', async (req, res) => {
  try {
    const { items, customer } = req.body;
    
    if (!customer || !items || items.length === 0) {
      return res.status(400).json({ error: 'Faltan datos de envío o productos' });
    }

    // 1. Create Order in Database (PENDIENTE)
    const orderItems = items.map(item => ({
      productId: item._id,
      title: item.title,
      // Ensure price is clean number
      price: parseFloat(item.price.toString().replace(/[^0-9.]/g, '')),
      quantity: item.quantity || 1
    }));

    const total = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const newOrder = new Order({
      customerName: customer.name,
      email: customer.email,
      phone: customer.phone,
      idNumber: customer.idNumber,
      address: customer.address,
      city: customer.city,
      notes: customer.notes,
      items: orderItems,
      total: total,
      status: 'Pendiente'
    });

    await newOrder.save();

    // 2. Create Mercado Pago Preference
    const preferenceItems = orderItems.map(item => ({
      title: item.title,
      unit_price: item.price,
      quantity: item.quantity,
      currency_id: 'COP'
    }));

    const preference = new Preference(mpClient);
    const result = await preference.create({
      body: {
        items: preferenceItems,
        payer: {
          name: customer.name,
          email: customer.email,
          phone: { number: customer.phone }
        },
        back_urls: {
          success: `${process.env.RENDER_EXTERNAL_URL || process.env.FRONTEND_URL || 'http://localhost:5173/'}`,
          failure: `${process.env.RENDER_EXTERNAL_URL || process.env.FRONTEND_URL || 'http://localhost:5173/'}/cart`,
          pending: `${process.env.RENDER_EXTERNAL_URL || process.env.FRONTEND_URL || 'http://localhost:5173/'}`
        },
        auto_return: 'approved',
        external_reference: newOrder._id.toString(), // Link back to Order
      }
    });

    res.json({ init_point: result.init_point, orderId: newOrder._id });
  } catch (err) {
    console.error('PREFERENCE_ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- WEBHOOK FOR MERCADO PAGO ---
app.post('/api/webhooks/mercadopago', async (req, res) => {
  const { query } = req;
  const topic = query.topic || query.type;

  try {
    if (topic === 'payment') {
      const paymentId = query.id || req.body.data.id;
      const payment = new Payment(mpClient);
      const paymentDetails = await payment.get({ id: paymentId });

      if (paymentDetails.status === 'approved') {
        const orderId = paymentDetails.external_reference;
        const order = await Order.findById(orderId);

        if (order && order.status !== 'Pagado') {
          // 1. Update Order Status
          order.status = 'Pagado';
          await order.save();

          // 2. Decrement Product Stock
          for (const item of order.items) {
            await Product.findByIdAndUpdate(item.productId, {
              $inc: { stock: -item.quantity }
            });
          }
          console.log(`✅ INVENTARIO_AUTOMATIZADO: Pedido ${orderId} procesado.`);
        }
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ WEBHOOK_ERROR:', err.message);
    res.sendStatus(500);
  }
});
const SKYDROPX_TOKEN = '2keQAQv9TrYf0VJYVtvL697w9602CBlrUKxoUxm6ZXk'; // From user
const ORIGIN_ZIP = '684521'; // Villanueva, Santander

app.post('/api/shipping/quote', async (req, res) => {
  const { zip_to, items } = req.body;
  
  if (!zip_to || !items || items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos de destino o productos' });
  }

  try {
    // 1. Calculate total weight and largest dimensions
    let totalWeight = 0;
    let maxHeight = 0, maxWidth = 0, maxLength = 0;

    items.forEach(item => {
      totalWeight += (item.weight || 1) * (item.quantity || 1);
      maxHeight = Math.max(maxHeight, item.height || 10);
      maxWidth = Math.max(maxWidth, item.width || 10);
      maxLength = Math.max(maxLength, item.length || 10);
    });

    // 2. Call Skydropx Quotations API (V1 format)
    const response = await fetch('https://api.skydropx.com/v1/quotations', {
      method: 'POST',
      headers: {
        'Authorization': `Token token=${SKYDROPX_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zip_from: ORIGIN_ZIP,
        zip_to: zip_to,
        parcel: {
          weight: totalWeight,
          height: maxHeight,
          width: maxWidth,
          length: maxLength
        }
      })
    });

    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      // Return the cheapest rate
      const cheapest = data.data.reduce((prev, curr) => 
        (parseFloat(prev.attributes.total_pricing) < parseFloat(curr.attributes.total_pricing)) ? prev : curr
      );
      res.json({ 
        rate: cheapest.attributes.total_pricing, 
        carrier: cheapest.attributes.carrier_name,
        days: cheapest.attributes.days
      });
    } else {
      res.status(404).json({ error: 'No hay tarifas disponibles para este destino' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ORDER ROUTES ---
app.post('/api/orders', async (req, res) => {
  try {
    const newOrder = new Order(req.body);
    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.find().sort({ date: -1 });
    res.json(orders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- STATS ROUTES ---
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const totalSalesData = await Order.aggregate([{ $group: { _id: null, total: { $sum: "$total" } } }]);
    const totalOrders = await Order.countDocuments();
    const totalProducts = await Product.countDocuments();
    const today = new Date();
    today.setHours(0,0,0,0);
    const todaySalesData = await Order.aggregate([
      { $match: { date: { $gte: today } } },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]);
    res.json({
      totalSales: totalSalesData[0]?.total || 0,
      todaySales: todaySalesData[0]?.total || 0,
      totalOrders,
      totalProducts
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- SERVING FRONTEND FOR PRODUCTION ---
// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Ruta catch-all para Single Page Application (Vue Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 SERVIDOR_ESTABLE: Puerto ${PORT}`);
});
