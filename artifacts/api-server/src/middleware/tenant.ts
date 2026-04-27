import { Request, Response, NextFunction } from "express";
import { TENANTS, type TenantKey } from "../config/tenants.js";

export interface TenantRequest extends Request {
  tenant: TenantKey;
}

export function identificarTenant(
  req: TenantRequest,
  res: Response,
  next: NextFunction
) {
  const host = req.headers.host || "";

  if (host.includes("cabofrio") || host.includes("cabo-frio")) {
    req.tenant = "cabo-frio";
  } else if (host.includes("araruama")) {
    req.tenant = "araruama";
  } else {
    req.tenant = "default";
  }

  if (!TENANTS[req.tenant]) {
    res.status(400).json({ erro: "Tenant não identificado" });
    return;
  }

  next();
}
