import { prisma } from "@/lib/prisma";
import { verifyUserConfirmationToken } from "@/lib/auth";
import { ConfirmAccountClient } from "@/components/accounts/ConfirmAccountClient";

export default async function ConfirmAccountPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const verified = await verifyUserConfirmationToken(token);

  let userSummary: {
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
  } | null = null;
  let needsPassword = true;

  if (verified) {
    const user = await prisma.accounts_user.findUnique({
      where: { id: BigInt(verified.userId) },
    });
    if (user) {
      userSummary = {
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_active: user.is_active,
      };
      needsPassword = !user.password.startsWith("pbkdf2_sha256$");
    }
  }

  return (
    <ConfirmAccountClient
      token={token}
      valid={Boolean(verified && userSummary)}
      user={userSummary}
      needsPassword={needsPassword}
    />
  );
}
