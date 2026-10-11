import type * as React from "react";
import { Button } from "./Button";
import { cn } from "./utils";

export interface NavButtonProps extends Omit<React.ComponentProps<typeof Button>, "variant" | "size"> {
  isActive?: boolean;
  collapsed?: boolean;
}

function NavButton({ isActive, collapsed, className, children, asChild, type, ...props }: NavButtonProps) {
  return (
    <Button
      asChild={asChild}
      type={asChild ? undefined : (type ?? "button")}
      variant="ghost"
      className={cn(
        "relative h-auto justify-start gap-3 rounded-none transition-all duration-200 cursor-pointer",
        "before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-foreground before:transition-[scale,opacity] before:duration-200 before:ease-out",
        collapsed ? "h-10 w-10 justify-center rounded-lg p-0" : "px-5 py-2",
        isActive
          ? "bg-transparent text-foreground font-bold before:scale-y-100 before:opacity-100"
          : "text-muted-foreground hover:bg-transparent hover:text-foreground font-medium before:scale-y-0 before:opacity-0 hover:before:scale-y-50 hover:before:opacity-30 focus-visible:before:scale-y-50 focus-visible:before:opacity-30",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

export { NavButton };
