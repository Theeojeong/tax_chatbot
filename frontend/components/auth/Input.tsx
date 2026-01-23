import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  endIcon?: React.ReactNode;
  onEndIconClick?: () => void;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  endIcon,
  onEndIconClick,
  helperText,
  className = "",
  ...props
}) => {
  return (
    <div className="flex flex-col gap-2 mb-4 w-full">
      <label className="flex flex-col w-full group">
        <p className="text-slate-700 dark:text-slate-200 text-sm font-medium pb-2 transition-colors group-focus-within:text-primary">
          {label}
        </p>
        <div className="relative flex w-full items-center">
          <input
            className={`
              flex w-full rounded-lg 
              text-slate-900 dark:text-white 
              bg-white dark:bg-input-dark 
              border border-gray-300 dark:border-white/10 
              h-12 px-4 text-base font-normal
              placeholder:text-slate-400 dark:placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
              transition-all duration-200
              ${endIcon ? "pr-10" : ""}
              ${className}
            `}
            {...props}
          />
          {endIcon && (
            <div
              onClick={onEndIconClick}
              className="absolute right-3 text-slate-400 dark:text-slate-500 cursor-pointer hover:text-primary transition-colors"
            >
              {endIcon}
            </div>
          )}
        </div>
      </label>
      {helperText && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-[-4px]">
          {helperText}
        </p>
      )}
    </div>
  );
};
