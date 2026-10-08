/**
 * Métodos que la aplicación usa y que faltan en los Chrome y Safari que aún
 * corren en Macs viejas. Sin esto el paquete carga pero la pantalla queda en
 * blanco al primer uso. Cada uno se define solo si el navegador no lo trae.
 */

if (!(Object as any).hasOwn) {
  Object.defineProperty(Object, 'hasOwn', {
    value: function hasOwn(objetivo: unknown, propiedad: PropertyKey): boolean {
      return Object.prototype.hasOwnProperty.call(objetivo as object, propiedad);
    },
    configurable: true,
    writable: true,
  });
}

if (!(Array.prototype as any).at) {
  Object.defineProperty(Array.prototype, 'at', {
    value: function at(this: unknown[], posicion: number): unknown {
      const indice = Math.trunc(posicion) || 0;
      return this[indice < 0 ? this.length + indice : indice];
    },
    configurable: true,
    writable: true,
  });
}

if (!(String.prototype as any).at) {
  Object.defineProperty(String.prototype, 'at', {
    value: function at(this: string, posicion: number): string | undefined {
      const indice = Math.trunc(posicion) || 0;
      return this[indice < 0 ? this.length + indice : indice];
    },
    configurable: true,
    writable: true,
  });
}

if (!(String.prototype as any).replaceAll) {
  Object.defineProperty(String.prototype, 'replaceAll', {
    value: function replaceAll(this: string, buscado: string | RegExp, reemplazo: any): string {
      if (buscado instanceof RegExp) {
        if (!buscado.global) {
          throw new TypeError('replaceAll must be called with a global RegExp');
        }
        return this.replace(buscado, reemplazo);
      }
      return this.split(String(buscado)).join(String(reemplazo));
    },
    configurable: true,
    writable: true,
  });
}

if (!(Array.prototype as any).findLast) {
  Object.defineProperty(Array.prototype, 'findLast', {
    value: function findLast(this: unknown[], condicion: (valor: any, indice: number, lista: any[]) => boolean, contexto?: any): unknown {
      for (let indice = this.length - 1; indice >= 0; indice -= 1) {
        if (condicion.call(contexto, this[indice], indice, this)) return this[indice];
      }
      return undefined;
    },
    configurable: true,
    writable: true,
  });
}

if (!(Array.prototype as any).findLastIndex) {
  Object.defineProperty(Array.prototype, 'findLastIndex', {
    value: function findLastIndex(this: unknown[], condicion: (valor: any, indice: number, lista: any[]) => boolean, contexto?: any): number {
      for (let indice = this.length - 1; indice >= 0; indice -= 1) {
        if (condicion.call(contexto, this[indice], indice, this)) return indice;
      }
      return -1;
    },
    configurable: true,
    writable: true,
  });
}

export {};
