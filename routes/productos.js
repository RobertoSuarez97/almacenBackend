const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const db = require('../db/connection');
const ftp = require('basic-ftp');
const fs = require('fs');
require('dotenv').config();

// 📦 Configuración FTP
const ftpConfig = {
  host: process.env.FTP_HOST,
  user: process.env.FTP_USER,
  password: process.env.FTP_PASSWORD,
  port: process.env.FTP_PORT,
  secure: process.env.FTP_SECURE
};

// Función para subir archivos a Hostinger vía FTP
const uploadFileToFtp = async (localPath, remoteFilename) => {
  const client = new ftp.Client();
  client.ftp.verbose = true; // para ver más logs

  try {
    await client.access(ftpConfig);

    console.log('📂 Conectado al FTP');

    // Ir al directorio donde van los archivos
    await client.ensureDir('assets/productos');
    
    // Subir el archivo
    await client.uploadFrom(localPath, `assets/productos/${remoteFilename}`);
  } catch (err) {
    console.error('Error al subir archivo por FTP:', err);
    throw err;
  } finally {
    client.close();
  }
};

// Configuración de almacenamiento para multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Carpeta temporal local
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Crear carpeta uploads si no existe
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Obtener todos los productos
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM productos');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// Productos con límite de novedades
router.get('/novedades', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM productos order by fecha asc limit 14');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// Productos organizados por categorías
router.get('/getProductosPorCategorias', async (req, res) => {
  try {
    const sql = `
      SELECT 
        p.id AS producto_id, 
        p.nombre AS producto_nombre, 
        p.descripcion AS producto_descripcion, 
        p.caracteristicas, 
        p.precio, 
        p.stock, 
        p.marca_id, 
        p.descuento, 
        p.imagen_principal, 
        c.id AS categoria_id, 
        c.nombre AS categoria_nombre,
        m.nombre AS marca_nombre
      FROM productos p
      LEFT JOIN productos_categorias pc ON p.id = pc.producto_id
      LEFT JOIN marcas m ON p.marca_id  = m.id
      LEFT JOIN categorias c ON pc.categoria_id = c.id
      ORDER BY c.id, p.id
    `;
    const [rows] = await db.query(sql);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error al obtener productos con categorías:', error);
    res.status(500).json({ message: 'Error al obtener productos con categorías', error });
  }
});

// Productos en oferta
router.get('/ofertas', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM productos where descuento > 0');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// Obtener producto por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM productos WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

// Obtener galería por producto
router.get('/gallery/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM galeria_productos WHERE producto_id = ?', [id]);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener galería:', error);
    res.status(500).json({ error: 'Error al obtener galería' });
  }
});

// Agregar producto con imagen y galería
router.post('/photoUpload', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]), async (req, res) => {
  try {
    const { name, description, caracteristicas, price, quantity, brand, discount } = req.body;

    if (!name || !description || !caracteristicas || !price || !quantity || !brand) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }

    const photoFile = req.files['photo'] ? req.files['photo'][0] : null;
    const photo = photoFile?.filename || null;

    if (!photoFile) {
      return res.status(400).json({ message: 'Debe subir una imagen principal' });
    }

    await uploadFileToFtp(photoFile.path, photoFile.filename);

    const sqlProducto = `
      INSERT INTO productos (nombre, descripcion, caracteristicas, precio, stock, marca_id, descuento, imagen_principal, fecha)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const [result] = await db.query(sqlProducto, [
      name,
      description,
      caracteristicas,
      price,
      quantity,
      brand,
      discount || 0,
      photo,
    ]);

    const productId = result.insertId;

    if (req.files['gallery']) {
      const galleryImages = req.files['gallery'].map(file => [productId, file.filename]);
      for (const file of req.files['gallery']) {
        await uploadFileToFtp(file.path, file.filename);
      }
      const sqlGaleria = `INSERT INTO galeria_productos (producto_id, imagen) VALUES ?`;
      await db.query(sqlGaleria, [galleryImages]);
    }

    res.status(201).json({
      message: 'Producto agregado correctamente',
      productId,
      photo,
      gallery: req.files['gallery'] ? req.files['gallery'].map(file => file.filename) : [],
    });
  } catch (error) {
    console.error('Error al agregar producto:', error);
    res.status(500).json({ message: 'Error al agregar producto', error });
  }
});

// Actualizar producto y galería
router.put('/:id', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, caracteristicas, price, quantity, brand, discount, deleteGallery } = req.body;

    if (!name || !description || !caracteristicas || price == null || quantity == null || !brand || discount == null) {
      return res.status(400).json({ message: 'Por favor, completa todos los campos' });
    }

    let newPhoto = req.body.photo;

    if (req.files['photo']) {
      const photoFile = req.files['photo'][0];
      newPhoto = photoFile.filename;
      await uploadFileToFtp(photoFile.path, photoFile.filename);
    }

    const sqlUpdateProduct = `
      UPDATE productos 
      SET nombre = ?, descripcion = ?, caracteristicas = ?, precio = ?, stock = ?, marca_id = ?, descuento = ?, imagen_principal = ?
      WHERE id = ?
    `;
    const [result] = await db.query(sqlUpdateProduct, [name, description, caracteristicas, price, quantity, brand, discount, newPhoto, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    if (deleteGallery) {
      const deleteIds = JSON.parse(deleteGallery);
      if (deleteIds.length > 0) {
        const sqlDeleteImages = `DELETE FROM galeria_productos WHERE id IN (?)`;
        await db.query(sqlDeleteImages, [deleteIds]);
      }
    }

    if (req.files['gallery']) {
      const newGalleryImages = req.files['gallery'].map(file => [id, file.filename]);
      for (const file of req.files['gallery']) {
        await uploadFileToFtp(file.path, file.filename);
      }
      const sqlInsertGallery = `INSERT INTO galeria_productos (producto_id, imagen) VALUES ?`;
      await db.query(sqlInsertGallery, [newGalleryImages]);
    }

    res.json({
      message: 'Producto actualizado correctamente',
      photo: newPhoto,
      gallery: req.files['gallery'] ? req.files['gallery'].map(file => file.filename) : [],
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ message: 'Error al actualizar producto', error });
  }
});

module.exports = router;
