import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import forge from 'node-forge';
import { networkInterfaces } from 'os';
import { join, resolve } from 'path';

/**
 * HTTPS en la red de la tienda sin internet ni dominio: la PC tiene su propia
 * autoridad (CA) y con ella firma el certificado de su IP. Cada celular
 * instala la CA una sola vez; el certificado de la IP se renueva solo
 * (al arrancar y cada día) sin que los celulares tengan que hacer nada.
 */
export const CARPETA_CERT = resolve(process.env.CERT_RED_DIR ?? join(process.cwd(), 'certificados-red'));
const CA_KEY = join(CARPETA_CERT, 'ca.key');
const CA_CRT = join(CARPETA_CERT, 'ca.crt');
const SRV_KEY = join(CARPETA_CERT, 'servidor.key');
const SRV_CRT = join(CARPETA_CERT, 'servidor.crt');

// iPhone no acepta certificados de servidor de más de 825 días.
const DIAS_SERVIDOR = 800;
const RENOVAR_ANTES_DIAS = 60;
export const NOMBRE_LOCAL = 'ventascandys.local';

export const puertos = {
  https: Number(process.env.HTTPS_PORT ?? 3443),
  http: Number(process.env.RED_HTTP_PORT ?? 3080),
};

/** IPv4 de la PC en la red local. RED_IP fija la que va en el QR. */
export function ipsLocales(): string[] {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i!.address);
  const fija = process.env.RED_IP?.trim();
  return [...new Set([...(fija ? [fija] : []), ...ips])];
}

export function ipPrincipal(): string {
  const fija = process.env.RED_IP?.trim();
  if (fija) return fija;
  const ips = ipsLocales();
  return ips.find((ip) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) ?? ips[0] ?? '127.0.0.1';
}

export interface Certificados {
  key: string;
  cert: string;
  ca: string;
  vence: Date;
}

/** Crea la CA si falta y renueva el certificado de la IP si vence pronto o cambió la IP. */
export function asegurarCertificados(ips = ipsLocales()): Certificados {
  mkdirSync(CARPETA_CERT, { recursive: true, mode: 0o700 });
  const ca = cargarOCrearCa();
  const actual = leerServidor();
  const limite = Date.now() + RENOVAR_ANTES_DIAS * 86_400_000;
  const faltanIps = actual && ips.some((ip) => !actual.ips.includes(ip));
  if (!actual || actual.vence.getTime() < limite || faltanIps) {
    crearServidor(ca, ips);
  }
  const final = leerServidor()!;
  return { key: readFileSync(SRV_KEY, 'utf8'), cert: readFileSync(SRV_CRT, 'utf8'), ca: readFileSync(CA_CRT, 'utf8'), vence: final.vence };
}

export function caPem(): string {
  return readFileSync(CA_CRT, 'utf8');
}

function cargarOCrearCa() {
  if (existsSync(CA_KEY) && existsSync(CA_CRT)) {
    return {
      key: forge.pki.privateKeyFromPem(readFileSync(CA_KEY, 'utf8')),
      cert: forge.pki.certificateFromPem(readFileSync(CA_CRT, 'utf8')),
    };
  }
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = serial();
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 20 * 365 * 86_400_000);
  const nombre = [
    { name: 'commonName', value: "Candy's Market CA local" },
    { name: 'organizationName', value: "Candy's Market" },
  ];
  cert.setSubject(nombre);
  cert.setIssuer(nombre);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  writeFileSync(CA_KEY, forge.pki.privateKeyToPem(keys.privateKey), { mode: 0o600 });
  writeFileSync(CA_CRT, forge.pki.certificateToPem(cert));
  return { key: keys.privateKey, cert };
}

function crearServidor(ca: { key: forge.pki.rsa.PrivateKey; cert: forge.pki.Certificate }, ips: string[]) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = serial();
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + DIAS_SERVIDOR * 86_400_000);
  cert.setSubject([{ name: 'commonName', value: ipPrincipal() }]);
  cert.setIssuer(ca.cert.subject.attributes);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
    { name: 'extKeyUsage', serverAuth: true },
    {
      name: 'subjectAltName',
      altNames: [
        ...[...new Set([...ips, '127.0.0.1'])].map((ip) => ({ type: 7, ip })),
        { type: 2, value: 'localhost' },
        { type: 2, value: NOMBRE_LOCAL },
      ],
    },
    { name: 'subjectKeyIdentifier' },
    { name: 'authorityKeyIdentifier', keyIdentifier: ca.cert.generateSubjectKeyIdentifier().getBytes() },
  ]);
  cert.sign(ca.key, forge.md.sha256.create());
  writeFileSync(SRV_KEY, forge.pki.privateKeyToPem(keys.privateKey), { mode: 0o600 });
  writeFileSync(SRV_CRT, forge.pki.certificateToPem(cert));
}

function leerServidor(): { vence: Date; ips: string[] } | null {
  if (!existsSync(SRV_KEY) || !existsSync(SRV_CRT)) return null;
  try {
    const cert = forge.pki.certificateFromPem(readFileSync(SRV_CRT, 'utf8'));
    const san = cert.getExtension('subjectAltName') as { altNames?: { type: number; ip?: string }[] } | undefined;
    return { vence: cert.validity.notAfter, ips: (san?.altNames ?? []).filter((a) => a.type === 7).map((a) => a.ip!) };
  } catch {
    return null;
  }
}

function serial() {
  return '01' + forge.util.bytesToHex(forge.random.getBytesSync(15));
}
