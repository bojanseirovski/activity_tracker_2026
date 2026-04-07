/// <reference types="react-scripts" />

import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ion-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { name?: string; size?: string; color?: string }, HTMLElement>;
    }
  }
}
