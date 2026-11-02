// Storage is fixed at build time; visitors cannot switch it with a URL parameter.
export const SITE_MODE = 'browser' as 'private' | 'review' | 'browser';
export const isReviewDemo = () => SITE_MODE === 'review';
export const isBrowserLocal = () => SITE_MODE === 'browser';
