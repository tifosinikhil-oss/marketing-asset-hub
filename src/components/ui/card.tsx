import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-xl border bg-[var(--color-card)] text-[var(--color-card-foreground)] shadow-sm", className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const CardHeader = ({ className, ...props }: React.ComponentPropsWithoutRef<"div">) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
);

export const CardTitle = ({ className, ...props }: React.ComponentPropsWithoutRef<"h3">) => (
  <h3 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
);

export const CardDescription = ({ className, ...props }: React.ComponentPropsWithoutRef<"p">) => (
  <p className={cn("text-sm text-[var(--color-muted-foreground)]", className)} {...props} />
);

export const CardContent = ({ className, ...props }: React.ComponentPropsWithoutRef<"div">) => (
  <div className={cn("p-6 pt-0", className)} {...props} />
);

export const CardFooter = ({ className, ...props }: React.ComponentPropsWithoutRef<"div">) => (
  <div className={cn("flex items-center p-6 pt-0", className)} {...props} />
);
