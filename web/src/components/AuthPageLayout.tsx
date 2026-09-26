import { Link } from "react-router-dom";
import { useInstance } from "@/contexts/InstanceContext";
import AuthFooter from "./AuthFooter";

interface Props {
  chip?: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const AuthChip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-accent/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
    {children}
  </span>
);

export const AuthEmptyState = ({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center py-2 text-center">
    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-muted-foreground">{icon}</div>
    <p className="text-sm font-medium text-foreground">{title}</p>
    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    {children}
  </div>
);

export const AuthLinkPrompt = ({ prompt, to, label }: { prompt: string; to: string; label: string }) => (
  <p className="mt-5 text-center text-sm text-muted-foreground">
    {prompt}{" "}
    <Link to={to} className="text-primary hover:underline" viewTransition>
      {label}
    </Link>
  </p>
);

export const AuthOptionsLoading = () => <div className="h-9 w-full animate-pulse rounded-md bg-muted/60" aria-hidden="true" />;

const AuthPageLayout = ({ chip, title, subtitle, children }: Props) => {
  const { generalSetting } = useInstance();

  return (
    <div className="min-h-svh w-full flex flex-col items-center px-4 py-4 sm:py-8">
      <div className="w-full grow flex flex-col justify-center items-center">
        <div className="w-90 max-w-full rounded-xl border border-border bg-card p-7 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <img className="h-6 w-auto rounded-full" src={generalSetting.customProfile?.logoUrl || "/logo.webp"} alt="" />
            <span className="text-sm font-semibold text-foreground">{generalSetting.customProfile?.title || "Memos"}</span>
          </div>
          {chip && <div className="mb-2">{chip}</div>}
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6 w-full">{children}</div>
        </div>
      </div>
      <AuthFooter />
    </div>
  );
};

export default AuthPageLayout;
