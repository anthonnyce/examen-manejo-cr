const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../db");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "cambia-este-secreto";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROVINCIAS = ["San José", "Alajuela", "Cartago", "Heredia", "Guanacaste", "Puntarenas", "Limón"];
const RESET_TOKEN_TTL_MIN = 30;

function crearToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, nombre: usuario.nombre },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { nombre, email, provincia, password } = req.body;

    if (!nombre || !email || !provincia || !password) {
      return res.status(400).json({ error: "Faltan campos obligatorios." });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Correo electrónico inválido." });
    }
    if (!PROVINCIAS.includes(provincia)) {
      return res.status(400).json({ error: "Provincia inválida." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
    }

    const existente = await pool.query("SELECT id FROM usuarios WHERE email = $1", [email]);
    if (existente.rows.length > 0) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const resultado = await pool.query(
      `INSERT INTO usuarios (nombre, email, provincia, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, email, provincia, creado_en`,
      [nombre, email, provincia, passwordHash]
    );

    const usuario = resultado.rows[0];
    const token = crearToken(usuario);

    return res.status(201).json({ token, usuario });
  } catch (err) {
    console.error("Error en /register:", err);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Faltan campos obligatorios." });
    }

    const resultado = await pool.query(
      "SELECT id, nombre, email, password_hash FROM usuarios WHERE email = $1",
      [email]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    }

    const usuario = resultado.rows[0];
    const coincide = await bcrypt.compare(password, usuario.password_hash);

    if (!coincide) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    }

    const token = crearToken(usuario);
    delete usuario.password_hash;

    return res.json({ token, usuario });
  } catch (err) {
    console.error("Error en /login:", err);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// POST /api/auth/forgot-password
// Siempre responde 200, exista o no la cuenta, para no revelar qué correos están registrados.
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Correo electrónico inválido." });
    }

    const resultado = await pool.query("SELECT id, nombre FROM usuarios WHERE email = $1", [email]);

    if (resultado.rows.length > 0) {
      const usuario = resultado.rows[0];
      const token = crypto.randomBytes(32).toString("hex");
      const expiraEn = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60 * 1000);

      await pool.query(
        `INSERT INTO reset_tokens (usuario_id, token, expira_en)
         VALUES ($1, $2, $3)`,
        [usuario.id, token, expiraEn]
      );

      await enviarCorreoRecuperacion(email, usuario.nombre, token);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error en /forgot-password:", err);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "Faltan campos obligatorios." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
    }

    const resultado = await pool.query(
      `SELECT id, usuario_id, expira_en, usado FROM reset_tokens WHERE token = $1`,
      [token]
    );

    if (resultado.rows.length === 0) {
      return res.status(400).json({ error: "Enlace inválido o ya utilizado." });
    }

    const registro = resultado.rows[0];

    if (registro.usado) {
      return res.status(400).json({ error: "Este enlace ya fue utilizado." });
    }
    if (new Date(registro.expira_en) < new Date()) {
      return res.status(400).json({ error: "Este enlace expiró. Solicitá uno nuevo." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query("UPDATE usuarios SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      registro.usuario_id
    ]);
    await pool.query("UPDATE reset_tokens SET usado = true WHERE id = $1", [registro.id]);

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error en /reset-password:", err);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Envía el correo de recuperación usando Resend (https://resend.com).
// Si no hay RESEND_API_KEY configurada, solo lo deja registrado en consola
// para que puedas probar el flujo en desarrollo sin tener el correo listo.
async function enviarCorreoRecuperacion(email, nombre, token) {
  const enlace = `${process.env.FRONTEND_URL || "http://localhost:5500"}/restablecer.html?token=${token}`;

  if (!process.env.RESEND_API_KEY) {
    console.log(`[dev] Enlace de recuperación para ${email}: ${enlace}`);
    return;
  }

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "RutaCR <no-reply@rutacr.com>",
        to: email,
        subject: "Recuperá tu contraseña — RutaCR",
        html: `<p>Hola ${nombre},</p>
               <p>Hacé clic en el siguiente enlace para elegir una nueva contraseña. Es válido por ${RESET_TOKEN_TTL_MIN} minutos:</p>
               <p><a href="${enlace}">${enlace}</a></p>
               <p>Si no pediste esto, podés ignorar el correo.</p>`
      })
    });
  } catch (err) {
    console.error("Error enviando correo de recuperación:", err);
  }
}

module.exports = router;
