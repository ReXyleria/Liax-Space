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
  secondFactors?: Array<"email" | "totp" | "passkey">;
};

type SecondFactorMethod = "email" | "totp" | "passkey";
type SecondFactorStep = "email" | "totp" | "lost" | "recovery";

type AuthText = {
  loginTitle: string;
  loginIntro: string;
  accountPlaceholder: string;
  passwordPlaceholder: string;
  secondFactorRequired: string;
  emailCodePlaceholder: string;
  emailCodeHint: string;
  emailCodeOption: string;
  emailCodeOptionHint: string;
  totpPlaceholder: string;
  totpCodeHint: string;
  recoveryPlaceholder: string;
  recoveryCodeOption: string;
  recoveryCodeOptionHint: string;
  recoveryCodeHint: string;
  lostAuthenticator: string;
  lostAuthenticatorTitle: string;
  lostAuthenticatorHint: string;
  backToAuthenticator: string;
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
    emailCodePlaceholder: "邮箱验证码",
    emailCodeHint: "验证码已发送到你的邮箱。",
    emailCodeOption: "邮箱验证码",
    emailCodeOptionHint: "使用发送到账号邮箱的验证码。",
    totpPlaceholder: "6 位动态验证码",
    totpCodeHint: "打开验证器应用，输入当前 6 位动态验证码。",
    recoveryPlaceholder: "恢复码",
    recoveryCodeOption: "恢复码",
    recoveryCodeOptionHint: "使用启用验证器时保存的一次性恢复码。",
    recoveryCodeHint: "输入启用验证器时保存的一次性恢复码。",
    lostAuthenticator: "我丢失了我的验证器",
    lostAuthenticatorTitle: "选择恢复方式",
    lostAuthenticatorHint: "如果无法打开验证器，可以使用邮箱验证码或恢复码继续登录。",
    backToAuthenticator: "返回动态验证码",
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
    emailCodePlaceholder: "Email verification code",
    emailCodeHint: "A verification code was sent to your email.",
    emailCodeOption: "Email code",
    emailCodeOptionHint: "Use the verification code sent to your account email.",
    totpPlaceholder: "6-digit authenticator code",
    totpCodeHint: "Open your authenticator app and enter the current 6-digit code.",
    recoveryPlaceholder: "Recovery code",
    recoveryCodeOption: "Recovery code",
    recoveryCodeOptionHint: "Use a one-time recovery code saved when authenticator verification was enabled.",
    recoveryCodeHint: "Enter a one-time recovery code saved when authenticator verification was enabled.",
    lostAuthenticator: "I lost my authenticator",
    lostAuthenticatorTitle: "Choose a recovery method",
    lostAuthenticatorHint: "If you cannot open your authenticator app, continue with an email code or a recovery code.",
    backToAuthenticator: "Back to authenticator code",
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
    credentials: "same-origin",
    body: JSON.stringify(body)
  });

  return (await response.json()) as ApiState;
}

function getInitialSecondFactorStep(methods: SecondFactorMethod[]): SecondFactorStep {
  if (methods.includes("totp")) {
    return "totp";
  }
  if (methods.includes("email")) {
    return "email";
  }
  return "email";
}

