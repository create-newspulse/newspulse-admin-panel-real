// src/types/react-i18next.d.ts

import type {
  ReactOptions,
  i18n,
  Resource,
  FlatNamespace,
  Namespace,
  TypeOptions,
  TFunction,
  KeyPrefix,
} from 'i18next';
import * as React from 'react';

type ObjectOrNever = TypeOptions['allowObjectInHTMLChildren'] extends true
  ? Record<string, unknown>
  : never;

type ReactI18NextChildren = React.ReactNode | ObjectOrNever;

declare module 'react' {
  namespace JSX {
    interface IntrinsicAttributes {
      i18nIsDynamicList?: boolean;
    }
  }

  interface HTMLAttributes<T> {
    children?: ReactI18NextChildren | Iterable<ReactI18NextChildren>;
  }
}
