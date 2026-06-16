import { api } from "./client";

export async function loginRequest(username: string, password: string) {
  const params = new URLSearchParams();
  params.append("username", username);
  params.append("password", password);

  const { data } = await api.post<{ access_token: string; token_type: string }>(
    "/auth/login",
    params,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return data;
}
