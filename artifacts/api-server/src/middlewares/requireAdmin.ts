import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const userId = getAuth(req).userId;

  if (!userId) {
    res.status(401).json({ error: "Kërkohet hyrja si administrator." });
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) {
    req.log.error("ADMIN_EMAIL is not configured");
    res.status(503).json({ error: "Llogaria e administratorit nuk është konfiguruar." });
    return;
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const primaryEmail = user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    )?.emailAddress;

    if (primaryEmail?.toLowerCase() !== adminEmail) {
      res.status(403).json({ error: "Kjo faqe është vetëm për administratorin e servisit." });
      return;
    }

    next();
  } catch (error) {
    req.log.error({ err: error }, "Failed to verify admin identity");
    res.status(401).json({ error: "Nuk u verifikua llogaria." });
  }
};
