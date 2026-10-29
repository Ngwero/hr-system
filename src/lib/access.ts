export function can(
  context: { permissions: string[]; roles: { code: string }[] },
  permission: string,
) {
  return (
    context.roles.some((role) => role.code === "super_admin") ||
    context.permissions.includes(permission)
  );
}
