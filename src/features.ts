// Features that are built but not switched on for the live site yet. They show in local
// development (npm start) and in tests; for a production build, set the env var to 'on'.

// The invader shooter below the runner, and its treasure-hunt fragment.
export const INVADERS_ENABLED = process.env.NODE_ENV !== 'production' || process.env.REACT_APP_INVADERS === 'on';
