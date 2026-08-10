// =====================================================================
//  KC Spa · App conectada a Supabase (migración por módulos)
//  ---------------------------------------------------------------------
//  ENTREGA 1: cliente Supabase + login real (Auth) + primer cambio de
//  contraseña + carga de rol/locales desde la BD + módulo Pacientes
//  (tipo de piel + alteraciones múltiples) sobre el esquema real.
//  El resto de módulos quedan como marcadores para portarlos en los
//  siguientes pasos (agenda → atención/pagos → caja/cierres → CxC → balances).
//
//  CONFIGURACIÓN (Vite): crea un archivo .env en la raíz con:
//     VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
//     VITE_SUPABASE_ANON_KEY=tu-anon-key
//  (La anon key es pública por diseño; la seguridad la da la RLS.)
//
//  Requiere:  npm i @supabase/supabase-js
//
//  AUTENTICACIÓN: el login ahora es por CORREO + contraseña (Supabase Auth),
//  no por "usuario". El campo usuarios.username queda como identificador
//  visible. Crear/invitar usuarios y reiniciar contraseñas son acciones de
//  administrador que se hacen desde el panel de Supabase o una Edge Function
//  (no en el navegador, porque requieren la service role). La app sí maneja
//  el primer cambio de contraseña obligatorio.
// =====================================================================

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Users, Calendar, Wallet, Package, FileText, TrendingUp, Stethoscope,
  PhoneCall, Store, Lock, Plus, X, Search, ChevronLeft, Menu, Check, AlertTriangle,
} from "lucide-react";

// ---------- Cliente Supabase ----------
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ---------- Roles y permisos (mismo modelo que la app; el rol viene de la BD) ----------
const ROLES = { admin: "Administrador", propietario: "Propietario", asistente: "Asistente", cosmetologa: "Cosmetóloga" };
const PERMISOS = {
  admin:       { resumen: true, maestros: true, balances: true, usuarios: true, pacCrear: true, pacEditar: true, pacEliminar: true, pacAlteraciones: true, inventario: true, citas: true, atenciones: true, caja: true, cxc: true, seguimiento: true, localesTodos: true },
  propietario: { resumen: true, maestros: true, balances: true, usuarios: true, pacCrear: true, pacEditar: true, pacEliminar: true, pacAlteraciones: true, inventario: true, citas: true, atenciones: true, caja: true, cxc: true, seguimiento: true, localesTodos: false },
  asistente:   { resumen: false, maestros: false, balances: false, usuarios: false, pacCrear: true, pacEditar: false, pacEliminar: false, pacAlteraciones: false, inventario: true, citas: true, atenciones: true, caja: true, cxc: true, seguimiento: true, localesTodos: false },
  cosmetologa: { resumen: false, maestros: false, balances: false, usuarios: false, pacCrear: false, pacEditar: false, pacEliminar: false, pacAlteraciones: false, inventario: false, citas: false, atenciones: true, caja: false, cxc: false, seguimiento: false, localesTodos: false },
};
const puede = (rol, p) => !!(rol && PERMISOS[rol] && PERMISOS[rol][p]);

const TIPOS_PIEL = ["seca", "normal", "mixta", "grasa"];
const etiquetaTipoPiel = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "—");

// ---------- UI base ----------
const inputClass = "w-full px-3 py-2.5 rounded-lg border border-[#DDD6C2] text-sm bg-white text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#7C9885] focus:border-transparent";
const FONTS = "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Sora:wght@400;500;600&display=swap');";

