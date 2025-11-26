import worker, { type Env as WorkerEnv } from "../../src/worker";
import { handleProxyRequest } from "../_proxy";

const shouldUseProxy = (env: { API_PROXY_BASE_URL?: string; API_PROXY_ORIGIN?: string }): boolean => {
  const raw = env.API_PROXY_BASE_URL ?? env.API_PROXY_ORIGIN;
  return typeof raw === "string" && raw.trim().length > 0;
};

const isDatabaseFreeEndpoint = (request: Request): boolean => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return path === "/api/public/youtube-channel";
};

export const onRequest = async (ctx: Parameters<typeof handleProxyRequest>[0]) => {
  const allowLocalWithoutDb = isDatabaseFreeEndpoint(ctx.request);
  const missingDb = !("DB" in ctx.env && ctx.env.DB);
  const useProxy = !allowLocalWithoutDb && (shouldUseProxy(ctx.env) || missingDb);

  if (useProxy) {
    return handleProxyRequest(ctx, { upstreamPrefix: "api" });
  }

  if (ctx.request.method === "OPTIONS") {
    return worker.fetch(ctx.request, ctx.env as WorkerEnv);
  }

  return worker.fetch(ctx.request, ctx.env as WorkerEnv);
};
