import MDBReader from 'mdb-reader';

/** Instancia MDBReader (paquete externalizado en servidor vía next.config). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MdbReaderInstance = any;

export function createMdbReader(buffer: Buffer, password?: string): MdbReaderInstance {
  return new MDBReader(buffer, password ? { password } : undefined);
}