export function LoginForm({ callbackUrl = "/console", locale = "zh-CN" }: { callbackUrl?: string; locale?: Locale }) {
  const text = useMemo(() => authText[locale] ?? authText["zh-CN"], [locale]);
  const [state, setState] = useState<ApiState>({});
  const [account, setAccount] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [secondFactors, setSecondFactors] = useState<SecondFactorMethod[]>([]);
  const [secondFactorStep, setSecondFactorStep] = useState<SecondFactorStep>("email");
  const [trustDevice, setTrustDevice] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isPasskeyPending, startPasskeyTransition] = useTransition();
  const [isEmailCodePending, startEmailCodeTransition] = useTransition();

  const requiresSecondFactor = Boolean(pendingToken);
  const allowEmail = secondFactors.includes("email");
  const allowTotp = secondFactors.includes("totp");
  const allowPasskey = secondFactors.includes("passkey");
  const canSubmitSecondFactor =
    (secondFactorStep === "email" && allowEmail) ||
    (secondFactorStep === "totp" && allowTotp) ||
    (secondFactorStep === "recovery" && allowTotp);
  const showPasskeyButton = !requiresSecondFactor || (allowPasskey && !allowTotp);
  const messageClassName = state.ok
    ? "text-sm text-emerald-600"
    : state.requiresSecondFactor
      ? "text-sm text-muted-foreground"
      : "text-sm text-destructive";

  function applyResult(result: ApiState) {
    setState(result);

    if (result.ok) {
      setPendingToken(null);
      setSecondFactors([]);
      setSecondFactorStep("email");
      setTrustDevice(false);
      window.location.assign(result.redirectTo ?? callbackUrl);
      return;
    }

    if (result.requiresSecondFactor && result.pendingToken) {
      const methods = result.secondFactors ?? [];
      setPendingToken(result.pendingToken);
      setSecondFactors(methods);
      setSecondFactorStep(getInitialSecondFactorStep(methods));
    }
  }

  async function requestSecondFactorEmailCode() {
    if (!pendingToken || isEmailCodePending) {
      return;
    }

    startEmailCodeTransition(async () => {
      const result = await postJson("/api/auth/login/email-code", { pendingToken });
      setState(result);
      if (result.ok) {
        setSecondFactorStep("email");
      }
    });
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
        credentials: "same-origin",
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
                const secondFactorPayload: {
                  pendingToken: string;
                  emailCode?: FormDataEntryValue | null;
                  totpCode?: FormDataEntryValue | null;
                  recoveryCode?: FormDataEntryValue | null;
                  trustDevice: boolean;
                  callbackUrl: string;
                } = {
                  pendingToken,
                  trustDevice,
                  callbackUrl
                };

                if (secondFactorStep === "email") {
                  secondFactorPayload.emailCode = formData.get("emailCode");
                } else if (secondFactorStep === "totp") {
                  secondFactorPayload.totpCode = formData.get("totpCode");
                } else if (secondFactorStep === "recovery") {
                  secondFactorPayload.recoveryCode = formData.get("recoveryCode");
                }

                const result = await postJson("/api/auth/login/verify", {
                  ...secondFactorPayload
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
          {requiresSecondFactor && secondFactorStep === "totp" && allowTotp ? (
            <div className="space-y-3 rounded-md border bg-muted/35 p-3">
              <Input required name="totpCode" inputMode="numeric" placeholder={text.totpPlaceholder} maxLength={6} autoFocus />
              <p className="text-xs text-muted-foreground">{text.totpCodeHint}</p>
              <button
                type="button"
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setSecondFactorStep("lost")}
              >
                {text.lostAuthenticator}
              </button>
            </div>
          ) : null}
          {requiresSecondFactor && secondFactorStep === "lost" && allowTotp ? (
            <div className="space-y-3 rounded-md border bg-muted/35 p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{text.lostAuthenticatorTitle}</p>
                <p className="text-xs text-muted-foreground">{text.lostAuthenticatorHint}</p>
              </div>
              <div className="grid gap-2">
                {allowEmail ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-auto justify-start whitespace-normal px-3 py-2 text-left"
                    disabled={isEmailCodePending}
                    onClick={requestSecondFactorEmailCode}
                  >
                    <span>
                      <span className="block text-sm font-medium">
                        {isEmailCodePending ? text.sending : text.emailCodeOption}
                      </span>
                      <span className="block text-xs font-normal text-muted-foreground">{text.emailCodeOptionHint}</span>
                    </span>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  className="h-auto justify-start whitespace-normal px-3 py-2 text-left"
                  onClick={() => setSecondFactorStep("recovery")}
                >
                  <span>
                    <span className="block text-sm font-medium">{text.recoveryCodeOption}</span>
                    <span className="block text-xs font-normal text-muted-foreground">{text.recoveryCodeOptionHint}</span>
                  </span>
                </Button>
              </div>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setSecondFactorStep("totp")}>
                {text.backToAuthenticator}
              </Button>
            </div>
          ) : null}
          {requiresSecondFactor && secondFactorStep === "email" && allowEmail ? (
            <div className="space-y-2 rounded-md border bg-muted/35 p-3">
              <Input required name="emailCode" inputMode="numeric" placeholder={text.emailCodePlaceholder} maxLength={8} autoFocus />
              <p className="text-xs text-muted-foreground">{text.emailCodeHint}</p>
              {allowTotp ? (
                <Button type="button" variant="ghost" className="w-full" onClick={() => setSecondFactorStep("totp")}>
                  {text.backToAuthenticator}
                </Button>
              ) : null}
            </div>
          ) : null}
          {requiresSecondFactor && secondFactorStep === "recovery" && allowTotp ? (
            <div className="space-y-2 rounded-md border bg-muted/35 p-3">
              <Input required name="recoveryCode" placeholder={text.recoveryPlaceholder} autoFocus />
              <p className="text-xs text-muted-foreground">{text.recoveryCodeHint}</p>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setSecondFactorStep("lost")}>
                {text.lostAuthenticatorTitle}
              </Button>
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
            <p className={messageClassName}>
              {state.message}
            </p>
          ) : null}
          {!requiresSecondFactor || canSubmitSecondFactor ? (
            <Button className="w-full" disabled={isPending || (requiresSecondFactor && !canSubmitSecondFactor)}>
              {isPending ? text.signingIn : requiresSecondFactor ? text.verifyAndSignIn : text.signIn}
            </Button>
          ) : null}
          {showPasskeyButton ? (
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
          ) : null}
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
                  setSecondFactorStep("email");
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
