export function bannedAccountMessage(reason?: string) {
  const normalizedReason = reason?.trim();
  return normalizedReason
    ? `Your account has been banned. Reason: ${normalizedReason}`
    : "Your account has been banned. Contact an administrator for more information.";
}
