"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import type { Locale } from "@/lib/i18n-messages";

type ApiState = {
  ok?: boolean;
  message?: string;
  redirectTo?: string;
  requiresSecondFactor?: boolean;
  pendingToken?: string;
  secondFactors?: Array<"totp" | "passkey">;
};

type AuthText = {
  loginTitle: string;
  loginIntro: string;
  accountPlaceholder: string;
  passwordPlaceholder: string;
  secondFactorRequired: string;
  totpPlaceholder: string;
  recoveryPlaceholder: string;
  trustDevice: string;
  signingIn: string;
  verifyAndSignIn: string;
  signIn: string;
  checkingPasskey: string;
  verifyWithPasskey: string;
  signInWithPasskey: string;
  passkeyFailed: string;
  cancel: string;
  secondFactorCancelled: string;
  noAccount: string;
  registerLink: string;
  registerTitle: string;
  registerIntro: string;
  emailPlaceholder: string;
  usernamePlaceholder: string;
  nicknamePlaceholder: string;
  codePlaceholder: string;
  passwordRegisterPlaceholder: string;
  sending: string;
  send: string;
  registering: string;
  register: string;
  alreadyAccount: string;
};

const authText: Record<Locale, AuthText> = {
  "zh-CN": {
    loginTitle: "登录",
    loginIntro: "使用用户名或邮箱和密码登录。启用双因素验证后，请继续完成二次验证。",
    accountPlaceholder: "用户名或邮箱",
    passwordPlaceholder: "密码",
    secondFactorRequired: "当前设备需要二次验证。",
    totpPlaceholder: "6 位动态验证码",
    recoveryPlaceholder: "或恢复码",
    trustDevice: "信任此设备",
    signingIn: "登录中...",
    verifyAndSignIn: "验证并登录",
    signIn: "登录",
    checkingPasskey: "正在检查通行密钥...",
    verifyWithPasskey: "使用通行密钥验证",
    signInWithPasskey: "使用通行密钥登录",
    passkeyFailed: "通行密钥登录失败，请重试或使用账号密码登录。",
    cancel: "取消",
    secondFactorCancelled: "已取消二次验证。",
    noAccount: "还没有账号？",
    registerLink: "注册",
    registerTitle: "创建账号",
    registerIntro: "邮箱验证成功后即可完成注册。",
    emailPlaceholder: "邮箱",
    usernamePlaceholder: "用户名，仅支持字母、数字和下划线",
    nicknamePlaceholder: "昵称",
    codePlaceholder: "验证码",
    passwordRegisterPlaceholder: "密码，至少 8 位且包含字母和数字",
    sending: "发送中",
    send: "发送",
    registering: "注册中...",
    register: "注册",
    alreadyAccount: "已有账号？"
  },
  en: {
    loginTitle: "Sign in",
    loginIntro: "Use your username or email and password. If two-factor verification is enabled, complete it after signing in.",
    accountPlaceholder: "Username or email",
    passwordPlaceholder: "Password",
    secondFactorRequired: "This device requires second-factor verification.",
    totpPlaceholder: "6-digit authenticator code",
    recoveryPlaceholder: "Or recovery code",
    trustDevice: "Trust this device",
    signingIn: "Signing in...",
    verifyAndSignIn: "Verify and sign in",
    signIn: "Sign in",
    checkingPasskey: "Checking passkey...",
    verifyWithPasskey: "Verify with passkey",
    signInWithPasskey: "Sign in with passkey",
    passkeyFailed: "Passkey sign-in failed. Try again or use your account password.",
    cancel: "Cancel",
    secondFactorCancelled: "Second-factor verification cancelled.",
    noAccount: "No account yet?",
    registerLink: "Register",
    registerTitle: "Create account",
    registerIntro: "Register after email verification succeeds.",
    emailPlaceholder: "Email",
    usernamePlaceholder: "Username, letters/numbers/underscore only",
    nicknamePlaceholder: "Nickname",
    codePlaceholder: "Verification code",
    passwordRegisterPlaceholder: "Password, at least 8 chars with letters and numbers",
    sending: "Sending",
    send: "Send",
    registering: "Registering...",
    register: "Register",
    alreadyAccount: "Already have an account?"
  }
};

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  return (await response.json()) as ApiState;
}