function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-[13px] text-[#5E6E5F] mb-1.5" style={{ fontFamily: "'Sora', sans-serif" }}>{label}</span>
      {children}
    </label>
  );
}
function Card({ children, className = "" }) {
  return <div className={`rounded-2xl border border-[#E7E1D2] bg-white ${className}`}>{children}</div>;
}
function Boton({ children, onClick, variant = "primary", disabled }) {
  const style = variant === "primary" ? { backgroundColor: "#2E2E2E", color: "#fff" } : { backgroundColor: "#fff", color: "#2E2E2E", border: "1px solid #DDD6C2" };
  return (
    <button onClick={onClick} disabled={disabled} className="px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-50" style={{ ...style, fontFamily: "'Sora', sans-serif" }}>{children}</button>
  );
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center" style={{ backgroundColor: "rgba(46,46,46,0.45)", overflowY: "auto", padding: "24px 16px" }}>
      <div className={`rounded-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} shadow-xl`} style={{ backgroundColor: "#FBF9F3", maxHeight: "90vh", overflowY: "auto", margin: "auto" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E1D2] sticky top-0" style={{ backgroundColor: "#FBF9F3" }}>
          <h3 className="text-lg" style={{ fontFamily: "'Fraunces', serif", color: "#2E2E2E" }}>{title}</h3>
          <button onClick={onClose} style={{ color: "#7C8F7E" }}><X size={20} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
function SectionTitle({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <div className="text-[12px] tracking-[0.15em] uppercase text-[#7C9885] mb-1" style={{ fontFamily: "'Sora', sans-serif" }}>{eyebrow}</div>
        <h2 className="text-[28px] text-[#2E2E2E]" style={{ fontFamily: "'Fraunces', serif" }}>{title}</h2>
      </div>
      {action}
    </div>
  );
}
function Aviso({ tipo = "error", children }) {
  const col = tipo === "error" ? { bg: "#FBEDE4", fg: "#8A4A34", bd: "#EBCBB4" } : { bg: "#E6EFE6", fg: "#4A7350", bd: "#CDE0CD" };
  return (
    <div className="flex items-center gap-2 text-sm mb-4 px-3 py-2 rounded-lg border" style={{ backgroundColor: col.bg, color: col.fg, borderColor: col.bd }}>
      <AlertTriangle size={15} className="shrink-0" />{children}
    </div>
  );
}

// =====================================================================
//  App: sesión Supabase + carga de perfil/locales + ruteo
// =====================================================================
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [locales, setLocales] = useState([]);
  const [localActivo, setLocalActivo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCtx, setErrorCtx] = useState("");

  const cargarContexto = useCallback(async (sess) => {
    if (!sess?.user) { setProfile(null); setLocales([]); setLocalActivo(null); setCargando(false); return; }
    setCargando(true); setErrorCtx("");
    try {
      const { data: perfil, error: e1 } = await supabase.from("usuarios").select("*").eq("id", sess.user.id).single();
      if (e1 || !perfil) { setErrorCtx("Tu cuenta no tiene un perfil asignado. Contacta al administrador."); await supabase.auth.signOut(); return; }
      if (perfil.activo === false) { setErrorCtx("Usuario desactivado. Contacta al administrador."); await supabase.auth.signOut(); return; }
      setProfile(perfil);

      let accesibles = [];
      if (perfil.rol === "admin") {
        const { data } = await supabase.from("locales").select("*").order("nombre");
        accesibles = data || [];
      } else {
        const { data } = await supabase.from("usuario_locales").select("local_id, locales(id,nombre)").eq("usuario_id", sess.user.id);
        accesibles = (data || []).map((r) => r.locales).filter(Boolean).sort((a, b) => a.nombre.localeCompare(b.nombre));
      }
      setLocales(accesibles);
      setLocalActivo((prev) => prev && accesibles.some((l) => l.id === prev) ? prev : (accesibles[0]?.id ?? null));
    } catch (err) {
      setErrorCtx("No se pudo cargar tu información. Revisa la conexión con Supabase.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); cargarContexto(data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => { setSession(sess); cargarContexto(sess); });
    return () => sub.subscription.unsubscribe();
  }, [cargarContexto]);

  const cerrarSesion = async () => { await supabase.auth.signOut(); setProfile(null); setLocalActivo(null); };
  const marcarPasswordCambiada = () => setProfile((p) => (p ? { ...p, debe_cambiar_password: false } : p));

  if (cargando) return <Pantalla><p className="text-gray-300 text-sm">Cargando…</p></Pantalla>;
  if (!session) return <LoginScreen errorCtx={errorCtx} />;
  if (!profile) return <LoginScreen errorCtx={errorCtx} />;
  if (profile.debe_cambiar_password) return <CambiarPasswordScreen profile={profile} onListo={marcarPasswordCambiada} onCancelar={cerrarSesion} />;
  if (!localActivo) return <Pantalla><p className="text-gray-300 text-sm text-center">No tienes ningún local asignado.<br />Contacta al administrador.</p><button onClick={cerrarSesion} className="mt-4 text-xs" style={{ color: "#E3A48E" }}>Cerrar sesión</button></Pantalla>;

  return (
    <Shell
      profile={profile}
      locales={locales}
      localActivo={localActivo}
      setLocalActivo={setLocalActivo}
      onLogout={cerrarSesion}
    />
  );
}

function Pantalla({ children }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "#2E2E2E" }}>
      <style>{FONTS}</style>
      {children}
    </div>
  );
}

