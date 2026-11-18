import crypto from "node:crypto";

// TOTP (RFC 6238) sobre HOTP (RFC 4226): SHA-1, 6 dígitos, pasos de 30 s.
export const PERIODO_SEGUNDOS = 30;
const ALFABETO_BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const LONGITUD_CODIGO = 6;

function base32Codificar(buffer: Buffer): string {
  let bits = 0;
  let valor = 0;
  let salida = "";

  for (const byte of buffer) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO_BASE32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += ALFABETO_BASE32[(valor << (5 - bits)) & 31];
  return salida;
}

function base32Decodificar(texto: string): Buffer {
  const limpio = texto.replace(/[=\s-]/g, "").toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let valor = 0;

  for (const caracter of limpio) {
    const indice = ALFABETO_BASE32.indexOf(caracter);
    if (indice < 0) continue;
    valor = (valor << 5) | indice;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secreto: Buffer, contador: number): string {
  const paso = Buffer.alloc(8);
  paso.writeBigUInt64BE(BigInt(contador));

  const digest = crypto.createHmac("sha1", secreto).update(paso).digest();
  const posicion = digest[digest.length - 1] & 0x0f;
  const binario =
    ((digest[posicion] & 0x7f) << 24) |
    ((digest[posicion + 1] & 0xff) << 16) |
    ((digest[posicion + 2] & 0xff) << 8) |
    (digest[posicion + 3] & 0xff);

  return String(binario % 10 ** LONGITUD_CODIGO).padStart(LONGITUD_CODIGO, "0");
}

function igualesEnTiempoConstante(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
}

export function normalizarCodigo(codigo: string): string {
  return codigo.replace(/\D/g, "").slice(0, LONGITUD_CODIGO);
}

export function generarSecreto(bytes = 20): string {
  return base32Codificar(crypto.randomBytes(bytes));
}

export function codigoTotp(secreto: string, fecha = Date.now()): string {
  const contador = Math.floor(fecha / 1000 / PERIODO_SEGUNDOS);
  return hotp(base32Decodificar(secreto), contador);
}

// Acepta el paso actual y uno anterior/posterior para tolerar desfase de reloj.
export function verificarTotp(secreto: string, codigo: string, ventana = 1): boolean {
  const limpio = normalizarCodigo(codigo);
  if (limpio.length !== LONGITUD_CODIGO) return false;

  const clave = base32Decodificar(secreto);
  const contador = Math.floor(Date.now() / 1000 / PERIODO_SEGUNDOS);

  for (let desfase = -ventana; desfase <= ventana; desfase += 1) {
    if (igualesEnTiempoConstante(hotp(clave, contador + desfase), limpio)) return true;
  }
  return false;
}

export function urlOtpauth(secreto: string, email: string, emisor = "Ingeniería SEI"): string {
  const etiqueta = encodeURIComponent(`${emisor}:${email}`);
  const parametros = new URLSearchParams({
    secret: secreto,
    issuer: emisor,
    algorithm: "SHA1",
    digits: String(LONGITUD_CODIGO),
    period: String(PERIODO_SEGUNDOS),
  });
  return `otpauth://totp/${etiqueta}?${parametros.toString()}`;
}

export function generarCodigosRespaldo(cantidad = 8): string[] {
  return Array.from({ length: cantidad }, () => {
    const texto = base32Codificar(crypto.randomBytes(5)).slice(0, 8);
    return `${texto.slice(0, 4)}-${texto.slice(4, 8)}`;
  });
}

export function hashCodigoRespaldo(codigo: string): string {
  const limpio = codigo.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return crypto.createHash("sha256").update(limpio).digest("hex");
}

// Devuelve los hashes restantes cuando el código coincide; null si no es válido.
export function consumirCodigoRespaldo(
  hashes: string[] | null | undefined,
  codigo: string,
): string[] | null {
  if (!hashes?.length) return null;
  const objetivo = hashCodigoRespaldo(codigo);
  if (!hashes.some((hash) => igualesEnTiempoConstante(hash, objetivo))) return null;
  return hashes.filter((hash) => hash !== objetivo);
}
