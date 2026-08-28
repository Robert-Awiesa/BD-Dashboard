import { createContext } from 'react';

// The context object lives alone so the provider file exports nothing but a
// component and the hook file exports nothing but a hook. Fast refresh only
// works on a module whose exports are all components, and mixing the three in
// one file is what broke it.
export const DashboardContext = createContext(null);