export function LoginForm({ callbackUrl = "/admin", locale = "zh-CN" }: { callbackUrl?: string; locale?: Locale }) {
  const router = useRouter();
  const text = useMemo(() => authText[locale] ?? authText["zh-CN"], [locale]);
  const [state, setState] = useState<ApiState>({});
  const [account, setAccount] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [secondFactors, setSecondFactors] = useState<Array<"totp" | "passkey">>([]);
  const [trustDevice, setTrustDevice] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isPasskeyPending, startPasskeyTransition] = useTransition();

  const requiresSecondFactor = Boolean(pendingToken);
  const allowTotp = secondFactors.includes("totp");
  const allowPasskey = secondFactors.includes("passkey");

  function applyResult(result: ApiState) {
    setState(result);

    if (result.ok) {
      setPendingToken(null);
      setSecondFactors([]);
      setTrustDevice(false);
      router.push(result.redirectTo ?? callbackUrl);
      router.refresh();
      return;
    }

    if (result.requiresSecondFactor && result.pendingToken) {
      setPendingToken(result.pendingToken);
      setSecondFactors(result.secondFactors ?? []);
    }
  }

  async function runPasskeyLogin() {
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const payload = requiresSecondFactor && pendingToken
        ? { pendingToken }
        : account.trim()
          ? { account: account.trim() }
          : {};
      const optionsResponse = await fetch("/api/auth/passkey/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const options = await optionsResponse.json();
      if (!optionsResponse.ok) {
        applyResult({ ok: false, message: options.message ?? text.passkeyFailed });
        return;
      }

      const response = await startAuthentication({ optionsJSON: options });
      const verifyResult = await postJson("/api/auth/passkey/login/verify", {
        response,
        callbackUrl,
        ...(requiresSecondFactor && pendingToken ? { pendingToken, trustDevice } : {})
      });
      applyResult(verifyResult);
    } catch (error) {
      applyResult({
        ok: false,
        message: error instanceof Error ? error.message : text.passkeyFailed
      });
    }
  }

  return (
    <Card className="w-full max-w-md border-white/45 bg-card/82 shadow-2xl shadow-foreground/10 backdrop-blur-xl">
      <CardHeader>
        <CardTitle>{text.loginTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">{text.loginIntro}</p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              if (requiresSecondFactor && pendingToken) {
                const result = await postJson("/api/auth/login/verify", {
                  pendingToken,
                  totpCode: formData.get("totpCode"),
                  recoveryCode: formData.get("recoveryCode"),
                  trustDevice,
                  callbackUrl
                });
                applyResult(result);
                return;
              }

              const result = await postJson("/api/auth/login", {
                account: formData.get("account"),
                password: formData.get("password"),
                callbackUrl
              });
              applyResult(result);
            });
          }}
        >
          {!requiresSecondFactor ? (
            <>
              <Input
                required
                name="account"
                placeholder={text.accountPlaceholder}
                autoComplete="username webauthn"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
              />
              <Input required name="password" type="password" placeholder={text.passwordPlaceholder} autoComplete="current-password" />
            </>
          ) : (
            <div className="rounded-md border bg-muted/35 p-3 text-sm text-muted-foreground">
              {text.secondFactorRequired}
            </div>
          )}
          {requiresSecondFactor && allowTotp ? (
            <div className="space-y-3 rounded-md border bg-muted/35 p-3">
              <Input name="totpCode" inputMode="numeric" placeholder={text.totpPlaceholder} maxLength={6} />
              <Input name="recoveryCode" placeholder={text.recoveryPlaceholder} />
            </div>
          ) : null}
          {requiresSecondFactor ? (
            <ThemedCheckbox
              name="trustDevice"
              checked={trustDevice}
              onCheckedChange={setTrustDevice}
              label={text.trustDevice}
              className="py-2 text-xs"
            />
          ) : null}
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
              {state.message}
            </p>
          ) : null}
          <Button className="w-full" disabled={isPending || (requiresSecondFactor && !allowTotp)}>
            {isPending ? text.signingIn : requiresSecondFactor ? text.verifyAndSignIn : text.signIn}
          </Button>
          <Button
            className="w-full"
            type="button"
            variant="secondary"
            disabled={isPasskeyPending || (requiresSecondFactor && !allowPasskey)}
            onClick={() => {
              startPasskeyTransition(async () => {
                await runPasskeyLogin();
              });
            }}
          >
            {isPasskeyPending
              ? text.checkingPasskey
              : requiresSecondFactor
                ? text.verifyWithPasskey
                : text.signInWithPasskey}
          </Button>
          {requiresSecondFactor ? (
            <Button
              className="w-full"
              type="button"
              variant="secondary"
              onClick={() => {
                startTransition(async () => {
                  if (pendingToken) {
                    await postJson("/api/auth/login/cancel", { pendingToken });
                  }
                  setPendingToken(null);
                  setSecondFactors([]);
                  setTrustDevice(false);
                  setState({ ok: false, message: text.secondFactorCancelled });
                });
              }}
            >
              {text.cancel}
            </Button>
          ) : null}
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {text.noAccount} <Link className="text-primary hover:text-primary/80" href="/register">{text.registerLink}</Link>
        </p>
      </CardContent>
    </Card>
  );
}

