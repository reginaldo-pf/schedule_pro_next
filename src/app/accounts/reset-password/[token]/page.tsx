import { prisma } from "@/lib/prisma";
import { verifyPasswordResetToken } from "@/lib/auth";
import { ResetPasswordClient } from "@/components/accounts/ResetPasswordClient";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const verified = await verifyPasswordResetToken(token);

  let isTokenValid = false;
  let userEmail = verified.email || "";

  if (verified.valid && verified.userId) {
    const user = await prisma.accounts_user.findUnique({
      where: { id: BigInt(verified.userId) },
    });
    if (
      user &&
      user.is_active &&
      user.password.slice(-16) === verified.pwdFp
    ) {
      isTokenValid = true;
      userEmail = user.email;
    }
  }

  return (
    <ResetPasswordClient
      token={token}
      isTokenValid={isTokenValid}
      email={userEmail}
    />
  );
}
