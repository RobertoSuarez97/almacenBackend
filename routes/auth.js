const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
// const bcrypt = require('bcrypt');
const db = require('../db/connection');


router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [users] = await db.query("SELECT * FROM administrador where usuario= '"+ username +"'");
    const user = users.find((u) => u.usuario === username);
    if (!user) {
        return res.status(200).json({ message: 'Usuario no encontrado' });
    }

    //   const isMatch = await bcrypt.compare(password, user.password);
    const userPassword = users.find((p) => p.contrasena === password);
    if (!userPassword) {
        return res.status(200).json({ message: 'Password incorrecto' });
    }

    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
