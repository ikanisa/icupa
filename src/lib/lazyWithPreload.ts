import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

type PreloadableComponent<T extends ComponentType<any>> = LazyExoticComponent<T> & {
  preload: () => Promise<{ default: T }>;
};

export const lazyWithPreload = <T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) => {
  const LazyComponent = lazy(factory) as PreloadableComponent<T>;
  LazyComponent.preload = factory;
  return LazyComponent;
};

export type LazyWithPreload<T extends ComponentType<any> = ComponentType<any>> = PreloadableComponent<T>;
