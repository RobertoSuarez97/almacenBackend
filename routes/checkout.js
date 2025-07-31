const express = require('express');
const router = express.Router();
const { MercadoPagoConfig, Preference } = require('mercadopago');

// Configura tu access token
const mercadopagoClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN // Asegúrate de tener esto en tu .env
});

router.post('/crear-preferencia', async (req, res) => {
  try {
    const { carrito, envio, emailComprador } = req.body;

    // Validaciones básicas
    if (!carrito || !Array.isArray(carrito) || carrito.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío o es inválido' });
    }

    if (!emailComprador) {
      return res.status(400).json({ error: 'El email del comprador es requerido' });
    }

    // Mapear productos del carrito a items de MercadoPago
    const items = carrito.map(producto => {
      // Calcular precio final con descuento si existe
      let precioFinal = parseFloat(producto.precio);
      if (producto.descuento && producto.descuento > 0) {
        precioFinal = precioFinal * (1 - producto.descuento / 100);
      }

      return {
        title: producto.nombre,
        quantity: parseInt(producto.cantidad),
        unit_price: Math.round(precioFinal * 100) / 100, // Redondear a 2 decimales
        currency_id: 'MXN'
      };
    });

    // Crear el cuerpo de la preferencia
    const body = {
      items,
      payer: { 
        email: emailComprador 
      },
      back_urls: {
        success: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/pago-exitoso`,
        failure: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/pago-fallido`,
        pending: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/pago-pendiente`
      },
      auto_return: 'approved',
      notification_url: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/checkout/webhook`,
      metadata: {
        envio: envio,
        carrito: carrito.map(item => ({
          id: item.id,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio_original: item.precio,
          descuento: item.descuento || 0
        }))
      }
    };

    // Crear la preferencia en MercadoPago
    const preference = await new Preference(mercadopagoClient).create({ body });

    console.log('✅ Preferencia creada exitosamente:', preference.id);

    res.json({ 
      init_point: preference.init_point,
      preference_id: preference.id 
    });

  } catch (err) {
    console.error('❌ Error al crear preferencia:', err);
    res.status(500).json({ 
      error: 'No se pudo crear la preferencia de pago',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Webhook para recibir notificaciones de MercadoPago
router.post('/webhook', async (req, res) => {
  try {
    const { type, data } = req.body;

    console.log('🔔 Webhook recibido:', { type, data });

    if (type === 'payment') {
      const paymentId = data.id;
      console.log('💳 Pago procesado con ID:', paymentId);
      
      // Aquí puedes procesar el pago, actualizar tu base de datos, etc.
      // Por ejemplo:
      // - Verificar el estado del pago
      // - Actualizar el pedido en tu base de datos
      // - Enviar email de confirmación
      // - Actualizar inventario
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.status(500).send('Error');
  }
});

module.exports = router;