// ---------- Login (correo + contraseña) ----------
function LoginScreen({ errorCtx }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    setError(""); setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setCargando(false);
    if (error) setError("Correo o contraseña incorrectos.");
  };

  return (
    <Pantalla>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: "#7C9885" }}>
            <span className="text-white text-3xl" style={{ fontFamily: "'Fraunces', serif" }}>KC</span>
          </div>
          <h1 className="text-white text-2xl" style={{ fontFamily: "'Fraunces', serif" }}>KC Spa</h1>
          <p className="text-gray-300 text-sm">Panel de gestión</p>
        </div>
        <div className="rounded-2xl p-6 shadow-xl" style={{ backgroundColor: "#FBF9F3" }}>
          {errorCtx && <Aviso>{errorCtx}</Aviso>}
          <Field label="Correo"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="correo@ejemplo.com" autoFocus onKeyDown={(e) => e.key === "Enter" && entrar()} /></Field>
          <Field label="Contraseña"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && entrar()} /></Field>
          {error && <p className="text-xs mb-4" style={{ color: "#B4694F" }}>{error}</p>}
          <button onClick={entrar} disabled={cargando} className="w-full px-4 py-2.5 rounded-lg text-sm text-white hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "#2E2E2E", fontFamily: "'Sora', sans-serif" }}>{cargando ? "Ingresando…" : "Ingresar"}</button>
          <p className="mt-5 pt-4 border-t border-[#E7E1D2] text-[11px]" style={{ color: "#7C8F7E" }}>El acceso a cada local y las acciones disponibles dependen de tu rol, definido por el administrador.</p>
        </div>
      </div>
    </Pantalla>
  );
}

// ---------- Primer cambio de contraseña obligatorio ----------
function CambiarPasswordScreen({ profile, onListo, onCancelar }) {
  const [nueva, setNueva] = useState("");
  const [confirma, setConfirma] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const guardar = async () => {
    if (nueva.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (nueva !== confirma) { setError("Las contraseñas no coinciden."); return; }
    setError(""); setCargando(true);
    const { error: e1 } = await supabase.auth.updateUser({ password: nueva });
    if (e1) { setCargando(false); setError("No se pudo actualizar la contraseña: " + e1.message); return; }
    const { error: e2 } = await supabase.from("usuarios").update({ debe_cambiar_password: false }).eq("id", profile.id);
    setCargando(false);
    if (e2) { setError("Contraseña cambiada, pero no se pudo actualizar el estado. Reintenta."); return; }
    onListo();
  };

  return (
    <Pantalla>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: "#7C9885" }}><Lock size={26} className="text-white" /></div>
          <h1 className="text-white text-xl" style={{ fontFamily: "'Fraunces', serif" }}>Crea tu contraseña</h1>
          <p className="text-gray-300 text-sm text-center mt-1">Hola {profile.nombre}. Por seguridad debes establecer una contraseña privada antes de continuar.</p>
        </div>
        <div className="rounded-2xl p-6 shadow-xl" style={{ backgroundColor: "#FBF9F3" }}>
          <Field label="Nueva contraseña"><input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} className={inputClass} placeholder="Mínimo 6 caracteres" autoFocus /></Field>
          <Field label="Repetir contraseña"><input type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} className={inputClass} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && guardar()} /></Field>
          {error && <p className="text-xs mb-4" style={{ color: "#B4694F" }}>{error}</p>}
          <button onClick={guardar} disabled={cargando} className="w-full px-4 py-2.5 rounded-lg text-sm text-white hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "#2E2E2E", fontFamily: "'Sora', sans-serif" }}>{cargando ? "Guardando…" : "Guardar y entrar"}</button>
          <button onClick={onCancelar} className="w-full mt-2 text-xs" style={{ color: "#7C8F7E" }}>Cancelar y salir</button>
        </div>
      </div>
    </Pantalla>
  );
}

