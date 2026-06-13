import { authApi, type AdminUser, type LoginRequest, type LoginResponse } from "../api/authApi";
import { clearAuthToken, readAuthToken, writeAuthToken } from "../api/httpClient";

export type AuthStatus = "anonymous" | "authenticated" | "totpRequired";

export type AuthState = {
  status: AuthStatus;
  token: string | null;
  totpToken: string | null;
  user: AdminUser | null;
};

export type AuthStateListener = (state: AuthState) => void;

const listeners = new Set<AuthStateListener>();
const initialToken = readAuthToken();

let state: AuthState = {
  status: initialToken ? "authenticated" : "anonymous",
  token: initialToken,
  totpToken: null,
  user: null
};

function emit(): void {
  for (const listener of listeners) {
    listener(state);
  }
}

function setState(nextState: AuthState): AuthState {
  state = nextState;
  emit();
  return state;
}

function applyLoginResponse(response: LoginResponse): AuthState {
  if (response.totpRequired) {
    clearAuthToken();

    return setState({
      status: "totpRequired",
      token: null,
      totpToken: response.totpToken,
      user: response.user
    });
  }

  writeAuthToken(response.token);

  return setState({
    status: "authenticated",
    token: response.token,
    totpToken: null,
    user: response.user
  });
}

function logout(): AuthState {
  clearAuthToken();

  return setState({
    status: "anonymous",
    token: null,
    totpToken: null,
    user: null
  });
}

export const authStore = {
  getSnapshot(): AuthState {
    return state;
  },
  subscribe(listener: AuthStateListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  async login(input: LoginRequest): Promise<AuthState> {
    const response = await authApi.login(input);
    return applyLoginResponse(response);
  },
  async loginWithTotp(input: { code: string; totpToken: string }): Promise<AuthState> {
    const response = await authApi.loginWithTotp(input);
    writeAuthToken(response.token);

    return setState({
      status: "authenticated",
      token: response.token,
      totpToken: null,
      user: response.user
    });
  },
  async loadCurrentUser(): Promise<AuthState> {
    const token = readAuthToken();

    if (!token) {
      return logout();
    }

    const response = await authApi.me();

    return setState({
      status: "authenticated",
      token,
      totpToken: null,
      user: response.user
    });
  },
  logout
};
