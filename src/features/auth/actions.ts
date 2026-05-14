"use server";

import { loginUser, logoutUser, registerUser, sendRegisterCode } from "@/features/auth/service";

export async function sendRegisterCodeAction(input: unknown) {
  return sendRegisterCode(input);
}

export async function registerAction(input: unknown) {
  return registerUser(input);
}

export async function loginAction(input: unknown) {
  return loginUser(input);
}

export async function logoutAction() {
  return logoutUser();
}
