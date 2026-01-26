import React from "react";
import Link from "next/link";
import Image from "next/image";

export const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-[#e5e7eb] dark:border-white/5 px-6 md:px-10 py-3 bg-white/50 dark:bg-background-dark/50 backdrop-blur z-20 sticky top-0">
      <div className="flex items-center gap-4 text-slate-900 dark:text-white">
        <div className="size-8 flex items-center justify-center rounded-lg overflow-hidden bg-transparent">
          <Image src="/icon" alt="세무톡" width={32} height={32} priority />
        </div>
        <h2 className="text-slate-900 dark:text-white text-3xl font-dohyeon leading-tight tracking-[-0.015em]">
          세무톡
        </h2>
      </div>
      <div className="flex items-center gap-4">
        {/* We can add buttons here if needed, or leave empty for cleaner look on auth pages, 
            since the pages themselves have "Sign up" / "Login" links in the form footer.
            But the original design had a button. Let's make it contextual or just a Home link?
            For login/signup pages, usually you want distraction-free. 
            However, I'll add a 'Home' or 'Support' link if needed later. 
            For now, I'll replicate the style but maybe empty right side or just no button.
        */}
      </div>
    </header>
  );
};
