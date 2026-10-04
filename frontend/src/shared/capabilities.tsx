import { createContext, useContext, type ReactNode } from "react";
import { ApiFailure } from "./api";
import { ErrorNotice } from "./ui";
export const CapabilityContext = createContext<any>(null);
export function capabilityAvailable(value: any, key: string) {
  return value?.capabilities?.[key]?.status === "implemented";
}
export function CapabilityGate({
  capability,
  children,
}: {
  capability: string;
  children: ReactNode;
}) {
  const manifest = useContext(CapabilityContext),
    entry = manifest?.capabilities?.[capability];
  if (!capabilityAvailable(manifest, capability))
    return (
      <ErrorNotice
        error={
          new ApiFailure(entry?.message ?? "服务未声明此能力，当前不能启用。", {
            status: 501,
            code: "FEATURE_NOT_IMPLEMENTED",
            capability,
            retryable: false,
          })
        }
      />
    );
  return <>{children}</>;
}
