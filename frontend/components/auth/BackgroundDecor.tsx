import React from "react";

export const BackgroundDecor: React.FC = () => {
  return (
    <>
      <div className="fixed -bottom-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      <div className="fixed -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>

      {/* Additional ambient glows from signup design */}
      <div
        className="fixed -bottom-32 -left-32 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[128px] -z-10 pointer-events-none opacity-40 dark:opacity-20 animate-pulse"
        style={{ animationDuration: "8s" }}
      />
      <div
        className="fixed -top-32 -right-32 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[128px] -z-10 pointer-events-none opacity-40 dark:opacity-20 animate-pulse"
        style={{ animationDuration: "10s", animationDelay: "1s" }}
      />

      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 -z-10 pointer-events-none mix-blend-overlay"></div>
    </>
  );
};
