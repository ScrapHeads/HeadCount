export const DASHBOARD_GRADIENT_CLASS_NAME = 'bg-[linear-gradient(135deg,color-mix(in_oklab,var(--app-primary)_88%,transparent)_0%,color-mix(in_oklab,var(--app-primary)_72%,var(--app-accent))_58%,color-mix(in_oklab,var(--app-accent)_72%,transparent)_100%)] backdrop-blur-sm';

export const DASHBOARD_CARD_CLASS_NAME = `rounded-[1.75rem] border border-on-primary/15 ${DASHBOARD_GRADIENT_CLASS_NAME} p-6 shadow-lg shadow-primary/15`;

export const FORM_CONTROL_CLASS_NAME = 'w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-on-secondary outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15';

export const FORM_INPUT_CLASS_NAME = `${FORM_CONTROL_CLASS_NAME} placeholder:text-on-secondary/90`;

export const FORM_TEXTAREA_CLASS_NAME = `${FORM_CONTROL_CLASS_NAME} placeholder:text-on-secondary/70`;

export const DASHBOARD_TABLE_HEADER_CLASS_NAME = 'px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-on-primary';
