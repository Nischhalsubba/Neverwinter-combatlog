import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "md-filled-button": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { disabled?: boolean };
      "md-filled-tonal-button": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { disabled?: boolean };
      "md-outlined-button": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { disabled?: boolean };
      "md-text-button": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { disabled?: boolean };
      "md-assist-chip": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
      "md-divider": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
      "md-icon": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
      "md-list": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
      "md-list-item": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
      "md-circular-progress": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { indeterminate?: boolean };
      "md-linear-progress": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { value?: number };
      "md-switch": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { selected?: boolean };
      "md-tabs": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
      "md-primary-tab": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
      "md-outlined-text-field": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        label?: string;
        value?: string;
      };
      "md-checkbox": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { checked?: boolean };
    }
  }
}