export function RegisterForm({ locale = "zh-CN" }: { locale?: Locale }) {
  const router = useRouter();
  const text = useMemo(() => authText[locale] ?? authText["zh-CN"], [locale]);
  const [state, setState] = useState<ApiState>({});
  const [isPending, startTransition] = useTransition();
  const [isSending, startSending] = useTransition();

  return (
    <Card className="w-full max-w-md border-white/45 bg-card/82 shadow-2xl shadow-foreground/10 backdrop-blur-xl">
      <CardHeader>
        <CardTitle>{text.registerTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">{text.registerIntro}</p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await postJson("/api/auth/register", {
                email: formData.get("email"),
                username: formData.get("username"),
                nickname: formData.get("nickname"),
                password: formData.get("password"),
                emailCode: formData.get("emailCode")
              });
              setState(result);
              if (result.ok) {
                router.push("/login");
              }
            });
          }}
        >
          <Input required name="email" type="email" placeholder={text.emailPlaceholder} autoComplete="email" />
          <Input required name="username" placeholder={text.usernamePlaceholder} autoComplete="username" maxLength={32} />
          <Input required name="nickname" placeholder={text.nicknamePlaceholder} maxLength={32} />
          <div className="flex gap-2">
            <Input required name="emailCode" placeholder={text.codePlaceholder} maxLength={8} />
            <Button
              type="button"
              variant="secondary"
              disabled={isSending}
              onClick={(event) => {
                const form = event.currentTarget.form;
                const email = new FormData(form ?? undefined).get("email");
                startSending(async () => {
                  const result = await postJson("/api/auth/register-code", { email });
                  setState(result);
                });
              }}
            >
              {isSending ? text.sending : text.send}
            </Button>
          </div>
          <Input required name="password" type="password" placeholder={text.passwordRegisterPlaceholder} autoComplete="new-password" />
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
              {state.message}
            </p>
          ) : null}
          <Button className="w-full" disabled={isPending}>
            {isPending ? text.registering : text.register}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {text.alreadyAccount} <Link className="text-primary hover:text-primary/80" href="/login">{text.signIn}</Link>
        </p>
      </CardContent>
    </Card>
  );
}
