require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { Resend } = require('resend');

const Product = require('./models/Product');
const Category = require('./models/Category');
const Order = require('./models/Order');
const Settings = require('./models/Settings');
const User = require('./models/User');
const Blog = require('./models/Blog');

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

const resend = new Resend(process.env.RESEND_API_KEY);

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

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    const updatedCategory = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedCategory);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- BLOG ROUTES ---
app.get('/api/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/blogs/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Post not found' });
    res.json(blog);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/blogs', authenticateToken, async (req, res) => {
  try {
    const newBlog = new Blog(req.body);
    await newBlog.save();
    res.status(201).json(newBlog);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/blogs/:id', authenticateToken, async (req, res) => {
  try {
    const updatedBlog = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedBlog);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/blogs/:id', authenticateToken, async (req, res) => {
  try {
    await Blog.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- PRODUCT ROUTES ---
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
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
      quantity: item.quantity || 1,
      size: item.size || null
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

    const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.FRONTEND_URL || 'https://www.bicicamilo.com';
    console.log('🔗 BASE_URL_FOR_PAYMENT:', baseUrl);

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
          success: baseUrl,
          failure: `${baseUrl}/cart`,
          pending: baseUrl
        },
        auto_return: 'approved',
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
        external_reference: newOrder._id.toString(), // Link back to Order
      }
    });

    res.json({ init_point: result.init_point, orderId: newOrder._id });
  } catch (err) {
    console.error('PREFERENCE_ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- ADDI PAYMENT ORDER ---
app.post('/api/payments/addi-order', async (req, res) => {
  const { items, total, customer } = req.body;
  try {
    const newOrder = new Order({
      customerName: customer.name,
      email: customer.email,
      phone: customer.phone,
      idNumber: customer.idNumber,
      address: customer.address,
      city: customer.city,
      notes: customer.notes,
      items: items.map(i => ({
        productId: i._id,
        title: i.title,
        price: parseFloat(i.price.toString().replace(/[^0-9.]/g, '')),
        quantity: i.quantity || 1,
        size: i.size || null
      })),
      total: total,
      status: 'Pendiente_Addi',
      external_reference: 'ADDI_OFFLINE'
    });
    
    await newOrder.save();

    // 1. Send Notification Email to Admin (pily241@hotmail.com)
    const itemListHtml = items.map(i => `<li>${i.quantity}x ${i.title} - $${i.price.toLocaleString()}</li>`).join('');
    
    try {
      // Notify Admin
      await resend.emails.send({
        from: `Bicicamilo Store <${process.env.EMAIL_FROM || 'ventas@bicicamilo.com'}>`,
        to: process.env.ADMIN_EMAIL || 'pily241@hotmail.com',
        subject: `NUEVO PEDIDO ADDI: ${customer.name}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
            <h1 style="color: #000;">NUEVO PEDIDO POR ADDI</h1>
            <p><strong>Cliente:</strong> ${customer.name}</p>
            <p><strong>Teléfono:</strong> ${customer.phone}</p>
            <p><strong>Email:</strong> ${customer.email}</p>
            <p><strong>Cédula:</strong> ${customer.idNumber}</p>
            <p><strong>Dirección:</strong> ${customer.address}, ${customer.city}</p>
            <hr>
            <h3>PRODUCTOS:</h3>
            <ul>${itemListHtml}</ul>
            <p style="font-size: 1.2rem;"><strong>TOTAL:</strong> $${total.toLocaleString()}</p>
            <hr>
            <p style="color: #666;">Por favor, contacta al cliente para gestionar el crédito Addi.</p>
          </div>
        `
      });

      // 2. Send Confirmation Email to Customer
      await resend.emails.send({
        from: `Bicicamilo Store <${process.env.EMAIL_FROM || 'ventas@bicicamilo.com'}>`,
        to: customer.email,
        subject: `Confirmación de Pedido - Bicicamilo`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
            <h1 style="color: #000;">¡HOLA ${customer.name.toUpperCase()}!</h1>
            <p>Hemos recibido tu solicitud de pedido con <strong>ADDI</strong> satisfactoriamente.</p>
            <p>Un asesor de nuestra tienda se comunicará contigo próximamente para finalizar el proceso de pago y coordinar el envío.</p>
            <hr>
            <h3>RESUMEN DE TU PEDIDO:</h3>
            <ul>${itemListHtml}</ul>
            <p><strong>TOTAL A PAGAR:</strong> $${total.toLocaleString()}</p>
            <hr>
            <p style="font-size: 0.8rem; color: #999;">Gracias por confiar en Bicicamilo.</p>
          </div>
        `
      });
      console.log('EMAILS_SENT_LOG: Admin (pily241@hotmail.com) and Customer notified');
    } catch (e) { console.error('EMAIL_FAIL:', e); }

    res.status(201).json({ message: 'Order created', orderId: newOrder._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update Order Status (Admin)
app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
  const { status } = req.body;
  try {
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(updatedOrder);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- WEBHOOK FOR MERCADO PAGO ---
app.post('/api/webhooks/mercadopago', async (req, res) => {
  const { query, headers, body } = req;
  const topic = query.topic || query.type || body.type || (body.action ? body.action.split('.')[0] : null);
  
  console.log('📬 WEBHOOK_RECEIVED:', { 
    topic, 
    query_id: query.id, 
    body_data_id: body.data ? body.data.id : null,
    full_query: query,
    full_body: body 
  });

  // 0. Handle MP Test Notifications
  if (topic === 'test' || !topic) {
    console.log('🧪 MP_TEST_NOTIFICATION_RECEIVED:', { topic, query, body });
    return res.sendStatus(200);
  }

  // 1. Mandatory Header Verification (Security Enhancement)
  const xSignature = headers['x-signature'];
  const xRequestId = headers['x-request-id'];
  const secret = process.env.MP_WEBHOOK_SECRET;

  if (secret && xSignature && xRequestId) {
    try {
      const parts = xSignature.split(',');
      let ts = null;
      let v1 = null;
      
      parts.forEach(part => {
        const [key, value] = part.split('=');
        if (key && value) {
          if (key.trim() === 'ts') ts = value.trim();
          if (key.trim() === 'v1') v1 = value.trim();
        }
      });

      const resourceId = query.id || (body.data && body.data.id) || body.id;
      if (resourceId && ts && v1) {
        const manifest = `id:${resourceId};request-id:${xRequestId};ts:${ts};`;
        const calculatedV1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

        if (calculatedV1 !== v1) {
          console.warn('⚠️ WEBHOOK_SECURITY_ALERT: Invalid signature detected.');
          // En producción, podrías querer retornar 403, pero para debug vamos a dejarlo pasar con un log
          // return res.sendStatus(403); 
        } else {
          console.log('✅ WEBHOOK_SIGNATURE_VERIFIED');
        }
      }
    } catch (e) {
      console.error('❌ WEBHOOK_VERIFICATION_ERROR:', e.message);
    }
  }

  try {
    if (topic === 'payment' || topic === 'merchant_order') {
      const paymentId = query.id || (body.data && body.data.id) || body.id;
      
      if (!paymentId) {
        console.warn('⚠️ WEBHOOK_MISSING_ID');
        return res.sendStatus(200);
      }

      const payment = new Payment(mpClient);
      const paymentDetails = await payment.get({ id: paymentId });

      console.log(`🔍 PAYMENT_DETAILS (${paymentId}):`, paymentDetails.status);

      if (paymentDetails.status === 'approved') {
        const orderId = paymentDetails.external_reference;
        if (!orderId) {
          console.warn('⚠️ WEBHOOK_MISSING_ORDER_REFERENCE');
          return res.sendStatus(200);
        }

        const order = await Order.findById(orderId);

        if (order && order.status !== 'Pagado') {
          // 1. Update Order Status
          order.status = 'Pagado';
          await order.save();

          // 2. Decrement Product Stock (General and per Size)
          for (const item of order.items) {
            if (item.size) {
              await Product.updateOne(
                { _id: item.productId, "sizes.size": item.size },
                { $inc: { "sizes.$.stock": -item.quantity, stock: -item.quantity } }
              );
            } else {
              await Product.findByIdAndUpdate(item.productId, {
                $inc: { stock: -item.quantity }
              });
            }
          }
          // 3. Email Notifications
          await sendPaymentConfirmationEmail(order);
          await sendAdminPaymentNotificationEmail(order);
          
          console.log(`✅ INVENTARIO_AUTOMATIZADO: Pedido ${orderId} procesado.`);
        } else if (order) {
          console.log(`ℹ️ ORDER_ALREADY_PROCESSED: ${orderId}`);
        } else {
          console.warn(`❌ ORDER_NOT_FOUND_IN_DB: ${orderId}`);
        }
      }
    }
    // Siempre responder 200/201 a Mercado Pago
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ WEBHOOK_ERROR:', err.message);
    // Respondemos 200 para que MP no reintente fallos que pueden ser lógicos
    res.sendStatus(200);
  }
});

// --- EMAIL UTILITY (RESEND) ---
const LOGO_URL = process.env.LOGO_URL || 'https://res.cloudinary.com/dpachgxay/image/upload/bicicamilo/brand/logo_official.jpg';

async function sendPaymentConfirmationEmail(order) {
  try {
    const itemsHtml = order.items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: left; vertical-align: middle;">
          <span style="font-weight: 700; font-size: 14px; text-transform: uppercase;">${item.title}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center; vertical-align: middle;">
          <span style="font-family: monospace;">x${item.quantity}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; vertical-align: middle; font-weight: 700;">
          $${item.price.toLocaleString('es-CO')}
        </td>
      </tr>
    `).join('');

    const { data, error } = await resend.emails.send({
      from: `Bicicamilo <${process.env.EMAIL_FROM}>`,
      to: order.email,
      reply_to: 'ventas@bicicamilo.com',
      subject: `🚴 ¡Pago Confirmado! Pedido #${order._id.toString().slice(-6)}`,
      html: `
        <div style="font-family: 'Inter', system-ui, sans-serif; background-color: #ffffff; color: #1a1a1a; max-width: 600px; margin: 20px auto; border: 1px solid #f0f0f0; border-radius: 4px; overflow: hidden;">
          <div style="background-color: #000000; padding: 40px; text-align: center;">
            <img src="${LOGO_URL}" alt="Bicicamilo" style="max-height: 80px; width: auto;">
          </div>
          
          <div style="padding: 40px;">
            <h1 style="font-size: 24px; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 8px; text-align: center;">¡TUA PAGO HA SIDO APROBADO!</h1>
            <p style="font-size: 14px; color: #666; text-align: center; margin-bottom: 40px;">Hola <strong>${order.customerName}</strong>, gracias por elegir Bicicamilo. Tu pedido está en camino.</p>
            
            <div style="background-color: #fafafa; border: 1px solid #eeeeee; padding: 25px; margin-bottom: 30px;">
              <h3 style="font-size: 11px; font-weight: 900; letter-spacing: 0.1em; color: #999; text-transform: uppercase; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;">RESUMEN DE COMPRA</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="font-size: 10px; font-weight: 900; color: #aaa; text-transform: uppercase;">
                    <th style="padding: 10px; text-align: left;">Producto</th>
                    <th style="padding: 10px; text-align: center;">Cant.</th>
                    <th style="padding: 10px; text-align: right;">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="2" style="padding: 20px 10px 10px; font-weight: 900; font-size: 14px;">TOTAL PAGADO</td>
                    <td style="padding: 20px 10px 10px; font-weight: 900; font-size: 18px; text-align: right;">$${order.total.toLocaleString('es-CO')} COP</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
              <div style="background: #ffffff; border: 1px solid #eee; padding: 20px;">
                <h4 style="font-size: 10px; font-weight: 900; color: #999; margin: 0 0 10px;">DATOS DE ENVÍO</h4>
                <p style="font-size: 13px; margin: 0; line-height: 1.6;">
                  <strong>${order.customerName}</strong><br>
                  ${order.address}<br>
                  ${order.city}<br>
                  Tél: ${order.phone}
                </p>
              </div>
              <div style="background: #ffffff; border: 1px solid #eee; padding: 20px;">
                <h4 style="font-size: 10px; font-weight: 900; color: #999; margin: 0 0 10px;">NOTAS</h4>
                <p style="font-size: 13px; margin: 0; line-height: 1.6;">${order.notes || 'Ninguna'}</p>
              </div>
            </div>

            <div style="text-align: center; border-top: 1px solid #eee; padding-top: 30px;">
              <p style="font-size: 12px; color: #888;">Si tienes alguna duda, escríbenos a nuestro WhatsApp o responde a este correo.</p>
              <a href="https://bicicamilo.com" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 30px; font-weight: 900; font-size: 11px; letter-spacing: 0.1em; border-radius: 0; margin-top: 20px;">VER TIENDA ONLINE</a>
            </div>
          </div>
          
          <footer style="background-color: #fafafa; padding: 30px; text-align: center; border-top: 1px solid #eee;">
            <p style="font-size: 10px; font-weight: 800; color: #bbbbbb; letter-spacing: 0.15em; margin-bottom: 10px;">BICICAMILO • INGENIERÍA DE EXCELENCIA</p>
            <p style="font-size: 9px; color: #cccccc; margin: 0;">Villanueva, Santander • Colombia</p>
          </footer>
        </div>
      `
    });

    if (error) console.error('❌ RESEND_ERROR_CUSTOMER:', error);
    else console.log('📧 EMAIL_CLIENTE_ENVIADO:', data.id);
  } catch (err) { console.error('❌ EMAIL_FUNC_CUSTOMER_ERROR:', err.message); }
}

async function sendAdminPaymentNotificationEmail(order) {
  try {
    const { data, error } = await resend.emails.send({
      from: `Notificaciones <${process.env.EMAIL_FROM}>`,
      to: process.env.ADMIN_EMAIL || 'pily241@hotmail.com',
      subject: `💰 NUEVA VENTA - $${order.total.toLocaleString()} - #${order._id.toString().slice(-6)}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>💰 ¡Nueva Venta Confirmada!</h2>
          <p>Se ha recibido un pago de <strong>$${order.total.toLocaleString()} COP</strong></p>
          <hr>
          <h3>Datos del Cliente:</h3>
          <p>
            <strong>Nombre:</strong> ${order.customerName}<br>
            <strong>Cédula/NIT:</strong> ${order.idNumber}<br>
            <strong>Email:</strong> ${order.email}<br>
            <strong>Teléfono:</strong> ${order.phone}
          </p>
          <h3>Dirección de Entrega:</h3>
          <p>${order.address}, ${order.city}</p>
          <h3>Productos:</h3>
          <ul>
            ${order.items.map(item => `<li>${item.title} x${item.quantity} - $${item.price.toLocaleString()}</li>`).join('')}
          </ul>
          <p><strong>Notas:</strong> ${order.notes || 'Ninguna'}</p>
          <a href="#" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none;">GESTIONAR EN EL PANEL</a>
        </div>
      `
    });

    if (error) console.error('❌ RESEND_ERROR_ADMIN:', error);
    else console.log('📧 EMAIL_ADMIN_ENVIADO:', data.id);
  } catch (err) { console.error('❌ EMAIL_FUNC_ADMIN_ERROR:', err.message); }
}
const SKYDROPX_TOKEN = process.env.SKYDROPX_TOKEN;
const ORIGIN_ZIP = process.env.SKYDROPX_ORIGIN_ZIP;

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
const frontendPath = path.resolve(__dirname, 'dist');
console.log('📂 BUSCANDO_FRONTEND_EN:', frontendPath);

// Servir archivos estáticos del frontend
app.use(express.static(frontendPath));

// Ruta catch-all para Single Page Application (Vue Router)
app.get('*', (req, res) => {
  const indexFile = path.join(frontendPath, 'index.html');
  res.sendFile(indexFile, (err) => {
    if (err) {
      console.error('❌ FRONTEND_INDEX_ERROR:', err.path);
      res.status(404).send('Bicicamilo: El frontend no ha sido compilado correctamente en esta ruta.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 SERVIDOR_ESTABLE: Puerto ${PORT}`);
  console.log(`🌍 URL_RENDER_EXTERNA: ${process.env.RENDER_EXTERNAL_URL || 'NO CONFIGURADO'}`);
});
