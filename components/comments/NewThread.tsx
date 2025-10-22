"use client";

import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export const NewThread = ({ children }: Props) => {
  // Disabled during Liveblocks migration
  return <>{children}</>;
};
