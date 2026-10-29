import { useState } from 'react';
import { api } from '../api';
import { Proveedor } from '../types';
import { Campo, Modal, useToast } from './ui';

export default function ProveedorForm({ proveedor, onClose, onGuardado }: { proveedor?: Proveedor; onClose: () => void; onGuardado: (p: Proveedor) => void }) {
  const avisar = useToast();
  const [f, setF] = useState({
    ruc: proveedor?.ruc ?? '',
    razonSocial: proveedor?.razonSocial ?? '',
    nombreComercial: proveedor?.nombreComercial ?? '',
    telefono: proveedor?.telefono ?? '',
    email: proveedor?.email ?? '',
    direccion: proveedor?.direccion ?? '',
    contacto: proveedor?.contacto ?? '',
    activo: proveedor?.activo ?? true,
  });
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  const guardar = async () => {
    setEnviando(true);
    const vacio = (v: string) => v.trim() || undefined;
    try {
      const p = await api<Proveedor>(proveedor ? `/proveedores/${proveedor.id}` : '/proveedores', {
        method: proveedor ? 'PATCH' : 'POST',
        body: {
          ruc: vacio(f.ruc),
          razonSocial: f.razonSocial.trim().toUpperCase(),
          nombreComercial: vacio(f.nombreComercial),
          telefono: vacio(f.telefono),
          email: vacio(f.email),
          direccion: vacio(f.direccion),
          contacto: vacio(f.contacto),
          activo: f.activo,
        },
      });
      avisar(proveedor ? 'Proveedor actualizado' : 'Proveedor creado');
      onGuardado(p);
    } catch (e) {
      avisar((e as Error).message, true);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}
      onClose={onClose}
      pie={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={enviando || f.razonSocial.trim().length < 2}>Guardar</button>
        </>
      }
    >
      <div className="grid-2">
        <Campo label="RUC"><input className="mono" value={f.ruc} onChange={(e) => set('ruc', e.target.value.replace(/\D/g, ''))} maxLength={11} autoFocus /></Campo>
        <Campo label="Nombre comercial"><input value={f.nombreComercial} onChange={(e) => set('nombreComercial', e.target.value)} placeholder="Ej. Backus" /></Campo>
        <Campo label="Razón social" className="span-2"><input value={f.razonSocial} onChange={(e) => set('razonSocial', e.target.value)} /></Campo>
        <Campo label="Contacto / vendedor"><input value={f.contacto} onChange={(e) => set('contacto', e.target.value)} /></Campo>
        <Campo label="Teléfono"><input value={f.telefono} onChange={(e) => set('telefono', e.target.value)} /></Campo>
        <Campo label="Correo"><input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Campo>
        <Campo label="Dirección"><input value={f.direccion} onChange={(e) => set('direccion', e.target.value)} /></Campo>
        {proveedor && (
          <label className="check"><input type="checkbox" checked={f.activo} onChange={(e) => set('activo', e.target.checked)} /> Activo</label>
        )}
      </div>
    </Modal>
  );
}
