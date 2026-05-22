"use client";

import { createContext, ReactNode, useContext } from "react";

export type PublicConfig = {
  googleClientId: string;
  googleAllowedOrigins: string;
  recaptchaSiteKey: string;
};

const defaultConfig: PublicConfig = {
  googleClientId: "",
  googleAllowedOrigins: "",
  recaptchaSiteKey: "",
};

const PublicConfigContext = createContext<PublicConfig>(defaultConfig);

export function PublicConfigProvider({
  value,
  children,
}: {
  value: PublicConfig;
  children: ReactNode;
}) {
  return (
    <PublicConfigContext.Provider value={value}>
      {children}
    </PublicConfigContext.Provider>
  );
}

export function usePublicConfig() {
  return useContext(PublicConfigContext);
}
