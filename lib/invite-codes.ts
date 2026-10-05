// @ts-nocheck
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { applyPermissionTemplateToUser, getDefaultPermissionTemplateCode } from "@/lib/permissions";

function normalizeInviteCode(value: unknown) {
  return String(value || "").trim();
}

function getInviteInvalidMessage(reason: string) {
  switch (reason) {
    case "required":
      return "请输入邀请码";
    case "not_found":
      return "邀请码无效";
    case "disabled":
    case "expired":
      return "邀请码已失效";
    case "maxed":
      return "邀请码不可用";
    default:
      return "邀请码无效";
  }
}

export async function validateInviteCode(params: {
  tenantId: string;
  companyId: string;
  code: string;
}) {
  const code = normalizeInviteCode(params.code);
  if (!code) {
    return {
      ok: false,
      reason: "required",
      message: getInviteInvalidMessage("required"),
      inviteCode: null,
    };
  }

  const inviteCode = await withPrismaRetry(() =>
    prisma.inviteCode.findFirst({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        code: {
          equals: code,
          mode: "insensitive",
        },
      },
    }),
  );

  if (!inviteCode) {
    return {
      ok: false,
      reason: "not_found",
      message: getInviteInvalidMessage("not_found"),
      inviteCode: null,
    };
  }

  if (inviteCode.status === "disabled") {
    return {
      ok: false,
      reason: "disabled",
      message: getInviteInvalidMessage("disabled"),
      inviteCode,
    };
  }

  if (
    inviteCode.status === "expired"
    || (inviteCode.expires_at && inviteCode.expires_at.getTime() <= Date.now())
  ) {
    return {
      ok: false,
      reason: "expired",
      message: getInviteInvalidMessage("expired"),
      inviteCode,
    };
  }

  if (inviteCode.max_uses > 0 && inviteCode.used_count >= inviteCode.max_uses) {
    return {
      ok: false,
      reason: "maxed",
      message: getInviteInvalidMessage("maxed"),
      inviteCode,
    };
  }

  return {
    ok: true,
    reason: null,
    message: "",
    inviteCode,
  };
}

export function getRegisterIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || null;
}

export async function createInviteCodeUsageAndAssignPermissions(params: {
  tenantId: string;
  companyId: string;
  inviteCodeId: string;
  userId: string;
  registerIp?: string | null;
  registerSource?: string | null;
  role: string;
  userType: string;
  permissionTemplateCode?: string | null;
}) {
  await withPrismaRetry(async () => {
    await prisma.$transaction(async (tx) => {
      const inviteCode = await tx.inviteCode.findFirst({
        where: {
          id: params.inviteCodeId,
          tenant_id: params.tenantId,
          company_id: params.companyId,
        },
      });

      if (!inviteCode) {
        throw new Error("invite_code_not_found");
      }

      const validation = await validateInviteCode({
        tenantId: params.tenantId,
        companyId: params.companyId,
        code: inviteCode.code,
      });

      if (!validation.ok) {
        throw new Error(validation.reason || "invite_code_invalid");
      }

      await tx.inviteCodeUsage.create({
        data: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          invite_code_id: params.inviteCodeId,
          user_id: params.userId,
          register_ip: params.registerIp || null,
          register_source: params.registerSource || null,
        },
      });

      const nextUsedCount = inviteCode.used_count + 1;
      await tx.inviteCode.update({
        where: { id: inviteCode.id },
        data: {
          used_count: nextUsedCount,
          status:
            inviteCode.max_uses > 0 && nextUsedCount >= inviteCode.max_uses
              ? "disabled"
              : inviteCode.status,
        },
      });
    });
  });

  await applyPermissionTemplateToUser({
    tenantId: params.tenantId,
    companyId: params.companyId,
    userId: params.userId,
    templateCode:
      params.permissionTemplateCode
      || getDefaultPermissionTemplateCode({
        role: params.role,
        userType: params.userType,
      }),
  });
}
