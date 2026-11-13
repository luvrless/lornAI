/**
 * Minimal React typings. @types/react isn't installable in this build
 * environment; these keep hook/state logic type-checked while JSX props are
 * permissive. Replace with @types/react + @types/react-dom when available.
 */
declare namespace React {
  type ReactNode = any;
  type CSSProperties = Record<string, any>;
  type Key = string | number;
  interface RefObject<T> { readonly current: T }
  interface MutableRefObject<T> { current: T }
  type SetStateAction<S> = S | ((prev: S) => S);
  type Dispatch<A> = (value: A) => void;
  type SyntheticEvent<T = any> = any;
  type FormEvent<T = any> = any;
  type MouseEvent<T = any> = any;
  type PointerEvent<T = any> = any;
  type ChangeEvent<T = any> = any;
  type DragEvent<T = any> = any;
  type KeyboardEvent<T = any> = any;
  type ButtonHTMLAttributes<T = any> = Record<string, any>;
  type InputHTMLAttributes<T = any> = Record<string, any>;
  interface SVGAttributes<T = any> { [k: string]: any }
  interface HTMLAttributes<T = any> { [k: string]: any }
  type FC<P = {}> = (props: P) => any;
  type ComponentType<P = {}> = (props: P) => any;
}

declare namespace JSX {
  type Element = any;
  interface IntrinsicElements { [name: string]: any }
  interface ElementChildrenAttribute { children: {} }
  interface IntrinsicAttributes { key?: React.Key }
}

declare module "react" {
  export type ReactNode = React.ReactNode;
  export type CSSProperties = React.CSSProperties;
  export type RefObject<T> = React.RefObject<T>;
  export type MouseEvent<T = any> = any;
  export type FormEvent<T = any> = any;
  export interface SVGAttributes<T = any> { [k: string]: any }
  export class Component<P = {}, S = {}> {
    constructor(props: P);
    props: Readonly<P>;
    state: S;
    setState(s: Partial<S> | ((prev: S) => Partial<S>)): void;
    render(): React.ReactNode;
  }
  export interface HTMLAttributes<T = any> { [k: string]: any }
  export type ComponentType<P = {}> = (props: P) => any;
  export function useState<S>(initial: S | (() => S)): [S, React.Dispatch<React.SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, React.Dispatch<React.SetStateAction<S | undefined>>];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: readonly unknown[]): T;
  export function useRef<T>(initial: T): React.MutableRefObject<T>;
  export function useRef<T>(initial: T | null): React.RefObject<T | null>;
  export function useRef<T = undefined>(): React.MutableRefObject<T | undefined>;
  export function useId(): string;
  export function useSyncExternalStore<T>(subscribe: (cb: () => void) => () => void, get: () => T, getServer?: () => T): T;
  export interface Context<T> { Provider: any; Consumer: any }
  export function createContext<T>(value: T): Context<T>;
  export function useContext<T>(ctx: Context<T>): T;
  export function forwardRef<R, P = {}>(render: (props: P, ref: any) => any): (props: P & { ref?: any }) => any;
  export function useImperativeHandle<R>(ref: any, create: () => R, deps?: readonly unknown[]): void;
  export function createElement(type: any, props?: any, ...children: any[]): any;
  export const Fragment: any;
  const React: any;
  export default React;
}
declare module "react/jsx-runtime" { export const jsx: any; export const jsxs: any; export const Fragment: any; }
declare module "react-dom" { export function createPortal(node: any, el: Element): any; }
declare module "react-dom/client" { export function createRoot(el: Element): { render(node: any): void; unmount(): void }; export function hydrateRoot(el: Element, node: any): any; }
declare module "react-dom/server" { export function renderToString(node: any): string; }
declare module "*.css";
