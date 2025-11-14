// Provide React-like typings backed by Preact so we don't need @types/react.
// This ensures named imports like `{ useEffect } from 'react'` type-check.
declare module 'react' {
  // Hooks and related utilities
  export {
    useState,
    useEffect,
    useLayoutEffect,
    useRef,
    useMemo,
    useCallback,
    useContext,
    useReducer,
    useImperativeHandle,
    useId,
  } from 'preact/hooks';

  // Additional React 18 hook aliases supported by Preact compat
  import type { useLayoutEffect as _useLayoutEffect } from 'preact/hooks';
  export const useInsertionEffect: typeof _useLayoutEffect;
  export function useTransition(): [false, typeof startTransition];
  export function useDeferredValue<T = unknown>(val: T): T;
  export function useSyncExternalStore<T>(
    subscribe: (flush: () => void) => () => void,
    getSnapshot: () => T
  ): T;

  // Core React APIs mapped from compat
  import * as Compat from 'preact/compat';
  export const Children: typeof Compat.Children;
  export const Fragment: typeof Compat.Fragment;
  export const StrictMode: typeof Compat.Fragment;
  export const version: string;
  export const startTransition: typeof Compat.startTransition;
  export const createElement: typeof Compat.createElement;
  export const cloneElement: typeof Compat.cloneElement;
  export const createContext: typeof Compat.createContext;
  export const createRef: typeof Compat.createRef;
  export const forwardRef: typeof Compat.forwardRef;
  export const memo: typeof Compat.memo;
  export const Suspense: typeof Compat.Suspense;
  export const lazy: typeof Compat.lazy;
  export const flushSync: typeof Compat.flushSync;
  export const unstable_batchedUpdates: typeof Compat.unstable_batchedUpdates;

  // Types commonly consumed from 'react'
  export type Ref<T> = Compat.Ref<T>;
  export type RefObject<T> = Compat.RefObject<T>;
  export type ComponentType<P = unknown> = Compat.ComponentType<P>;
  export type FunctionComponent<P = unknown> = Compat.FunctionComponent<P>;
  export type FC<P = unknown> = Compat.FunctionComponent<P>;
  export type ComponentProps<T extends ComponentType> =
    Compat.ComponentProps<T>;
  export type PropsWithChildren<P = unknown> = P & {
    children?: import('preact').ComponentChildren | undefined;
  };
  export type ReactNode = import('preact').ComponentChild;
  export type ReactElement = import('preact').VNode;
  export type ErrorInfo = import('preact').ErrorInfo;
  export { Component, PureComponent } from 'preact/compat';

  // Default export mirrors compat default for interop
  const ReactDefault: typeof Compat;
  export default ReactDefault;
}

declare module 'react-dom' {
  import * as Compat from 'preact/compat';
  export const render: typeof Compat.render;
  export const hydrate: typeof Compat.hydrate;
  export const createPortal: typeof Compat.createPortal;
  export function findDOMNode(
    component: import('preact').Component | Element
  ): Element | null;
  const ReactDomDefault: typeof Compat;
  export default ReactDomDefault;
}

declare module 'react/jsx-runtime' {
  export * from 'preact/jsx-runtime';
}

declare module 'react/jsx-dev-runtime' {
  export * from 'preact/jsx-dev-runtime';
}
