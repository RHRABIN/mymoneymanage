import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/lib/finance";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/_authed/account")({
  head: () => ({ meta: [{ title: "My Account — Ledger" }] }),
  component: AccountPage,
});

const profileSchema = z.object({
  full_name: z.string().trim().max(100),
  email: z.string().trim().email().max(255),
});
type ProfileVals = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`)
      .max(72),
    confirm: z.string().max(72),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match" });
type PasswordVals = z.infer<typeof passwordSchema>;

function AccountPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const profileForm = useForm<ProfileVals>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "", email: "" },
  });
  const passwordForm = useForm<PasswordVals>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .maybeSingle();
      profileForm.reset({
        full_name: data?.full_name ?? "",
        email: data?.email ?? user.email ?? "",
      });
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onSaveProfile = async (vals: ProfileVals) => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ full_name: vals.full_name })
        .eq("user_id", user.id);
      if (pErr) throw pErr;

      // profiles.email is synced from auth once the new address is confirmed
      if (vals.email !== user.email) {
        const { error: eErr } = await supabase.auth.updateUser({ email: vals.email });
        if (eErr) throw eErr;
        toast.success("Profile saved. Check your inbox to confirm the new email.");
      } else {
        toast.success("Profile saved.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async ({ password }: PasswordVals) => {
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    passwordForm.reset({ password: "", confirm: "" });
    toast.success("Password updated.");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">My Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile and password.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your name and email address.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" disabled={loading} {...profileForm.register("full_name")} />
              {profileForm.formState.errors.full_name && (
                <p className="text-xs text-destructive">
                  {profileForm.formState.errors.full_name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                disabled={loading}
                {...profileForm.register("email")}
              />
              {profileForm.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {profileForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={savingProfile || loading}>
              {savingProfile ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("password")}
              />
              {passwordForm.formState.errors.password && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("confirm")}
              />
              {passwordForm.formState.errors.confirm && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.confirm.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? "Updating..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
