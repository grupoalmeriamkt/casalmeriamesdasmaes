import { createContext, useContext, type ReactNode } from "react";

const PreviewCtx = createContext<boolean>(false);

export function PreviewProvider({ children }: { children: ReactNode }) {
  return <PreviewCtx.Provider value={true}>{children}</PreviewCtx.Provider>;
}

export function useIsPreview(): boolean {
  return useContext(PreviewCtx);
}
