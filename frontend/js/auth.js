function showMsg(text, type) {
  const box = document.getElementById("formMsg");
  if (!box) return;
  box.textContent = text;
  box.className = "form-msg show " + type;
}

function setLoading(btn, loading, textoNormal) {
  btn.disabled = loading;
  btn.textContent = loading ? "Un momento..." : textoNormal;
}

// ---------- REGISTRO ----------
const registroForm = document.getElementById("registroForm");
if (registroForm) {
  registroForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = document.getElementById("nombre").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const provincia = document.getElementById("provincia").value;
    const password = document.getElementById("password").value;
    const password2 = document.getElementById("password2").value;
    const btn = document.getElementById("submitBtn");

    if (!provincia) {
      showMsg("Elegí tu provincia de residencia.", "error");
      return;
    }
    if (password !== password2) {
      showMsg("Las contraseñas no coinciden.", "error");
      return;
    }
    if (password.length < 8) {
      showMsg("La contraseña debe tener al menos 8 caracteres.", "error");
      return;
    }

    setLoading(btn, true, "Crear cuenta");
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, provincia, password })
      });
      const data = await res.json();

      if (!res.ok) {
        showMsg(data.error || "No se pudo crear la cuenta.", "error");
        setLoading(btn, false, "Crear cuenta");
        return;
      }

      localStorage.setItem("rutacr_token", data.token);
      showMsg("Cuenta creada. Redirigiendo...", "success");
      setTimeout(() => (window.location.href = "index.html"), 800);
    } catch (err) {
      showMsg("No se pudo conectar con el servidor.", "error");
      setLoading(btn, false, "Crear cuenta");
    }
  });
}

// ---------- LOGIN ----------
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;
    const btn = document.getElementById("submitBtn");

    setLoading(btn, true, "Entrar");
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        showMsg(data.error || "Correo o contraseña incorrectos.", "error");
        setLoading(btn, false, "Entrar");
        return;
      }

      localStorage.setItem("rutacr_token", data.token);
      showMsg("¡Bienvenido de nuevo! Redirigiendo...", "success");
      setTimeout(() => (window.location.href = "index.html"), 800);
    } catch (err) {
      showMsg("No se pudo conectar con el servidor.", "error");
      setLoading(btn, false, "Entrar");
    }
  });
}

// ---------- RECUPERAR CONTRASEÑA (solicitar enlace) ----------
const recuperarForm = document.getElementById("recuperarForm");
if (recuperarForm) {
  recuperarForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim().toLowerCase();
    const btn = document.getElementById("submitBtn");

    setLoading(btn, true, "Enviar enlace");
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      // Por seguridad, el backend siempre responde OK, exista o no la cuenta.
      if (!res.ok) {
        showMsg(data.error || "No se pudo procesar la solicitud.", "error");
      } else {
        showMsg("Si ese correo está registrado, te enviamos un enlace para restablecer tu contraseña.", "success");
        recuperarForm.reset();
      }
    } catch (err) {
      showMsg("No se pudo conectar con el servidor.", "error");
    }
    setLoading(btn, false, "Enviar enlace");
  });
}

// ---------- RESTABLECER CONTRASEÑA (con token del correo) ----------
const restablecerForm = document.getElementById("restablecerForm");
if (restablecerForm) {
  restablecerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const password = document.getElementById("password").value;
    const password2 = document.getElementById("password2").value;
    const btn = document.getElementById("submitBtn");

    if (!token) {
      showMsg("Enlace inválido o incompleto. Solicitá uno nuevo desde 'Olvidé mi contraseña'.", "error");
      return;
    }
    if (password !== password2) {
      showMsg("Las contraseñas no coinciden.", "error");
      return;
    }
    if (password.length < 8) {
      showMsg("La contraseña debe tener al menos 8 caracteres.", "error");
      return;
    }

    setLoading(btn, true, "Guardar contraseña");
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json();

      if (!res.ok) {
        showMsg(data.error || "No se pudo restablecer la contraseña.", "error");
        setLoading(btn, false, "Guardar contraseña");
        return;
      }

      showMsg("Contraseña actualizada. Redirigiendo al login...", "success");
      setTimeout(() => (window.location.href = "login.html"), 1000);
    } catch (err) {
      showMsg("No se pudo conectar con el servidor.", "error");
      setLoading(btn, false, "Guardar contraseña");
    }
  });
}
