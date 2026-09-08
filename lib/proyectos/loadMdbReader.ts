import MDBReader from 'mdb-reader';

/** Instancia MDBReader (paquete externalizado en servidor vía next.config). */
export type MdbReaderInstance = InstanceType<typeof MDBReader>;

export function createMdbReader(buffer: Buffer, password?: string): MdbReaderInstance {
  return new MDBReader(buffer, password ? { password } : undefined);
}
