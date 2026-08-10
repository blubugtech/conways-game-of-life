declare module 'gifenc' {
  export function GIFEncoder(): any;
  export function quantize(rgba: any, maxColors: number, options?: any): any;
  export function applyPalette(rgba: any, palette: any, options?: any): any;
}
