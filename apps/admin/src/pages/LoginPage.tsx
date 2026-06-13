import { useState, type FormEvent, type ReactElement } from "react";

import { LanguageSwitchButton } from "../effects/language-wipe/LanguageSwitchButton";
import { useT } from "../i18n/useT";
import { authStore } from "../stores/authStore";

export function LoginPage(): ReactElement {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpToken, setTotpToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isTotpStep = totpToken !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (isTotpStep) {
        await authStore.loginWithTotp({
          code: totpCode,
          totpToken
        });
        return;
      }

      const nextState = await authStore.login({ email, password });

      if (nextState.status === "totpRequired") {
        setTotpToken(nextState.totpToken);
        setTotpCode("");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-login-page">
      <LanguageSwitchButton />

      <section className="liax-card admin-login-card" aria-labelledby="admin-login-title">
        <div className="liax-card__header">
          <p className="admin-kicker">{t("auth.login")}</p>
          <h1 id="admin-login-title">{t("app.title")}</h1>
        </div>
        <form className="liax-card__body" onSubmit={(event) => void handleSubmit(event)}>
          <label className="admin-form-field">
            <span>{t("auth.identifier")}</span>
            <input
              autoComplete="username"
              disabled={isTotpStep}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="text"
              value={email}
            />
          </label>

          <label className="admin-form-field">
            <span>{t("auth.password")}</span>
            <input
              autoComplete="current-password"
              disabled={isTotpStep}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {isTotpStep ? (
            <>
              <p className="admin-muted-text">{t("auth.totpRequired")}</p>
              <label className="admin-form-field">
                <span>{t("auth.totpCode")}</span>
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  onChange={(event) => setTotpCode(event.target.value)}
                  pattern="[0-9]{6}"
                  required
                  type="text"
                  value={totpCode}
                />
              </label>
            </>
          ) : null}

          {errorMessage ? <p className="admin-error-text">{errorMessage}</p> : null}

          <button className="liax-button liax-button--brand admin-login-card__button" disabled={isSubmitting} type="submit">
            {isTotpStep ? t("auth.totpVerify") : t("auth.login")}
          </button>
        </form>
      </section>
    </main>
  );
}
