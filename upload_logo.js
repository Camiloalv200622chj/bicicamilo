require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const logoPath = path.resolve(__dirname, '..', 'frontend', 'src', 'assets', 'logo.jpg');

console.log('Subiendo logo desde:', logoPath);

cloudinary.uploader.upload(logoPath, { folder: 'bicicamilo/brand', public_id: 'logo_official' }, (err, result) => {
  if (err) {
    console.error('Error uploading logo:', err);
    process.exit(1);
  }
  console.log('--- LOGO_URL_START ---');
  console.log(result.secure_url);
  console.log('--- LOGO_URL_END ---');
  process.exit(0);
});