// =====================================================================
//  Shell: barra lateral, cambio de local (admin) y navegación por rol
// =====================================================================
function Shell({ profile, locales, localActivo, setLocalActivo, onLogout }) {
  const rol = profile.rol;
  const P = PERMISOS[rol] || {};
  const [tab, setTab] = useState("pacientes");
  const [menuOpen, setMenuOpen] = useState(false);
  const localNombre = locales.find((l) => l.id === localActivo)?.nombre ?? "";

  const NAV = [];
  NAV.push({ key: "dashboard", icon: Calendar, label: "Resumen" });
  if (P.pacCrear || P.pacEditar || rol === "cosmetologa") NAV.push({ key: "pacientes", icon: Users, label: "Pacientes" });
  if (P.seguimiento) NAV.push({ key: "seguimiento", icon: PhoneCall, label: "Seguimiento" });
  NAV.push({ key: "agenda", icon: Calendar, label: "Agenda" });
  if (P.atenciones) NAV.push({ key: "atencion", icon: Stethoscope, label: "Atención" });
  if (P.caja) NAV.push({ key: "caja", icon: Wallet, label: "Caja" });
  if (P.cxc) NAV.push({ key: "cxc", icon: Wallet, label: "Cuentas por cobrar" });
  if (P.inventario) NAV.push({ key: "inventario", icon: Package, label: "Inventario" });
  if (P.balances) NAV.push({ key: "balances", icon: TrendingUp, label: "Balances" });
  if (P.maestros) NAV.push({ key: "maestros", icon: FileText, label: "Maestros" });
  if (P.usuarios) NAV.push({ key: "usuarios", icon: Users, label: "Usuarios" });

  const irA = (k) => { setTab(k); setMenuOpen(false); };

  const NavBtn = ({ item }) => (
    <button onClick={() => irA(item.key)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left ${tab === item.key ? "bg-white text-gray-900" : "text-gray-200 hover:bg-white/10"}`}>
      <item.icon size={18} strokeWidth={1.8} />
      <span className="text-[15px]" style={{ fontFamily: "'Sora', sans-serif" }}>{item.label}</span>
    </button>
  );

  const SelectorLocal = () => locales.length > 1 ? (
    <div className="px-2 mb-3">
      <div className="flex items-center gap-1.5 text-[11px] mb-1" style={{ color: "#A9B9AA" }}><Store size={12} /> Local activo</div>
      <select value={localActivo} onChange={(e) => setLocalActivo(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm bg-white/10 text-white border border-white/20">
        {locales.map((l) => <option key={l.id} value={l.id} style={{ color: "#2E2E2E" }}>{l.nombre}</option>)}
      </select>
    </div>
  ) : null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "#FBF9F3" }}>
      <style>{FONTS}</style>

      {/* Barra superior móvil */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30" style={{ background: "#2E2E2E" }}>
        <span className="text-white text-[16px]" style={{ fontFamily: "'Fraunces', serif" }}>KC Spa</span>
        <button onClick={() => setMenuOpen((v) => !v)} className="text-white">{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
      {menuOpen && (
        <div className="md:hidden flex flex-col gap-1 p-4 z-20" style={{ background: "#2E2E2E" }}>
          <div className="px-4 pb-3 mb-1 border-b border-white/10"><div className="text-white text-sm">{profile.nombre}</div><div className="text-gray-300 text-xs">{ROLES[rol]} · 📍 {localNombre}</div></div>
          <SelectorLocal />
          {NAV.map((it) => <NavBtn key={it.key} item={it} />)}
          <button onClick={onLogout} className="text-left px-4 py-3 rounded-xl hover:bg-white/10 text-[15px]" style={{ color: "#E3A48E" }}>Cerrar sesión</button>
        </div>
      )}

      {/* Sidebar escritorio */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col p-5 gap-1" style={{ background: "#2E2E2E" }}>
        <div className="flex items-center gap-3 px-2 mb-6 mt-1">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#7C9885" }}><span className="text-white text-lg" style={{ fontFamily: "'Fraunces', serif" }}>KC</span></div>
          <div><div className="text-white text-[17px] leading-tight" style={{ fontFamily: "'Fraunces', serif" }}>KC Spa</div><div className="text-gray-300 text-[11px]">panel de gestión</div></div>
        </div>
        <SelectorLocal />
        {NAV.map((it) => <NavBtn key={it.key} item={it} />)}
        <div className="mt-auto pt-4 px-2">
          <div className="pt-4 border-t border-white/10">
            <div className="text-white text-sm">{profile.nombre}</div>
            <div className="text-gray-300 text-xs mb-1">{ROLES[rol]}</div>
            <div className="text-xs mb-3" style={{ color: "#A9B9AA" }}>📍 {localNombre}</div>
            <button onClick={onLogout} className="text-xs hover:underline" style={{ color: "#E3A48E" }}>Cerrar sesión</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-6xl pb-20 md:pb-8">
        {tab === "pacientes" && (P.pacCrear || P.pacEditar || rol === "cosmetologa")
          ? <Pacientes rol={rol} P={P} localId={localActivo} />
          : <EnMigracion titulo={NAV.find((n) => n.key === tab)?.label ?? "Módulo"} />}
      </main>
    </div>
  );
}

function EnMigracion({ titulo }) {
  return (
    <div>
      <SectionTitle eyebrow="En migración" title={titulo} />
      <Card className="p-8 text-center">
        <p className="text-sm text-[#7C8F7E]">Este módulo se está portando a Supabase en los siguientes pasos.<br />La conexión, el login por rol y el módulo de Pacientes ya funcionan sobre la base real.</p>
      </Card>
    </div>
  );
}

// =====================================================================
//  Módulo Pacientes (sobre Supabase, con tipo de piel + alteraciones)
// =====================================================================
function Pacientes({ rol, P, localId }) {
  const [pacientes, setPacientes] = useState([]);
  const [alteraciones, setAlteraciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [activo, setActivo] = useState(null);   // paciente_id abierto en ficha
  const [modal, setModal] = useState(null);      // null | "nuevo" | pacienteObj
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    const [{ data: pac, error: e1 }, { data: alt }] = await Promise.all([
      supabase.from("pacientes").select("*, paciente_alteraciones(alteracion_id)").eq("local_id", localId).order("apellidos"),
      supabase.from("alteraciones_piel").select("*").order("nombre"),
    ]);
    if (e1) setError("No se pudieron cargar los pacientes: " + e1.message);
    setPacientes(pac || []);
    setAlteraciones(alt || []);
    setCargando(false);
  }, [localId]);

  useEffect(() => { cargar(); setActivo(null); }, [cargar]);

  const nombreAlt = (id) => alteraciones.find((a) => a.id === id)?.nombre ?? "";
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return pacientes.filter((p) => !q || `${p.nombres} ${p.apellidos}`.toLowerCase().includes(q) || (p.cedula || "").includes(busqueda));
  }, [pacientes, busqueda]);

  const guardar = async (form, altSeleccionadas, editandoId) => {
    const fila = { ...form, local_id: localId };
    let pacienteId = editandoId;
    if (editandoId) {
      const { error } = await supabase.from("pacientes").update(fila).eq("id", editandoId);
      if (error) return { error: error.message };
    } else {
      const { data, error } = await supabase.from("pacientes").insert(fila).select("id").single();
      if (error) return { error: error.message };
      pacienteId = data.id;
    }
    if (P.pacAlteraciones) {
      await supabase.from("paciente_alteraciones").delete().eq("paciente_id", pacienteId);
      if (altSeleccionadas.length) {
        const { error } = await supabase.from("paciente_alteraciones").insert(altSeleccionadas.map((a) => ({ paciente_id: pacienteId, alteracion_id: a })));
        if (error) return { error: "Paciente guardado, pero fallaron las alteraciones: " + error.message };
      }
    }
    setModal(null);
    await cargar();
    return {};
  };

  const eliminar = async (p) => {
    if (!confirm(`¿Eliminar a ${p.nombres} ${p.apellidos}?`)) return;
    const { error } = await supabase.from("pacientes").delete().eq("id", p.id);
    if (error) { setError("No se pudo eliminar: " + error.message); return; }
    setActivo(null); await cargar();
  };

  if (cargando) return <div><SectionTitle eyebrow="Base de datos" title="Pacientes" /><Card className="p-8 text-center text-sm text-[#7C8F7E]">Cargando pacientes…</Card></div>;

  if (activo) {
    const p = pacientes.find((x) => x.id === activo);
    if (!p) { setActivo(null); return null; }
    const altNombres = (p.paciente_alteraciones || []).map((r) => nombreAlt(r.alteracion_id)).filter(Boolean);
    return (
      <div>
        <button onClick={() => setActivo(null)} className="flex items-center gap-1 text-[#7C9885] text-sm mb-5" style={{ fontFamily: "'Sora', sans-serif" }}><ChevronLeft size={16} />Volver a pacientes</button>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-[24px] text-[#2E2E2E]" style={{ fontFamily: "'Fraunces', serif" }}>{p.nombres} {p.apellidos}</h2>
            <div className="text-sm text-[#7C8F7E]">{p.cedula ? `CI/Pas.: ${p.cedula}` : ""}</div>
          </div>
          <div className="flex gap-2">
            {P.pacEditar && <Boton variant="secondary" onClick={() => setModal(p)}>Editar</Boton>}
            {P.pacEliminar && <Boton variant="secondary" onClick={() => eliminar(p)}>Eliminar</Boton>}
          </div>
        </div>
        <Card className="p-5 mb-4">
          <div className="text-[12px] uppercase tracking-[0.12em] mb-3" style={{ color: "#7C9885", fontFamily: "'Sora', sans-serif" }}>Identificación</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Dato l="Sexo" v={p.sexo} /><Dato l="Nacimiento" v={p.fecha_nacimiento} />
            <Dato l="Teléfono" v={p.telefono} /><Dato l="Correo" v={p.correo} />
            <Dato l="Dirección" v={p.direccion} />
            <Dato l="Emergencia" v={p.emergencia_nombre ? `${p.emergencia_nombre} (${p.emergencia_parentesco || "—"}) · ${p.emergencia_telefono || "—"}` : ""} />
          </div>
        </Card>
        <Card className="p-5 mb-4">
          <div className="text-[12px] uppercase tracking-[0.12em] mb-3" style={{ color: "#7C9885", fontFamily: "'Sora', sans-serif" }}>Piel</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Dato l="Tipo de piel" v={etiquetaTipoPiel(p.tipo_piel)} />
            <div><span className="text-[#A9B9AA]">Alteraciones: </span><span className="text-[#2E2E2E]">{altNombres.length ? altNombres.join(", ") : "—"}</span></div>
          </div>
        </Card>
        {(p.enfermedades_cronicas || p.alergias || p.medicamentos) && (
          <Card className="p-5">
            <div className="text-[12px] uppercase tracking-[0.12em] mb-3" style={{ color: "#7C9885", fontFamily: "'Sora', sans-serif" }}>Antecedentes</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Dato l="Enfermedades crónicas" v={p.enfermedades_cronicas} /><Dato l="Alergias" v={p.alergias} /><Dato l="Medicamentos" v={p.medicamentos} />
            </div>
          </Card>
        )}
        {modal && <ModalPaciente paciente={modal === "nuevo" ? null : modal} alteraciones={alteraciones} puedeAlteraciones={P.pacAlteraciones} onClose={() => setModal(null)} onGuardar={guardar} />}
      </div>
    );
  }

  return (
    <div>
      <SectionTitle eyebrow="Base de datos" title="Pacientes" action={P.pacCrear ? <Boton onClick={() => setModal("nuevo")}><Plus size={16} />Nuevo paciente</Boton> : null} />
      {error && <Aviso>{error}</Aviso>}
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A9B9AA]" />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o cédula…" className={`${inputClass} pl-9`} />
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: "560px" }}>
          <thead>
            <tr className="text-left text-[#7C8F7E] text-xs uppercase tracking-wide border-b border-[#EFE9DA]" style={{ fontFamily: "'Sora', sans-serif" }}>
              <th className="px-3 py-2.5 font-medium">Nombre</th><th className="px-3 py-2.5 font-medium">CI / Pas.</th><th className="px-3 py-2.5 font-medium">Teléfono</th><th className="px-3 py-2.5 font-medium">Tipo de piel</th><th className="px-3 py-2.5 font-medium text-right">Ver</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id} className="border-b border-[#F4EFE2] cursor-pointer hover:bg-[#FBF9F3]" onClick={() => setActivo(p.id)}>
                <td className="px-3 py-2.5 text-[#2E2E2E]">{p.nombres} {p.apellidos}</td>
                <td className="px-3 py-2.5 text-[#7C8F7E]">{p.cedula || "—"}</td>
                <td className="px-3 py-2.5 text-[#7C8F7E]">{p.telefono || "—"}</td>
                <td className="px-3 py-2.5 text-[#7C8F7E]">{etiquetaTipoPiel(p.tipo_piel)}</td>
                <td className="px-3 py-2.5 text-right"><span className="text-xs" style={{ color: "#7C9885" }}>Abrir ficha →</span></td>
              </tr>
            ))}
            {filtrados.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-[#7C8F7E]">No se encontraron pacientes.</td></tr>}
          </tbody>
        </table>
      </Card>
      {modal && <ModalPaciente paciente={modal === "nuevo" ? null : modal} alteraciones={alteraciones} puedeAlteraciones={P.pacAlteraciones} onClose={() => setModal(null)} onGuardar={guardar} />}
    </div>
  );
}

function Dato({ l, v }) {
  if (!v) return null;
  return <div><span className="text-[#A9B9AA]">{l}: </span><span className="text-[#2E2E2E]">{v}</span></div>;
}

function ModalPaciente({ paciente, alteraciones, puedeAlteraciones, onClose, onGuardar }) {
  const [f, setF] = useState({
    cedula: paciente?.cedula ?? "", nombres: paciente?.nombres ?? "", apellidos: paciente?.apellidos ?? "",
    fecha_nacimiento: paciente?.fecha_nacimiento ?? "", sexo: paciente?.sexo ?? "", telefono: paciente?.telefono ?? "",
    correo: paciente?.correo ?? "", direccion: paciente?.direccion ?? "",
    emergencia_nombre: paciente?.emergencia_nombre ?? "", emergencia_parentesco: paciente?.emergencia_parentesco ?? "", emergencia_telefono: paciente?.emergencia_telefono ?? "",
    enfermedades_cronicas: paciente?.enfermedades_cronicas ?? "", alergias: paciente?.alergias ?? "", medicamentos: paciente?.medicamentos ?? "",
    tipo_piel: paciente?.tipo_piel ?? "",
  });
  const [alt, setAlt] = useState((paciente?.paciente_alteraciones || []).map((r) => r.alteracion_id));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleAlt = (id) => setAlt((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);

  const submit = async () => {
    if (!f.nombres.trim() || !f.apellidos.trim()) { setError("Nombres y apellidos son obligatorios."); return; }
    setError(""); setGuardando(true);
    const payload = { ...f, tipo_piel: f.tipo_piel || null, cedula: f.cedula.trim() || null, fecha_nacimiento: f.fecha_nacimiento || null };
    const res = await onGuardar(payload, alt, paciente?.id);
    setGuardando(false);
    if (res?.error) setError(res.error);
  };

  return (
    <Modal title={paciente ? "Editar paciente" : "Nuevo paciente"} onClose={onClose} wide>
      <div className="text-[12px] tracking-[0.12em] uppercase mb-3" style={{ color: "#7C9885", fontFamily: "'Sora', sans-serif" }}>Identificación</div>
      <Field label="Cédula o pasaporte"><input value={f.cedula} onChange={(e) => set("cedula", e.target.value)} className={inputClass} placeholder="0912345678" /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombres *"><input value={f.nombres} onChange={(e) => set("nombres", e.target.value)} className={inputClass} /></Field>
        <Field label="Apellidos *"><input value={f.apellidos} onChange={(e) => set("apellidos", e.target.value)} className={inputClass} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Fecha de nacimiento"><input type="date" value={f.fecha_nacimiento} onChange={(e) => set("fecha_nacimiento", e.target.value)} className={inputClass} /></Field>
        <Field label="Sexo"><select value={f.sexo} onChange={(e) => set("sexo", e.target.value)} className={inputClass}><option value="">Seleccionar…</option><option>Femenino</option><option>Masculino</option><option>Otro</option></select></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Teléfono"><input value={f.telefono} onChange={(e) => set("telefono", e.target.value)} className={inputClass} /></Field>
        <Field label="Correo"><input type="email" value={f.correo} onChange={(e) => set("correo", e.target.value)} className={inputClass} /></Field>
      </div>
      <Field label="Dirección"><input value={f.direccion} onChange={(e) => set("direccion", e.target.value)} className={inputClass} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Contacto emergencia"><input value={f.emergencia_nombre} onChange={(e) => set("emergencia_nombre", e.target.value)} className={inputClass} /></Field>
        <Field label="Parentesco"><input value={f.emergencia_parentesco} onChange={(e) => set("emergencia_parentesco", e.target.value)} className={inputClass} /></Field>
        <Field label="Tel. emergencia"><input value={f.emergencia_telefono} onChange={(e) => set("emergencia_telefono", e.target.value)} className={inputClass} /></Field>
      </div>

      <div className="border-t border-[#E7E1D2] my-4" />
      <div className="text-[12px] tracking-[0.12em] uppercase mb-3" style={{ color: "#7C9885", fontFamily: "'Sora', sans-serif" }}>Piel</div>
      <Field label="Tipo de piel">
        <select value={f.tipo_piel} onChange={(e) => set("tipo_piel", e.target.value)} className={inputClass}>
          <option value="">Seleccionar…</option>
          {TIPOS_PIEL.map((t) => <option key={t} value={t}>{etiquetaTipoPiel(t)}</option>)}
        </select>
      </Field>
      <div className="mb-4">
        <span className="block text-[13px] text-[#5E6E5F] mb-1.5" style={{ fontFamily: "'Sora', sans-serif" }}>Alteraciones de la piel {puedeAlteraciones ? "(selección múltiple)" : ""}</span>
        {!puedeAlteraciones && <p className="text-[11px] mb-2" style={{ color: "#A9B9AA" }}>Tu rol no puede editar alteraciones; las asigna Propietario o Administrador.</p>}
        <div className="flex flex-wrap gap-2">
          {alteraciones.map((a) => {
            const sel = alt.includes(a.id);
            return (
              <button key={a.id} type="button" disabled={!puedeAlteraciones} onClick={() => toggleAlt(a.id)}
                className="text-xs px-3 py-1.5 rounded-full border disabled:opacity-60"
                style={sel ? { backgroundColor: "#7C9885", color: "#fff", borderColor: "#7C9885" } : { backgroundColor: "#fff", color: "#5E6E5F", borderColor: "#DDD6C2" }}>
                {sel && <Check size={12} className="inline mr-1" />}{a.nombre}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[#E7E1D2] my-4" />
      <div className="text-[12px] tracking-[0.12em] uppercase mb-3" style={{ color: "#7C9885", fontFamily: "'Sora', sans-serif" }}>Antecedentes</div>
      <Field label="Enfermedades crónicas"><textarea value={f.enfermedades_cronicas} onChange={(e) => set("enfermedades_cronicas", e.target.value)} rows={2} className={inputClass} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Alergias"><textarea value={f.alergias} onChange={(e) => set("alergias", e.target.value)} rows={2} className={inputClass} /></Field>
        <Field label="Medicamentos actuales"><textarea value={f.medicamentos} onChange={(e) => set("medicamentos", e.target.value)} rows={2} className={inputClass} /></Field>
      </div>

      {error && <p className="text-xs mb-3" style={{ color: "#B4694F" }}>{error}</p>}
      <Boton onClick={submit} disabled={guardando}>{guardando ? "Guardando…" : "Guardar paciente"}</Boton>
    </Modal>
  );
}